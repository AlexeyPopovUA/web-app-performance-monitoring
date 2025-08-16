import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';

import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import {ClusterConstruct} from "./task-processing-constructs/ClusterConstruct";
import {ApiGatewayConstruct} from "./api-gateway-construct";
import {CloudfrontConstruct} from "./cloudfront-construct";
import {S3BucketsConstruct} from "./s3-buckets-construct";
import {WebAppS3Construct} from "./web-app-s3-construct";
import {VpcConstruct} from "./vpc-construct";

import configuration from "../cfg/configuration";

type MainStackProps = cdk.StackProps & {
  certificateArn: string;
}

export class MainStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const env: Required<cdk.Environment> = {
      account: configuration.COMMON.account,
      region: configuration.COMMON.region
    };

    const {vpc, securityGroup} = new VpcConstruct(this, `${configuration.COMMON.project}-VpcConstruct`, {
      project: configuration.COMMON.project,
      env,
      securityGroupName: configuration.NETWORKING.securityGroupName,
      vpcName: configuration.NETWORKING.vpcName
    });

    const s3BucketsConstruct = new S3BucketsConstruct(this, `${configuration.COMMON.project}-S3BucketsConstruct`, {
      bucketName: configuration.REPORTING.bucketName,
      temporaryBucketName: configuration.REPORTING.temporaryBucketName,
      project: configuration.COMMON.project,
    });

    // Create web app S3 bucket
    const webAppS3Construct = new WebAppS3Construct(this, `${configuration.COMMON.project}-WebAppS3Construct`, {
      project: configuration.COMMON.project,
      bucketName: `${configuration.COMMON.project}-web-app-hosting`,
    });

    const stateMachineConstruction = new StateMachineConstruct(this, `${configuration.COMMON.project}-StateMachineConstruct`, {
      env,
      temporaryReportBucket: s3BucketsConstruct.temporaryReportBucket,
      reportBucket: s3BucketsConstruct.reportBucket,
      networking: {
        vpc,
        securityGroup
      }
    });

    const apiConstruct = new ApiGatewayConstruct(this, `${configuration.COMMON.project}-APIGatewayConstruct`, {
      project: configuration.COMMON.project,
      env,
      reportBucket: s3BucketsConstruct.reportBucket,
      staticReportBaseURL: configuration.REPORTING.staticReportBaseURL,
      stateMachineArn: stateMachineConstruction.stateMachine.stateMachineArn,
      apiKey: configuration.SECURITY.apiKey
    });

    const cloudFrontConstruct = new CloudfrontConstruct(this, `${configuration.COMMON.project}-CloudfrontConstruct`, {
      env,
      reportBucket: s3BucketsConstruct.reportBucket,
      webAppBucket: webAppS3Construct.webAppBucket,
      apiGateway: apiConstruct.api,
      domainName: configuration.HOSTING.domainName,
      webAppDomainName: configuration.HOSTING.staticDomainName,
      certificateArn: props.certificateArn
    });

    new ClusterConstruct(this, `${configuration.COMMON.project}-ClusterConstruct`, {
      networking: {
        vpc
      }
    });

    // Store deployment parameters in SSM for GitHub Actions
    new ssm.StringParameter(this, `${configuration.COMMON.project}-web-app-bucket-param`, {
      parameterName: '/web-perf-mon/web-app/bucket-name',
      stringValue: webAppS3Construct.webAppBucket.bucketName,
      description: 'S3 bucket name for web app hosting',
    });

    new ssm.StringParameter(this, `${configuration.COMMON.project}-web-app-distribution-param`, {
      parameterName: '/web-perf-mon/web-app/distribution-id',
      stringValue: cloudFrontConstruct.webAppDistribution.distributionId,
      description: 'CloudFront distribution ID for web app',
    });

    // Export bucket name for cross-stack reference
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: webAppS3Construct.webAppBucket.bucketName,
      description: 'S3 bucket name for web app hosting',
      exportName: `${configuration.COMMON.project}-web-app-bucket-name`,
    });
  }
}