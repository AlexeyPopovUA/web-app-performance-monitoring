import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import {RetentionDays} from "aws-cdk-lib/aws-logs";

import configuration from "../../cfg/configuration";

export class SqsConstruct extends Construct {
  public readonly taskQueue: sqs.Queue;
  public readonly sqsTaskHandler: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create SQS queue
    this.taskQueue = new sqs.Queue(this, `${configuration.COMMON.project}-task-queue`, {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1)
    });

    // Create Lambda function for polling SQS
    this.sqsTaskHandler = new lambda.Function(this, `${configuration.COMMON.project}-sqs-task-handler`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: RetentionDays.ONE_DAY,
      handler: 'sqs-task-handler.handler',
      code: lambda.Code.fromAsset('dist/sqs-task-handler'),
      environment: {
        QUEUE_URL: this.taskQueue.queueUrl
      }
    });

    // Grant Lambda permissions to interact with SQS
    this.taskQueue.grantConsumeMessages(this.sqsTaskHandler);

    // Add SQS event source to the poller Lambda
    this.sqsTaskHandler.addEventSource(new eventSources.SqsEventSource(this.taskQueue, {batchSize: 1}));
  }
}