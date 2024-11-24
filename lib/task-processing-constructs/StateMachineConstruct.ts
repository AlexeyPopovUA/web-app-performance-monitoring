import {Construct} from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {RemovalPolicy} from "aws-cdk-lib/core";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

import configuration from "../../cfg/configuration";
import {IFunction} from "aws-cdk-lib/aws-lambda";

export class StateMachineConstruct extends Construct {
  public readonly reportFinalizerLambda: IFunction;

  constructor(scope: Construct, id: string, sqsTaskHandler: lambda.Function) {
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
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'task-generator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/task-generator-step')
    });

    const analysisInitiatorLambda = new lambda.Function(this, `${configuration.COMMON.project}-analysis-initiator`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'analysis-initiator-step.handler',
      code: lambda.Code.fromAsset('dist/steps/analysis-initiator-step')
    });

    const cleanupLambda = new lambda.Function(this, `${configuration.COMMON.project}-cleanup`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'cleanup-step.handler',
      code: lambda.Code.fromAsset('dist/steps/cleanup-step')
    });

    this.reportFinalizerLambda = new lambda.Function(this, `${configuration.COMMON.project}-report-finalizer`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'report-finalizer-step.handler',
      code: lambda.Code.fromAsset('dist/steps/report-finalizer-step')
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

    // TODO: Task to process each item in the map state. Initiates and waits a Fargate task to finish
    // TODO: sitespeed.io uploads a single report to an S3 directory
    // TODO: sitespeed.io sends metrics to Grafana cloud
    const fargateTaskRunner = new sfn.Pass(this, `${configuration.COMMON.project}-run-fargate-task`);

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
    stateMachine.grantStartExecution(sqsTaskHandler);
    stateMachine.grantRead(sqsTaskHandler);

    // Add IAM role for Lambda to list Step Functions executions
    sqsTaskHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:ListExecutions'],
      resources: [stateMachine.stateMachineArn]
    }));

    // Set environment variable for sqsTaskHandler
    sqsTaskHandler.addEnvironment('STATE_MACHINE_ARN', stateMachine.stateMachineArn);
  }
}