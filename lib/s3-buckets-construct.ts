import {Construct} from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import * as core from "aws-cdk-lib/core";

type Props = {
  project: string;
  bucketName: string;
  temporaryBucketName: string;
}

export class S3BucketsConstruct extends Construct {
  public readonly reportBucket: s3.IBucket;
  public readonly temporaryReportBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    this.reportBucket = new s3.Bucket(this, `${props.project}-report-bucket`, {
      bucketName: props.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    this.temporaryReportBucket = new s3.Bucket(this, `${props.project}-temporary-report-bucket`, {
      bucketName: props.temporaryBucketName,
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
  }
}