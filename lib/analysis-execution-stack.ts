import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import configuration from "../cfg/configuration";

export class AnalysisExecutionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    // const vpc = ec2.Vpc.fromVpcAttributes(this, `${configuration.COMMON.project}-ecs-vpc`, {
    //   availabilityZones: configuration.NETWORKING.availabilityZones,
    //   vpcId: configuration.NETWORKING.vpcId,
    //   region: props!.env!.region,
    // });

    const vpc = new ec2.Vpc(this, `${configuration.COMMON.project}-ecs-vpc`, {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    // Create an ECS cluster
    new ecs.Cluster(this, `${configuration.COMMON.project}-ecs-cluster`, {
      clusterName: configuration.ANALYSIS.clusterName,
      vpc
    });

    // Define a task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${configuration.COMMON.project}-sitespeedio-task-def`, {
      family: configuration.ANALYSIS.taskFamily,
      cpu: 4096,
      memoryLimitMiB: 8192,
    });

    // Add container to the task definition
    taskDefinition.addContainer(`${configuration.COMMON.project}-sitespeedio-container`, {
      image: ecs.ContainerImage.fromRegistry('sitespeedio/sitespeed.io:35.6.1'),
      memoryLimitMiB: 8192,
      cpu: 4096,
      //command: ['/start.sh', '--help']
      command: ['echo "Hello, World!"']
    });
  }
}