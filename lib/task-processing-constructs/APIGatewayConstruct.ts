import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import configuration from "../../cfg/configuration";

export class APIGatewayConstruct extends Construct {
  constructor(scope: Construct, id: string, taskQueueUrl: string) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const gatewayProxyHandler = new lambda.Function(this, `${configuration.COMMON.project}-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'gateway-proxy-handler.handler',
      code: lambda.Code.fromAsset('dist/gateway-proxy-handler'),
      environment: {
        QUEUE_URL: taskQueueUrl
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
  }
}