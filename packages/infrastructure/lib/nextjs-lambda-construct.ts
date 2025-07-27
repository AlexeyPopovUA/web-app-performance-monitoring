import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as path from 'path';
import * as fs from 'fs';

import configuration from "../cfg/configuration";

interface NextJsLambdaConstructProps {
  env: Required<cdk.Environment>;
  domainName: string;
  certificateArn: string;
  apiGatewayUrl: string;
}

export class NextJsLambdaConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly lambdaFunction: lambda.Function;
  public readonly staticAssetsBucket: s3.Bucket;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: NextJsLambdaConstructProps) {
    super(scope, id);

    // Import existing SSL certificate
    const certificate = acm.Certificate.fromCertificateArn(
      this, `${configuration.COMMON.project}-nextjs-certificate`, props.certificateArn
    );

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-nextjs-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    // Create ECR repository for container images
    this.ecrRepository = new ecr.Repository(this, `${configuration.COMMON.project}-nextjs-ecr`, {
      repositoryName: `${configuration.COMMON.project}-nextjs-lambda`,
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.KMS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // Check if Next.js build exists (for initial deployment)
    const webAppPath = path.join(__dirname, '../../web-app');
    const standalonePath = path.join(webAppPath, '.next/standalone');
    const hasStandaloneBuild = fs.existsSync(standalonePath);

    // Create Lambda function using container image
    this.lambdaFunction = hasStandaloneBuild 
      ? new lambda.Function(this, `${configuration.COMMON.project}-nextjs-lambda`, {
          functionName: `${configuration.COMMON.project}-nextjs-lambda`,
          code: lambda.Code.fromAssetImage(webAppPath, {
            cmd: ['lambda-adapter.handler'],
            file: 'Dockerfile',
          }),
          handler: lambda.Handler.FROM_IMAGE, // Required for container-based functions
          runtime: lambda.Runtime.FROM_IMAGE,  // Required for container-based functions
          timeout: cdk.Duration.seconds(30),
          memorySize: 1024,
          environment: {
            API_BASE_URL: props.apiGatewayUrl,
            NODE_ENV: 'production',
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
          },
        })
      : new lambda.Function(this, `${configuration.COMMON.project}-nextjs-lambda`, {
          functionName: `${configuration.COMMON.project}-nextjs-lambda`,
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline(`
            exports.handler = async (event) => {
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: '<h1>Next.js app not yet deployed. Run deployment workflow to build and push container image.</h1>'
              };
            };
          `),
          timeout: cdk.Duration.seconds(30),
          memorySize: 1024,
          environment: {
            API_BASE_URL: props.apiGatewayUrl,
            NODE_ENV: 'production',
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
          },
        });

    // Add Lambda Function URL
    const functionUrl = this.lambdaFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowCredentials: false,
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      },
    });

    // Create S3 bucket for static assets (_next/static/*)
    this.staticAssetsBucket = new s3.Bucket(this, `${configuration.COMMON.project}-nextjs-static-assets`, {
      bucketName: `${configuration.COMMON.project}-nextjs-static-assets`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3600,
      }],
    });

    // Create Origin Access Control for S3 bucket
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, `${configuration.COMMON.project}-nextjs-oac`, {
      originAccessControlName: `${configuration.COMMON.project}-nextjs-oac`,
      description: 'Origin Access Control for Next.js static assets',
    });

    // Create cache policy for Next.js pages with ISR
    const nextjsCachePolicy = new cloudfront.CachePolicy(this, `${configuration.COMMON.project}-nextjs-cache-policy`, {
      cachePolicyName: `${configuration.COMMON.project}-nextjs-cache-policy`,
      defaultTtl: cdk.Duration.seconds(0), // Let Next.js handle caching
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Accept',
        'Accept-Language',
        'Authorization',
        'CloudFront-Forwarded-Proto',
        'CloudFront-Viewer-Country',
        'Host',
        'Origin',
        'Referer',
        'User-Agent'
      ),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
    });

    // Create cache policy for static assets
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, `${configuration.COMMON.project}-static-cache-policy`, {
      cachePolicyName: `${configuration.COMMON.project}-static-cache-policy`,
      defaultTtl: cdk.Duration.days(30),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, `${configuration.COMMON.project}-nextjs-distribution`, {
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(functionUrl),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: nextjsCachePolicy,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        // Static assets from S3
        '/_next/static/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.staticAssetsBucket, {
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
        },
        // Public assets from S3 
        '/favicon.ico': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.staticAssetsBucket, {
            originAccessLevels: [cloudfront.AccessLevel.READ],
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
        },
      },
      domainNames: [props.domainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Create DNS record
    new route53.ARecord(this, `${configuration.COMMON.project}-nextjs-a-record`, {
      recordName: props.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-nextjs-aaaa-record`, {
      recordName: props.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution))
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'NextJsDistributionUrl', {
      value: this.distribution.distributionDomainName,
      description: 'Next.js CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'NextJsDomainUrl', {
      value: `https://${props.domainName}`,
      description: 'Next.js custom domain URL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionUrl', {
      value: functionUrl.url,
      description: 'Direct Lambda Function URL (for testing)',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Lambda function name for deployments',
      exportName: `${configuration.COMMON.project}-nextjs-lambda-name`,
    });

    // Export bucket name for deployment scripts
    new cdk.CfnOutput(this, 'StaticAssetsBucketName', {
      value: this.staticAssetsBucket.bucketName,
      description: 'S3 bucket name for Next.js static assets',
      exportName: `${configuration.COMMON.project}-static-assets-bucket`,
    });

    new cdk.CfnOutput(this, 'NextJsDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${configuration.COMMON.project}-nextjs-distribution-id`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR repository URI for Lambda container images',
      exportName: `${configuration.COMMON.project}-ecr-repository-uri`,
    });

    // Store parameters in SSM for CI/CD access
    new ssm.StringParameter(this, 'LambdaFunctionNameParam', {
      parameterName: `/${configuration.COMMON.project}/nextjs/lambda-function-name`,
      stringValue: this.lambdaFunction.functionName,
    });

    new ssm.StringParameter(this, 'StaticBucketNameParam', {
      parameterName: `/${configuration.COMMON.project}/nextjs/static-bucket-name`,
      stringValue: this.staticAssetsBucket.bucketName,
    });

    new ssm.StringParameter(this, 'DistributionIdParam', {
      parameterName: `/${configuration.COMMON.project}/nextjs/distribution-id`,
      stringValue: this.distribution.distributionId,
    });

    new ssm.StringParameter(this, 'ECRRepositoryUriParam', {
      parameterName: `/${configuration.COMMON.project}/nextjs/ecr-repository-uri`,
      stringValue: this.ecrRepository.repositoryUri,
    });
  }
}
