import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import configuration from "../cfg/configuration";

export class TaskProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create SQS queue
    const taskQueue = new sqs.Queue(this, `${configuration.COMMON.project}-task-queue`, {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1)
    });

    // Create Lambda function for handling API requests
    const gatewayProxyHandler = new lambda.Function(this, `${configuration.COMMON.project}-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'gateway-proxy-handler.handler',
      code: lambda.Code.fromAsset('dist/gateway-proxy-handler'),
      environment: {
        QUEUE_URL: taskQueue.queueUrl
      }
    });

    // Grant Lambda permissions to interact with SQS
    taskQueue.grantSendMessages(gatewayProxyHandler);

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, `${configuration.COMMON.project}-start-state`);
    const stateMachine = new sfn.StateMachine(this, `${configuration.COMMON.project}-state-machine`, {
      definitionBody: sfn.DefinitionBody.fromChainable(startState)
    });

    // Grant Lambda permissions to start Step Functions executions
    stateMachine.grantStartExecution(gatewayProxyHandler);

    // Create API Gateway
    const api = new apigateway.RestApi(this, `${configuration.COMMON.project}-task-api`, {
      restApiName: 'Task Service',
      description: 'This service handles task requests.'
    });

    const taskResource = api.root.addResource('request');
    const taskIntegration = new apigateway.LambdaIntegration(gatewayProxyHandler);
    taskResource.addMethod('POST', taskIntegration);

    // Add IAM role for Lambda to list Step Functions executions
    gatewayProxyHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:ListExecutions'],
      resources: [stateMachine.stateMachineArn]
    }));

    // Create Lambda function for polling SQS
    const sqsTaskHandler = new lambda.Function(this, `${configuration.COMMON.project}-sqs-task-handler`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sqs-task-handler.handler',
      code: lambda.Code.fromAsset('dist/sqs-task-handler'),
      environment: {
        QUEUE_URL: taskQueue.queueUrl,
        STATE_MACHINE_ARN: stateMachine.stateMachineArn
      }
    });

    // Grant Lambda permissions to interact with SQS and Step Functions
    taskQueue.grantConsumeMessages(sqsTaskHandler);
    stateMachine.grantStartExecution(sqsTaskHandler);
    stateMachine.grantRead(sqsTaskHandler);

    // Add SQS event source to the poller Lambda
    sqsTaskHandler.addEventSource(new eventSources.SqsEventSource(taskQueue, {batchSize: 1}));
  }
}