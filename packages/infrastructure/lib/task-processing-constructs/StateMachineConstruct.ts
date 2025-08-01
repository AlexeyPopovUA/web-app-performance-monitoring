import {Construct} from 'constructs';
import * as cdk from "aws-cdk-lib";
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as core from "aws-cdk-lib/core";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import configuration from "../../cfg/configuration";

type Props = {
  temporaryReportBucket: s3.IBucket;
  reportBucket: s3.IBucket;
  env: Required<cdk.Environment>,
  networking: {
    vpc: ec2.IVpc;
    securityGroup: ec2.ISecurityGroup;
  }
}

export class StateMachineConstruct extends Construct {
  // Expose the state machine so we can access its ARN
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, `${configuration.COMMON.project}-start-state`);

    const taskGeneratorLambda = new lambda.Function(this, `${configuration.COMMON.project}-task-generator`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logGroup: new logs.LogGroup(this, `${configuration.COMMON.project}-task-generator-logs`, {
        retention: logs.RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
      handler: 'task-generator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/task-generator-step')
    });

    const analysisInitiatorLambda = new lambda.Function(this, `${configuration.COMMON.project}-analysis-initiator`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logGroup: new logs.LogGroup(this, `${configuration.COMMON.project}-analysis-initiator-logs`, {
        retention: logs.RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
      handler: 'analysis-initiator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/analysis-initiator-step'),
      environment: {
        TEMPORARY_BUCKET_NAME: configuration.REPORTING.temporaryBucketName,
        TEMPORARY_BUCKET_REGION: props.env.region,
        DOMAIN_NAME_RELAY: configuration.NETWORKING.grafana.graphite.DOMAIN_NAME_RELAY
      }
    });

    const cleanupLambda = new lambda.Function(this, `${configuration.COMMON.project}-cleanup`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logGroup: new logs.LogGroup(this, `${configuration.COMMON.project}-cleanup-logs`, {
        retention: logs.RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
      handler: 'cleanup-step.handler',
      code: lambda.Code.fromAsset('dist/steps/cleanup-step'),
      timeout: core.Duration.minutes(5),
      environment: {
        TEMPORARY_BUCKET_NAME: configuration.REPORTING.temporaryBucketName
      }
    });

    props.temporaryReportBucket.grantReadWrite(cleanupLambda);

    const reportFinalizerLambda = new lambda.Function(this, `${configuration.COMMON.project}-report-finalizer`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      logGroup: new logs.LogGroup(this, `${configuration.COMMON.project}-report-finalizer-logs`, {
        retention: logs.RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }),
      handler: 'report-finalizer-step.handler',
      code: lambda.Code.fromAsset('dist/steps/report-finalizer-step'),
      timeout: core.Duration.minutes(5),
      memorySize: 256,
      environment: {
        REPORT_BUCKET_NAME: configuration.REPORTING.bucketName,
        TEMPORARY_BUCKET_NAME: configuration.REPORTING.temporaryBucketName
      }
    });

    props.temporaryReportBucket.grantRead(reportFinalizerLambda);
    props.reportBucket.grantWrite(reportFinalizerLambda);

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

    props.temporaryReportBucket.grantReadWrite(taskDefinition.taskRole);

    const graphiteAuthSecret = ecs.Secret.fromSecretsManager(
      new secretsmanager.Secret(this, `${configuration.COMMON.project}-graphite-auth-secret`, {
        secretName: configuration.NETWORKING.grafana.graphite.authSecretName,
      })
    );

    // Add container to the task definition
    const containerDefinition = taskDefinition.addContainer(`${configuration.COMMON.project}-sitespeedio-container`, {
      image: ecs.ContainerImage.fromRegistry('sitespeedio/sitespeed.io:37.8.0-plus1'),
      memoryLimitMiB: 8192,
      cpu: 4096,
      command: ['https://example.com', '--summary'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `${configuration.COMMON.project}-sitespeedio-container`,
        logGroup: new logs.LogGroup(this, `${configuration.COMMON.project}-sitespeedio-container-logs`, {
          retention: logs.RetentionDays.ONE_DAY,
          removalPolicy: cdk.RemovalPolicy.DESTROY
        })
      }),
      secrets: {
        GRAPHITE_AUTH_1: graphiteAuthSecret
      }
    });

    const fargateTaskRunner = new tasks.EcsRunTask(this, `${configuration.COMMON.project}-run-fargate-task`, {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      securityGroups: [
        props.networking.securityGroup
      ],
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: ["us-east-1a"],
      },
      cluster: ecs.Cluster.fromClusterAttributes(this, 'Cluster', {
        clusterName: configuration.ANALYSIS.clusterName,
        vpc: props.networking.vpc
      }),
      taskDefinition,
      launchTarget: new tasks.EcsFargateLaunchTarget({platformVersion: ecs.FargatePlatformVersion.LATEST}),
      assignPublicIp: false,
      containerOverrides: [{
        containerDefinition,
        command: sfn.JsonPath.listAt('$.command')
      }],
      resultPath: '$.taskResult'
    });

    // Finalizer step to send email notifications
    const finalizeReport = new tasks.LambdaInvoke(this, `${configuration.COMMON.project}-finalize-report`, {
      lambdaFunction: reportFinalizerLambda,
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

    this.stateMachine = new sfn.StateMachine(this, `${configuration.COMMON.project}-state-machine`, {
      definitionBody: sfn.DefinitionBody.fromChainable(definition)
    });
  }
}