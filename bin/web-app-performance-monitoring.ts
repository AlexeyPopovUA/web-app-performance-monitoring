#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import {NetworkStack} from '../lib/network-stack';
import {TaskProcessingStack} from "../lib/task-processing-stack";
import {ReportStack} from "../lib/report-stack";
import configuration from "../cfg/configuration";

const app = new cdk.App();

const networkStack = new NetworkStack(app, 'NetworkStack', {
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  }
});

const taskProcessingStack = new TaskProcessingStack(app, 'TaskProcessingStack', {
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  },
  vpc: networkStack.vpc,
  securityGroup: networkStack.securityGroup
});

new ReportStack(app, 'ReportStack', {
  bucketClients: {
    finalReportWriterRole: taskProcessingStack.finalizerRole
  },
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  }
});