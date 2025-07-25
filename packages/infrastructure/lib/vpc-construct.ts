import {Construct} from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";

type Props = {
  project: string;
  env: Required<cdk.Environment>
  securityGroupName: string;
  vpcName: string;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    this.vpc = ec2.Vpc.fromLookup(this, `${props.project}-VPC`, {
      vpcName: props.vpcName,
      region: props.env.region
    });

    this.securityGroup = ec2.SecurityGroup.fromLookupByName(this, `${props.project}-SecurityGroup`, props.securityGroupName, this.vpc);
  }
}