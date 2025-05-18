#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {Environment} from "aws-cdk-lib/core/lib/environment";

import {MainStack} from "../lib/main-stack";
import {CertificatesStack} from "../lib/certificates-stack";
import configuration from "../cfg/configuration";

const app = new cdk.App();

const env: Environment = {
  account: configuration.COMMON.account,
  region: configuration.COMMON.region
}

const rootStack = new cdk.Stack(app, `${configuration.COMMON.project}-RootStack`, {
  env
});

const certificatesStack = new CertificatesStack(rootStack, `${configuration.COMMON.project}-CertificatesStack`, {
  env
});

const mainStack = new MainStack(rootStack, `${configuration.COMMON.project}-MainStack`, {
  env,
  certificateArn: certificatesStack.certificateArn
});
