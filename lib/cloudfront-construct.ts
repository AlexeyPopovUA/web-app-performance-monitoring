import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";

import configuration from "../cfg/configuration";

interface CloudFrontConstructProps {
  env: Required<cdk.Environment>
  reportBucket: s3.IBucket;
  apiGateway: apigateway.RestApi;
  domainName: string;
  certificateArn: string;
}

export class CloudfrontConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CloudFrontConstructProps) {
    super(scope, id);

    // Import existing SSL certificate
    const certificate = acm.Certificate.fromCertificateArn(
      this, `${configuration.COMMON.project}-proxy-cdn-certificate`, props.certificateArn
    );

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, `${configuration.COMMON.project}-proxy-cdn`, {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${props.apiGateway.restApiId}.execute-api.${props.env.region}.amazonaws.com`, {
          originPath: `/${props.apiGateway.deploymentStage.stageName}`,
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      domainNames: [props.domainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Add S3 bucket as origin with OAC
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(props.reportBucket, {
      originAccessLevels: [cloudfront.AccessLevel.READ, cloudfront.AccessLevel.LIST],
    });

    distribution.addBehavior('/reports/*',
      s3Origin,
      {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      }
    );

    // Remove manual bucket policy, let CDK manage OAC permissions
    // (No custom bucketPolicy or addToResourcePolicy here)

    new route53.ARecord(this, `${configuration.COMMON.project}-reports-a-record`, {
      recordName: configuration.HOSTING.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-reports-aaaa-record`, {
      recordName: configuration.HOSTING.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution))
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'The domain name of the CloudFront distribution',
    });
  }
}
