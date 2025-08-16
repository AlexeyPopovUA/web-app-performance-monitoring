import {Construct} from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import * as core from "aws-cdk-lib/core";

type Props = {
  project: string;
  reportBucketName: string;
  temporaryReportBucketName: string;
  webAppBucketName: string;
}

export class S3BucketsConstruct extends Construct {
  public readonly reportBucket: s3.IBucket;
  public readonly temporaryReportBucket: s3.IBucket;
  public readonly webAppBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // Create report bucket with proper configuration for CloudFront access
    this.reportBucket = new s3.Bucket(this, `${props.project}-report-bucket`, {
      bucketName: props.reportBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Ensure content-type is set correctly for web serving
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          maxAge: 3000
        }
      ]
    });

    this.temporaryReportBucket = new s3.Bucket(this, `${props.project}-temporary-report-bucket`, {
      bucketName: props.temporaryReportBucketName,
      removalPolicy: core.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(1),
        },
      ],
    });

    // Create web app bucket for static hosting
    this.webAppBucket = new s3.Bucket(this, `${props.project}-web-app-bucket`, {
      bucketName: props.webAppBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable versioning for better deployment management
      versioned: true,
      // Configure CORS for web app access
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          maxAge: 3000
        }
      ]
    });
  }
}
