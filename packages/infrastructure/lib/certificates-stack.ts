import {Construct} from "constructs";
import * as cdk from 'aws-cdk-lib';
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import configuration from "../cfg/configuration";

export class CertificatesStack extends cdk.NestedStack {
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-HostedZone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    const certificate = new cert.Certificate(this, `${configuration.COMMON.project}-Certificate`, {
      domainName: `*.perf-mon.examples.${configuration.HOSTING.hostedZoneName}`, // Wildcard for all perf-mon subdomains
      subjectAlternativeNames: [
        configuration.HOSTING.domainName,
        configuration.HOSTING.staticDomainName
      ],
      validation: cert.CertificateValidation.fromDns(hostedZone)
    });

    this.certificateArn = certificate.certificateArn;
  }
}