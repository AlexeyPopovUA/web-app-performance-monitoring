import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import type {IFunction} from "aws-cdk-lib/aws-lambda";

import configuration from "../../cfg/configuration";

export class PublicAPIGatewayConstruct extends Construct {
  public readonly  publicAPILambda: IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const publicGatewayProxyHandler = new lambda.Function(this, `${configuration.COMMON.project}-public-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      //handler: 'public-api-proxy-handler.handler',
      handler: 'lambda.handler',
      logRetention: logs.RetentionDays.ONE_DAY,
      code: lambda.Code.fromAsset('dist/public-api'),
      // important for the big amounts of S3 items
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        REPORTS_BUCKET_NAME: configuration.REPORTING.bucketName,
        REPORTS_DOMAIN_NAME: configuration.REPORTING.reportsDomainName,
        REGION: configuration.COMMON.region,
        // TODO Take from a parameter
        DEBUG: true ? "express:*" : ""
      }
    });

    this.publicAPILambda = publicGatewayProxyHandler;

    // Create API Gateway
    const api = new apigateway.RestApi(this, `${configuration.COMMON.project}-public-api`, {
      restApiName: 'Public API',
      description: 'This service handles all public requests'
    });

    const publicProxyIntegration = new apigateway.LambdaIntegration(publicGatewayProxyHandler);
    api.root.addProxy({anyMethod: true, defaultIntegration: publicProxyIntegration});

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    const certificate = new cert.Certificate(this, `${configuration.COMMON.project}-certificate`, {
      domainName: configuration.HOSTING.apiDomainName,
      validation: cert.CertificateValidation.fromDns(hostedZone)
    });

    const apiDomainName = new apigateway.DomainName(this, `${configuration.COMMON.project}-public-api-domain-name`, {
      domainName: configuration.HOSTING.apiDomainName,
      certificate
    });

    apiDomainName.addBasePathMapping(api);

    new route53.ARecord(this, `${configuration.COMMON.project}-public-api-domain-name-alias-record`, {
      recordName: configuration.HOSTING.apiDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomainName))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-public-api-domain-name-alias-record-ipv6`, {
      recordName: configuration.HOSTING.apiDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomainName))
    })
  }
}