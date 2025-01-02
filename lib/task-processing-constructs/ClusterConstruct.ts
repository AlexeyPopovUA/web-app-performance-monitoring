import {Construct} from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

import configuration from "../../cfg/configuration";

type ClusterConstructProps = cdk.StackProps & {
  networking: {
    vpc: ec2.IVpc;
  }
}

export class ClusterConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ClusterConstructProps) {
    super(scope, id);

    // Create an ECS cluster
    new ecs.Cluster(this, `${configuration.COMMON.project}-ecs-cluster`, {
      clusterName: configuration.ANALYSIS.clusterName,
      vpc: props.networking.vpc
    });
  }
}
