import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";

import configuration from "../../cfg/configuration";

export class APIGatewayConstruct extends Construct {
  constructor(scope: Construct, id: string, taskQueue: sqs.Queue) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const gatewayProxyHandler = new lambda.Function(this, `${configuration.COMMON.project}-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'gateway-proxy-handler.handler',
      logRetention: logs.RetentionDays.ONE_DAY,
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

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    const certificate = new cert.Certificate(this, `${configuration.COMMON.project}-certificate`, {
      domainName: configuration.HOSTING.taskApiDomainName,
      validation: cert.CertificateValidation.fromDns(hostedZone)
    });

    const apiDomainName = new apigateway.DomainName(this, `${configuration.COMMON.project}-api-domain-name`, {
      domainName: configuration.HOSTING.taskApiDomainName,
      certificate
    });

    apiDomainName.addBasePathMapping(api);

    new route53.ARecord(this, `${configuration.COMMON.project}-api-domain-name-alias-record`, {
      recordName: configuration.HOSTING.taskApiDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomainName))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-api-domain-name-alias-record-ipv6`, {
      recordName: configuration.HOSTING.taskApiDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomainName))
    })
  }
}