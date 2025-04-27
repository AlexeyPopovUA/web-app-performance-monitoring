#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import {MainStack} from "../lib/main-stack";
import {CertificatesStack} from "../lib/certificates-stack";
import configuration from "../cfg/configuration";

const app = new cdk.App();

const rootStack = new cdk.Stack(app, `${configuration.COMMON.project}-RootStack`);

const certificatesStack = new CertificatesStack(rootStack, `${configuration.COMMON.project}-CertificatesStack`);

const taskProcessingStack = new MainStack(rootStack, `${configuration.COMMON.project}-TaskProcessingStack`, {


});

// new ReportStack(app, `${configuration.COMMON.project}-ReportStack`, {
//   bucketClients: {
//     finalReportWriterRole: taskProcessingStack.finalizerRole,
//     publicAPIRole: taskProcessingStack.publicAPIRole
//   },
//   env: {
//     account: configuration.COMMON.account,
//     region: configuration.COMMON.region
//   }
// });