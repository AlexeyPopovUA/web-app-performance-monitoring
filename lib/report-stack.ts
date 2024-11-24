import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {IFunction} from "aws-cdk-lib/aws-lambda";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";

import configuration from "../cfg/configuration";

type ReportStackProps = cdk.StackProps & {
  bucketClients: {
    // receives read/write permissions to the bucket
    finalReportWriter?: IFunction;
  }
}

export class ReportStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ReportStackProps) {
    super(scope, id, props);

    const reportBucket = new Bucket(this, `${configuration.COMMON.project}-report-bucket`, {
      bucketName: configuration.REPORTING.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    props.bucketClients.finalReportWriter && reportBucket.grantWrite(props.bucketClients.finalReportWriter);
  }
}
