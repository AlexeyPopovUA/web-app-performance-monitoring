import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import configuration from "../cfg/configuration";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, `${configuration.COMMON.project}-ecs-vpc`, {
      vpcName: configuration.NETWORKING.vpcName,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: configuration.NETWORKING.enableNetworkEgress ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
      natGateways: configuration.NETWORKING.enableNetworkEgress ? 1 : 0,
    });

    // security group with all outbound traffic allowed
    this.securityGroup = new ec2.SecurityGroup(this, `${configuration.COMMON.project}-ecs-sg`, {
      securityGroupName: configuration.NETWORKING.securityGroupName,
      vpc: this.vpc,
      allowAllOutbound: true,
    });
  }
}