import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {
  AllowedMethods, CachedMethods,
  Distribution,
  HttpVersion, OriginAccessIdentity,
  PriceClass,
  SecurityPolicyProtocol, ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import {S3BucketOrigin} from "aws-cdk-lib/aws-cloudfront-origins";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {AaaaRecord, ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {CloudFrontTarget} from "aws-cdk-lib/aws-route53-targets";
import {IRole} from "aws-cdk-lib/aws-iam";

import configuration from "../cfg/configuration";

type ReportStackProps = cdk.StackProps & {
  bucketClients: {
    // receives read/write permissions to the bucket
    finalReportWriterRole?: IRole;
  }
}

export class ReportStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ReportStackProps) {
    super(scope, id, props);

    const reportBucket = new Bucket(this, `${configuration.COMMON.project}-report-bucket`, {
      bucketName: configuration.REPORTING.bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    props.bucketClients.finalReportWriterRole && reportBucket.grantWrite(props.bucketClients.finalReportWriterRole);

    const originAccessIdentity = new OriginAccessIdentity(this, `${configuration.COMMON.project}-reports-origin-access-identity`);
    reportBucket.grantRead(originAccessIdentity);

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, `${configuration.COMMON.project}-hosted-zone`, {
      hostedZoneId: configuration.HOSTING.hostedZoneID,
      zoneName: configuration.HOSTING.hostedZoneName
    });

    const certificate = new Certificate(this, `${configuration.COMMON.project}-reports-certificate`, {
      domainName: configuration.REPORTING.reportsDomainName,
      validation: CertificateValidation.fromDns(hostedZone)
    });

    const distribution = new Distribution(this, `${configuration.COMMON.project}-reports-distribution`, {
      // comment contains the distribution name
      comment: `${configuration.COMMON.project}-main reports distribution`,
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      certificate: certificate,
      enableIpv6: true,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      enableLogging: false,
      enabled: true,
      domainNames: [
        configuration.REPORTING.reportsDomainName,
      ],
      defaultBehavior: {
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: S3BucketOrigin.withOriginAccessIdentity(reportBucket, {
          originAccessIdentity: originAccessIdentity,
          originShieldRegion: props.env?.region,
          originPath: "/"
        })
      }
    });

    new ARecord(this, `${configuration.COMMON.project}-reports-a-record`, {
      recordName: configuration.REPORTING.reportsDomainName,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });

    new AaaaRecord(this, `${configuration.COMMON.project}-reports-aaaa-record`, {
      recordName: configuration.REPORTING.reportsDomainName,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });
  }
}
