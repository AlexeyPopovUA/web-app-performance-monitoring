#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import {WebAppPerformanceMonitoringStack} from '../lib/web-app-performance-monitoring-stack';
import {TaskProcessingStack} from "../lib/task-processing-stack";
import {ReportStack} from "../lib/report-stack";

const app = new cdk.App();
new WebAppPerformanceMonitoringStack(app, 'WebAppPerformanceMonitoringStack', {});
new TaskProcessingStack(app, 'TaskProcessingStack', {});
new ReportStack(app, 'ReportStack', {bucketClients: {finalReportWriter: undefined}});