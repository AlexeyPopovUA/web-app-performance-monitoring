import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";

import {SqsConstruct} from "./task-processing-constructs/SqsConstruct";
import {APIGatewayConstruct} from "./task-processing-constructs/APIGatewayConstruct";
import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import {ClusterConstruct} from "./task-processing-constructs/ClusterConstruct";
import configuration from "../cfg/configuration";

type TaskProcessingStackProps = cdk.StackProps & {
  env: {
    region: string;
    account: string;
  },
}

export class TaskProcessingStack extends cdk.Stack {
  public readonly finalizerRole: iam.IRole | undefined;

  constructor(scope: Construct, id: string, props: TaskProcessingStackProps) {
    super(scope, id, props);

    let vpc, securityGroup;

    vpc = ec2.Vpc.fromLookup(this, `${configuration.COMMON.project}-VPC`, {
      vpcName: configuration.NETWORKING.vpcName,
      region: props.env.region
    });

    securityGroup = ec2.SecurityGroup.fromLookupByName(this, `${configuration.COMMON.project}-SecurityGroup`, configuration.NETWORKING.securityGroupName, vpc);

    const sqsConstruct = new SqsConstruct(this, `${configuration.COMMON.project}-SqsConstruct`);

    new APIGatewayConstruct(this, `${configuration.COMMON.project}-APIGatewayConstruct`, sqsConstruct.taskQueue);

    const stateMachineConstruction = new StateMachineConstruct(this, `${configuration.COMMON.project}-StateMachineConstruct`, {
      sqsTaskHandler: sqsConstruct.sqsTaskHandler,
      env: {
        region: props.env.region,
        account: props.env.account
      },
      networking: {
        vpc,
        securityGroup
      }
    });

    this.finalizerRole = stateMachineConstruction.reportFinalizerLambda.role;

    new ClusterConstruct(this, `${configuration.COMMON.project}-ClusterConstruct`, {
      networking: {
        vpc
      }
    })
  }
}