#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import {AnalysisExecutionStack} from '../lib/analysis-execution-stack';
import {TaskProcessingStack} from "../lib/task-processing-stack";
import {ReportStack} from "../lib/report-stack";
import configuration from "../cfg/configuration";

const app = new cdk.App();

new AnalysisExecutionStack(app, 'AnalysisExecutionStack', {
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  }
});

const taskProcessingStack = new TaskProcessingStack(app, 'TaskProcessingStack', {
  env: {
    account: configuration.COMMON.account,
    region: configuration.COMMON.region
  }
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