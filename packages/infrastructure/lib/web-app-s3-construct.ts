import {Construct} from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";

type Props = {
  project: string;
  bucketName: string;
}

export class WebAppS3Construct extends Construct {
  public readonly webAppBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // Create web app bucket for static hosting
    this.webAppBucket = new s3.Bucket(this, `${props.project}-web-app-bucket`, {
      bucketName: props.bucketName,
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
