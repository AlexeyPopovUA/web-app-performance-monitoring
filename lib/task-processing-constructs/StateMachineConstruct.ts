import {Construct} from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {IFunction} from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {Duration, RemovalPolicy} from "aws-cdk-lib/core";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import {Cluster, FargatePlatformVersion} from "aws-cdk-lib/aws-ecs";
import {ISecurityGroup, IVpc, SecurityGroup, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";

import configuration from "../../cfg/configuration";

type Props = {
  sqsTaskHandler: lambda.Function;
  env: {
    region: string;
    account: string;
  },
  networking?: {
    vpc: IVpc;
    securityGroup: ISecurityGroup;
  }
}

export class StateMachineConstruct extends Construct {
  public readonly reportFinalizerLambda: IFunction;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const temporaryReportBucket = new Bucket(this, `${configuration.COMMON.project}-temporary-report-bucket`, {
      bucketName: configuration.REPORTING.temporaryBucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, `${configuration.COMMON.project}-start-state`);

    const taskGeneratorLambda = new lambda.Function(this, `${configuration.COMMON.project}-task-generator`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'task-generator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/task-generator-step')
    });

    const analysisInitiatorLambda = new lambda.Function(this, `${configuration.COMMON.project}-analysis-initiator`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'analysis-initiator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/analysis-initiator-step'),
      environment: {
        TEMPORARY_BUCKET_NAME: configuration.REPORTING.temporaryBucketName,
        TEMPORARY_BUCKET_REGION: props.env.region
      }
    });

    const cleanupLambda = new lambda.Function(this, `${configuration.COMMON.project}-cleanup`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'cleanup-step.handler',
      code: lambda.Code.fromAsset('dist/steps/cleanup-step')
    });

    this.reportFinalizerLambda = new lambda.Function(this, `${configuration.COMMON.project}-report-finalizer`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'report-finalizer-step.handler',
      code: lambda.Code.fromAsset('dist/steps/report-finalizer-step'),
      timeout: Duration.minutes(2),
      environment: {
        REPORT_BUCKET_NAME: configuration.REPORTING.bucketName,
        TEMPORARY_BUCKET_NAME: configuration.REPORTING.temporaryBucketName
      }
    });

    temporaryReportBucket.grantRead(this.reportFinalizerLambda);

    // Step to generate a list of tasks
    const generateTasks = new tasks.LambdaInvoke(this, 'Generate Tasks', {
      lambdaFunction: taskGeneratorLambda,
      outputPath: '$.Payload'
    });

    // Map state to schedule concurrent executions of tasks
    const mapState = new sfn.Map(this, 'Map State', {
      maxConcurrency: 10,
      itemsPath: '$.concurrentTasks',
      resultPath: '$.results'
    });

    // prepares the analysis task parameters for fargate
    const initiateAnalysis = new tasks.LambdaInvoke(this, `${configuration.COMMON.project}-initiate-analysis`, {
      lambdaFunction: analysisInitiatorLambda,
      outputPath: '$.Payload'
    });

    // Define a task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${configuration.COMMON.project}-sitespeedio-task-def`, {
      family: configuration.ANALYSIS.taskFamily,
      cpu: 4096,
      memoryLimitMiB: 8192,
    });

    taskDefinition.taskRole && temporaryReportBucket.grantReadWrite(taskDefinition.taskRole);

    // Add container to the task definition
    const containerDefinition = taskDefinition.addContainer(`${configuration.COMMON.project}-sitespeedio-container`, {
      image: ecs.ContainerImage.fromRegistry('sitespeedio/sitespeed.io:35.6.1'),
      memoryLimitMiB: 8192,
      cpu: 4096,
      command: ['https://oleksiipopov.com', '--summary'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `${configuration.COMMON.project}-sitespeedio-container`,
        logRetention: RetentionDays.ONE_DAY
      }),
    });

    // TODO: Task to process each item in the map state. Initiates and waits a Fargate task to finish
    // TODO: sitespeed.io uploads a single report to an S3 directory
    // TODO: sitespeed.io sends metrics to Grafana cloud

    let fargateTaskRunner;

    if (props.networking) {
      fargateTaskRunner = new tasks.EcsRunTask(this, `${configuration.COMMON.project}-run-fargate-task`, {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        securityGroups: [
          props.networking.securityGroup
        ],
        subnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          availabilityZones: ["us-east-1a"],
        },
        cluster: Cluster.fromClusterAttributes(this, 'Cluster', {
          clusterName: configuration.ANALYSIS.clusterName,
          vpc: props.networking.vpc
        }),
        taskDefinition,
        launchTarget: new tasks.EcsFargateLaunchTarget({platformVersion: FargatePlatformVersion.LATEST}),
        assignPublicIp: false,
        containerOverrides: [{
          containerDefinition,
          command: sfn.JsonPath.listAt('$.command')
        }],
        resultPath: '$.taskResult'
      });
    } else {
      // mocked fargate task runner
      fargateTaskRunner = new sfn.Pass(this, `${configuration.COMMON.project}-run-fargate-task`);
    }

    // Finalizer step to send email notifications
    const finalizeReport = new tasks.LambdaInvoke(this, `${configuration.COMMON.project}-finalize-report`, {
      lambdaFunction: this.reportFinalizerLambda,
      outputPath: '$.Payload'
    });

    const cleanupReport = new tasks.LambdaInvoke(this, `${configuration.COMMON.project}-cleanup-report`, {
      lambdaFunction: cleanupLambda,
      outputPath: '$.Payload'
    });

    // Define the state machine
    const definition = startState
      .next(generateTasks)
      .next(mapState.itemProcessor(initiateAnalysis.next(fargateTaskRunner)))
      .next(finalizeReport)
      .next(cleanupReport);

    const stateMachine = new sfn.StateMachine(this, `${configuration.COMMON.project}-state-machine`, {
      definitionBody: sfn.DefinitionBody.fromChainable(definition)
    });

    // Grant Lambda permissions to start Step Functions executions
    stateMachine.grantStartExecution(props.sqsTaskHandler);
    stateMachine.grantRead(props.sqsTaskHandler);

    // Add IAM role for Lambda to list Step Functions executions
    props.sqsTaskHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:ListExecutions'],
      resources: [stateMachine.stateMachineArn]
    }));

    // Set environment variable for sqsTaskHandler
    props.sqsTaskHandler.addEnvironment('STATE_MACHINE_ARN', stateMachine.stateMachineArn);
  }
}