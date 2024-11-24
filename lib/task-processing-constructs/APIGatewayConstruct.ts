import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {Queue} from "aws-cdk-lib/aws-sqs/lib/queue";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

import configuration from "../../cfg/configuration";

export class APIGatewayConstruct extends Construct {
  constructor(scope: Construct, id: string, taskQueue: Queue) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const gatewayProxyHandler = new lambda.Function(this, `${configuration.COMMON.project}-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'gateway-proxy-handler.handler',
      logRetention: RetentionDays.ONE_DAY,
      code: lambda.Code.fromAsset('dist/gateway-proxy-handler'),
      environment: {
        QUEUE_URL: taskQueue.queueUrl
      }
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, `${configuration.COMMON.project}-task-api`, {
      restApiName: 'Task Service',
      description: 'This service handles task requests.'
    });

    const taskResource = api.root.addResource('request');
    const taskIntegration = new apigateway.LambdaIntegration(gatewayProxyHandler);
    taskResource.addMethod('POST', taskIntegration);

    taskQueue.grantSendMessages(gatewayProxyHandler);
  }
}