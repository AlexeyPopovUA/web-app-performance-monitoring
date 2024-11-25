import * as cdk from 'aws-cdk-lib';
import {IRole} from "aws-cdk-lib/aws-iam";
import {Construct} from 'constructs';

import {SqsConstruct} from "./task-processing-constructs/SqsConstruct";
import {APIGatewayConstruct} from "./task-processing-constructs/APIGatewayConstruct";
import {StateMachineConstruct} from "./task-processing-constructs/StateMachineConstruct";
import configuration from "../cfg/configuration";

export class TaskProcessingStack extends cdk.Stack {
  public readonly finalizerRole: IRole | undefined;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sqsConstruct = new SqsConstruct(this, `${configuration.COMMON.project}-SqsConstruct`);

    new APIGatewayConstruct(this, `${configuration.COMMON.project}-APIGatewayConstruct`, sqsConstruct.taskQueue);

    const stateMachineConstruction = new StateMachineConstruct(this, `${configuration.COMMON.project}-StateMachineConstruct`, sqsConstruct.sqsTaskHandler);

    this.finalizerRole = stateMachineConstruction.reportFinalizerLambda.role;
  }
}