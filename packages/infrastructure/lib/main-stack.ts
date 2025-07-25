import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';

import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import {ClusterConstruct} from "./task-processing-constructs/ClusterConstruct";
import {ApiGatewayConstruct} from "./api-gateway-construct";
import {CloudfrontConstruct} from "./cloudfront-construct";
import {NextJsLambdaConstruct} from "./nextjs-lambda-construct";
import {S3BucketsConstruct} from "./s3-buckets-construct";
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
      apiGateway: apiConstruct.api,
      domainName: configuration.HOSTING.domainName,
      certificateArn: props.certificateArn
    });


    new ClusterConstruct(this, `${configuration.COMMON.project}-ClusterConstruct`, {
      networking: {
        vpc
      }
    });

    // Next.js web application hosting
    new NextJsLambdaConstruct(this, `${configuration.COMMON.project}-NextJsLambdaConstruct`, {
      env,
      domainName: configuration.HOSTING.staticDomainName, // Using static domain for the web app
      certificateArn: props.certificateArn,
      apiGatewayUrl: `https://${configuration.HOSTING.domainName}` // API domain
    });
  }
}