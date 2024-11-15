import {Construct} from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

import configuration from "../../cfg/configuration";

export class StateMachineConstruct extends Construct {
  constructor(scope: Construct, id: string, sqsTaskHandler: lambda.Function) {
    super(scope, id);

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, `${configuration.COMMON.project}-start-state`);
    const stateMachine = new sfn.StateMachine(this, `${configuration.COMMON.project}-state-machine`, {
      definitionBody: sfn.DefinitionBody.fromChainable(startState)
    });

    // Grant Lambda permissions to start Step Functions executions
    stateMachine.grantStartExecution(sqsTaskHandler);
    stateMachine.grantRead(sqsTaskHandler);

    // Add IAM role for Lambda to list Step Functions executions
    sqsTaskHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:ListExecutions'],
      resources: [stateMachine.stateMachineArn]
    }));

    // Set environment variable for sqsTaskHandler
    sqsTaskHandler.addEnvironment('STATE_MACHINE_ARN', stateMachine.stateMachineArn);
  }
}