import {Construct} from 'constructs';
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
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
    const cluster = new ecs.Cluster(this, `${configuration.COMMON.project}-ecs-cluster`, {
      clusterName: configuration.ANALYSIS.clusterName,
      vpc: props.networking.vpc
    });

    // TODO Extract the relay service into a separate construct

    const relaySecurityGroup = new ec2.SecurityGroup(this, `${configuration.COMMON.project}-carbon-relay-sg`, {
      vpc: props.networking.vpc,
      allowAllOutbound: true,
      description: `${configuration.COMMON.project} SG for the relay service`
    });

    relaySecurityGroup.addIngressRule(
      ec2.Peer.ipv4("10.0.0.0/16"),
      ec2.Port.tcp(2003),
      "Allow inbound TCP:2003 traffic from VPC subnet CIDR to the carbon relay plaintext input"
    );

    // Define the task definition
    const serviceTaskDefinition = new ecs.FargateTaskDefinition(this, `${configuration.COMMON.project}-CarbonRelayNgTaskDef`, {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Add container to the task definition
    const container = serviceTaskDefinition.addContainer(`${configuration.COMMON.project}-CarbonRelayNgContainer`, {
      image: ecs.ContainerImage.fromAsset('./carbon-relay'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'CarbonRelayNg',
        logRetention: logs.RetentionDays.ONE_DAY
      })
    });

    container.addPortMappings({
      containerPort: 2003,
      protocol: ecs.Protocol.TCP
    });

    if (!configuration.COMMON.idleMode) {
      // Create the ECS service
      new ecs.FargateService(this, `${configuration.COMMON.project}-CarbonRelayNgService`, {
        cluster: cluster,
        taskDefinition: serviceTaskDefinition,
        desiredCount: 1,
        enableECSManagedTags: true,
        assignPublicIp: false,
        securityGroups: [relaySecurityGroup],
        vpcSubnets: props.networking.vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        }),
        cloudMapOptions: {
          dnsRecordType: servicediscovery.DnsRecordType.A,
          name: `service`, // creates A record "sevice.carbon.performance" in the private hosted zone "carbon.performance" that points to alive service tasks
          cloudMapNamespace: new servicediscovery.PrivateDnsNamespace(this, `${configuration.COMMON.project}-carbon-relay-dns-namespace`, {
            vpc: props.networking.vpc,
            name: configuration.NETWORKING.grafana.graphite.DOMAIN_NAME_RELAY
          })
        }
      });
    }
  }
}
