import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';

import {SqsConstruct} from "./task-processing-constructs/SqsConstruct";
//import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import {ClusterConstruct} from "./task-processing-constructs/ClusterConstruct";
import {ApiGatewayConstruct} from "./api-gateway-construct";
import {CloudfrontConstruct} from "./cloudfront-construct";
import {S3BucketsConstruct} from "./s3-buckets-construct";
import {VpcConstruct} from "./vpc-construct";

import configuration from "../cfg/configuration";

type MainStackProps = cdk.StackProps & {
  certificateArn: string;
}

export class MainStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const env = {
      account: configuration.COMMON.account,
      region: configuration.COMMON.region
    };

    const {vpc, securityGroup} = new VpcConstruct(this, `${configuration.COMMON.project}-VpcConstruct`, {
      project: configuration.COMMON.project,
      env,
      securityGroupName: configuration.NETWORKING.securityGroupName,
      vpcName: configuration.NETWORKING.vpcName
    });

    const sqsConstruct = new SqsConstruct(this, `${configuration.COMMON.project}-SqsConstruct`);

    const s3BucketsConstruct = new S3BucketsConstruct(this, `${configuration.COMMON.project}-S3BucketsConstruct`, {
      bucketName: configuration.REPORTING.bucketName,
      temporaryBucketName: configuration.REPORTING.temporaryBucketName,
      project: configuration.COMMON.project,
    });

    const apiConstruct = new ApiGatewayConstruct(this, `${configuration.COMMON.project}-APIGatewayConstruct`, {
      project: configuration.COMMON.project,
      taskQueue: sqsConstruct.taskQueue,
      env,
      reportBucket: s3BucketsConstruct.reportBucket,
      staticReportBasePath: configuration.REPORTING.staticReportBasePath,
    });

    const cloudFrontConstruct = new CloudfrontConstruct(this, `${configuration.COMMON.project}-CloudfrontConstruct`, {
      env,
      reportBucket: s3BucketsConstruct.reportBucket,
      apiGateway: apiConstruct.api,
      domainName: configuration.HOSTING.domainName,
      certificateArn: props.certificateArn
    });

    // const stateMachineConstruction = new StateMachineConstruct(this, `${configuration.COMMON.project}-StateMachineConstruct`, {
    //   sqsTaskHandler: sqsConstruct.sqsTaskHandler,
    //   env,
    //   networking: {
    //     vpc,
    //     securityGroup
    //   }
    // });

    // TODO Review this
    //this.finalizerRole = stateMachineConstruction.reportFinalizerLambda.role;
    //this.publicAPIRole = publicAPI.publicAPILambda.role;

    new ClusterConstruct(this, `${configuration.COMMON.project}-ClusterConstruct`, {
      networking: {
        vpc
      }
    })
  }
}