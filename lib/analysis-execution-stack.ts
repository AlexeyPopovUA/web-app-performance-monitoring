import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {Secret} from "aws-cdk-lib/aws-secretsmanager";

import configuration from "../cfg/configuration";
import {PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";

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

    // security group with all outbound traffic allowed
    new ec2.SecurityGroup(this, `${configuration.COMMON.project}-ecs-sg`, {
      vpc,
      allowAllOutbound: true,
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
      executionRole: new Role(this, `${configuration.COMMON.project}-sitespeedio-task-execution-role`, {
        roleName: `${configuration.COMMON.project}-sitespeedio-task-execution-role`,
        assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
        managedPolicies: [
          {
            managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
          }
        ],
      }),
    });

    // Create a Docker Hub secret
    const dockerHubSecret = Secret.fromSecretNameV2(this, 'DockerHubSecret', 'docker-hub-secret');

    //dockerHubSecret.grantRead(taskDefinition.taskRole);
    taskDefinition.executionRole && taskDefinition.executionRole.addToPrincipalPolicy(PolicyStatement.fromJson({
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        dockerHubSecret.secretArn
      ]
    }));
    taskDefinition.executionRole && dockerHubSecret.grantRead(taskDefinition.executionRole);

    // Add container to the task definition
    taskDefinition.addContainer(`${configuration.COMMON.project}-sitespeedio-container`, {
      image: ecs.ContainerImage.fromRegistry('sitespeedio/sitespeed.io:35.6.1', {
        //credentials: dockerHubSecret
      }),
      memoryLimitMiB: 8192,
      cpu: 4096,
      //command: ['/start.sh', '--help']
      command: ['echo', 'Hello, World!'],
    });
  }
}