import {Construct} from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as iam from "aws-cdk-lib/aws-iam";

import configuration from "../cfg/configuration";

type ReportStackProps = cdk.StackProps & {
  bucketClients: {
    // receives read/write permissions to the bucket
    finalReportWriterRole?: iam.IRole;
    publicAPIRole?: iam.IRole;
  }
}

export class ReportStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ReportStackProps) {
    super(scope, id, props);

    const reportBucket = new s3.Bucket(this, `${configuration.COMMON.project}-report-bucket`, {
      bucketName: configuration.REPORTING.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    props.bucketClients.finalReportWriterRole && reportBucket.grantWrite(props.bucketClients.finalReportWriterRole);
    props.bucketClients.publicAPIRole && reportBucket.grantRead(props.bucketClients.publicAPIRole);

    const originAccessIdentity = new cf.OriginAccessIdentity(this, `${configuration.COMMON.project}-reports-origin-access-identity`);
    reportBucket.grantRead(originAccessIdentity);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    const certificate = new cert.Certificate(this, `${configuration.COMMON.project}-reports-certificate`, {
      domainName: configuration.REPORTING.reportsDomainName,
      validation: cert.CertificateValidation.fromDns(hostedZone)
    });

    const distribution = new cf.Distribution(this, `${configuration.COMMON.project}-reports-distribution`, {
      // comment contains the distribution name
      comment: `${configuration.COMMON.project}-main reports distribution`,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      certificate: certificate,
      enableIpv6: true,
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableLogging: false,
      enabled: true,
      domainNames: [
        configuration.REPORTING.reportsDomainName,
      ],
      defaultBehavior: {
        allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cf.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: cfOrigins.S3BucketOrigin.withOriginAccessIdentity(reportBucket, {
          originAccessIdentity: originAccessIdentity,
          originShieldRegion: props.env?.region,
          originPath: "/"
        })
      }
    });

    new route53.ARecord(this, `${configuration.COMMON.project}-reports-a-record`, {
      recordName: configuration.REPORTING.reportsDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution))
    });

    new route53.AaaaRecord(this, `${configuration.COMMON.project}-reports-aaaa-record`, {
      recordName: configuration.REPORTING.reportsDomainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution))
    });
  }
}
