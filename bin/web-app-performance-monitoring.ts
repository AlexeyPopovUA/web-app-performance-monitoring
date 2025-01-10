#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import {TaskProcessingStack} from "../lib/task-processing-stack";
import {ReportStack} from "../lib/report-stack";
import configuration from "../cfg/configuration";

const app = new cdk.App();

const taskProcessingStack = new TaskProcessingStack(app, 'TaskProcessingStack', {
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  },
});

new ReportStack(app, 'ReportStack', {
  bucketClients: {
    finalReportWriterRole: taskProcessingStack.finalizerRole,
    publicAPIRole: taskProcessingStack.publicAPIRole
  },
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  }
});