import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class TaskProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create SQS queue
    const queue = new sqs.Queue(this, 'TaskQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1)
    });

    // Create Lambda function for handling API requests
    const taskHandler = new lambda.Function(this, 'TaskHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'task-handler.handler',
      code: lambda.Code.fromAsset('dist/task-handler'),
      environment: {
        QUEUE_URL: queue.queueUrl
      }
    });

    // Grant Lambda permissions to interact with SQS
    queue.grantConsumeMessages(taskHandler);

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, 'StartState');
    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(startState)
    });

    // Grant Lambda permissions to start Step Functions executions
    stateMachine.grantStartExecution(taskHandler);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'TaskApi', {
      restApiName: 'Task Service',
      description: 'This service handles task requests.'
    });

    const taskResource = api.root.addResource('request');
    const taskIntegration = new apigateway.LambdaIntegration(taskHandler);
    taskResource.addMethod('POST', taskIntegration);

    // Add IAM role for Lambda to list Step Functions executions
    taskHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:ListExecutions'],
      resources: [stateMachine.stateMachineArn]
    }));

    // Create Lambda function for polling SQS
    const sqsPoller = new lambda.Function(this, 'SQSPoller', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sqs-poller.handler',
      code: lambda.Code.fromAsset('dist/sqs-poller'),
      environment: {
        QUEUE_URL: queue.queueUrl,
        STATE_MACHINE_ARN: stateMachine.stateMachineArn
      }
    });

    // Grant Lambda permissions to interact with SQS and Step Functions
    queue.grantConsumeMessages(sqsPoller);
    stateMachine.grantStartExecution(sqsPoller);
    stateMachine.grantRead(sqsPoller);

    // Add SQS event source to the poller Lambda
    sqsPoller.addEventSource(new eventSources.SqsEventSource(queue, {batchSize: 1}));
  }
}