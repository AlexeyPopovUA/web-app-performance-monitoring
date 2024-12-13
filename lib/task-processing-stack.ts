import * as cdk from 'aws-cdk-lib';
import {IRole} from "aws-cdk-lib/aws-iam";
import {Construct} from 'constructs';
import {ISecurityGroup, IVpc, SecurityGroup, Vpc} from "aws-cdk-lib/aws-ec2";

import {SqsConstruct} from "./task-processing-constructs/SqsConstruct";
import {APIGatewayConstruct} from "./task-processing-constructs/APIGatewayConstruct";
import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import configuration from "../cfg/configuration";
import {ClusterConstruct} from "./task-processing-constructs/ClusterConstruct";

type TaskProcessingStackProps = cdk.StackProps & {
  env: {
    region: string;
    account: string;
  },
}

export class TaskProcessingStack extends cdk.Stack {
  public readonly finalizerRole: IRole | undefined;

  constructor(scope: Construct, id: string, props: TaskProcessingStackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'VPC', {
      vpcName: configuration.NETWORKING.vpcName,
      region: props.env.region
    });

    const securityGroup = SecurityGroup.fromLookupByName(this, 'SecurityGroup', configuration.NETWORKING.securityGroupName, vpc);

    const sqsConstruct = new SqsConstruct(this, `${configuration.COMMON.project}-SqsConstruct`);

    new APIGatewayConstruct(this, `${configuration.COMMON.project}-APIGatewayConstruct`, sqsConstruct.taskQueue);

    const stateMachineConstruction = new StateMachineConstruct(this, `${configuration.COMMON.project}-StateMachineConstruct`, {
      sqsTaskHandler: sqsConstruct.sqsTaskHandler,
      env: {
        region: props.env.region,
        account: props.env.account
      },
      vpc,
      securityGroup
    });

    this.finalizerRole = stateMachineConstruction.reportFinalizerLambda.role;

    new ClusterConstruct(this, `${configuration.COMMON.project}-ClusterConstruct`, {
      vpc
    })
  }
}