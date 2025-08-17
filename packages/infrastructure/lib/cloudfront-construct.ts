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
  webAppBucket: s3.IBucket;
  apiGateway: apigateway.RestApi;
  certificateArn: string;
}

export class CloudfrontConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly webAppDistribution: cloudfront.Distribution;

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

    // Create custom cache policy with 5-minute TTL for API
    const customCachePolicy = new cloudfront.CachePolicy(this, `${configuration.COMMON.project}-proxy-cache-policy`, {
      cachePolicyName: `${configuration.COMMON.project}-proxy-cache-policy`,
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.minutes(5),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization', 'Content-Type'),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Create cache policy for web app static assets
    const webAppCachePolicy = new cloudfront.CachePolicy(this, `${configuration.COMMON.project}-web-app-cache-policy`, {
      cachePolicyName: `${configuration.COMMON.project}-web-app-cache-policy`,
      defaultTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Create cache policy for web app HTML files
    const webAppHtmlCachePolicy = new cloudfront.CachePolicy(this, `${configuration.COMMON.project}-web-app-html-cache-policy`, {
      cachePolicyName: `${configuration.COMMON.project}-web-app-html-cache-policy`,
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.days(1),
      minTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Create API CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, `${configuration.COMMON.project}-proxy-cdn`, {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${props.apiGateway.restApiId}.execute-api.${props.env.region}.amazonaws.com`, {
          originPath: `/${props.apiGateway.deploymentStage.stageName}`,
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: customCachePolicy,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        originRequestPolicy: new cloudfront.OriginRequestPolicy(this, `${configuration.COMMON.project}-proxy-origin-request-policy`, {
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("x-api-key")
        })
      },
      additionalBehaviors: {
        '/reports/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.reportBucket, {
            originAccessLevels: [cloudfront.AccessLevel.READ, cloudfront.AccessLevel.LIST],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        }
      },
      domainNames: [configuration.HOSTING.domainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'index.html'
    });

    // Create Web App CloudFront distribution
    this.webAppDistribution = new cloudfront.Distribution(this, `${configuration.COMMON.project}-web-app-cdn`, {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.webAppBucket, {
          originPath: '/main', // Serve from main branch directory
          originAccessLevels: [cloudfront.AccessLevel.READ],
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: webAppHtmlCachePolicy,
      },
      additionalBehaviors: {
        // Cache static assets longer
        '/_next/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.webAppBucket, {
            originPath: '/main',
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: webAppCachePolicy,
        },
        // Cache other static assets
        '*.js': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.webAppBucket, {
            originPath: '/main',
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: webAppCachePolicy,
        },
        '*.css': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.webAppBucket, {
            originPath: '/main',
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: webAppCachePolicy,
        },
      },
      domainNames: [configuration.HOSTING.staticDomainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA fallback
        },
      ],
    });

    // DNS records for API distribution
    new route53.ARecord(this, `${configuration.COMMON.project}-reports-a-record`, {
      recordName: configuration.HOSTING.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-reports-aaaa-record`, {
      recordName: configuration.HOSTING.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution))
    });

    // // DNS records for Web App distribution
    // new route53.ARecord(this, `${configuration.COMMON.project}-web-app-a-record`, {
    //   recordName: configuration.HOSTING.staticDomainName,
    //   zone: hostedZone,
    //   target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.webAppDistribution))
    // });
    //
    // new route53.AaaaRecord(this, `${configuration.COMMON.project}-web-app-aaaa-record`, {
    //   recordName: configuration.HOSTING.staticDomainName,
    //   zone: hostedZone,
    //   target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.webAppDistribution))
    // });

    // Output the CloudFront URLs
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'The domain name of the API CloudFront distribution',
    });

    // new cdk.CfnOutput(this, 'WebAppDistributionDomainName', {
    //   value: this.webAppDistribution.distributionDomainName,
    //   description: 'The domain name of the Web App CloudFront distribution',
    // });
    //
    // new cdk.CfnOutput(this, 'WebAppDistributionId', {
    //   value: this.webAppDistribution.distributionId,
    //   description: 'The ID of the Web App CloudFront distribution',
    //   exportName: `${configuration.COMMON.project}-web-app-distribution-id`,
    // });
  }
}
