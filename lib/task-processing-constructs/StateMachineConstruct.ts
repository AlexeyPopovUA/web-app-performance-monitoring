import {Construct} from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

import configuration from "../../cfg/configuration";

export class StateMachineConstruct extends Construct {
  constructor(scope: Construct, id: string, sqsTaskHandler: lambda.Function) {
    super(scope, id);

    // Create Step Functions state machine
    const startState = new sfn.Pass(this, `${configuration.COMMON.project}-start-state`);
    const checkState = new sfn.Pass(this, `${configuration.COMMON.project}-check-state`);

    const taskGeneratorLambda = new lambda.Function(this, `${configuration.COMMON.project}-task-generator`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'task-generator-step.handler',
      code: lambda.Code.fromAsset('dist/task-generator-step')
    });

    // Step to generate a list of tasks
    const generateTasks = new tasks.LambdaInvoke(this, 'Generate Tasks', {
      lambdaFunction: taskGeneratorLambda,
      outputPath: '$.Payload'
    });

    // Map state to schedule concurrent executions of tasks
    const mapState = new sfn.Map(this, 'Map State', {
      maxConcurrency: 10,
      itemsPath: '$.concurrentTasks',
      resultPath: '$.results'
    });

    // Task to process each item in the map state
    const initiateAnalysis = new sfn.Pass(this, `${configuration.COMMON.project}-single-job`);
    // const initiateAnalysis = new tasks.LambdaInvoke(this, 'Process Task', {
    //   lambdaFunction: analysisInitiatorLambda,
    //   outputPath: '$.Payload'
    // });
    //
    //
    // // Finalizer step to send email notifications
    // const finalizeReport = new tasks.LambdaInvoke(this, 'Finalize Report', {
    //   lambdaFunction: reportFinalizerLambda,
    //   outputPath: '$.Payload'
    // });

    // Define the state machine
    const definition = startState
      .next(generateTasks)
      .next(checkState)
      .next(mapState.itemProcessor(initiateAnalysis))
      //.next(finalizeReport);

    const stateMachine = new sfn.StateMachine(this, `${configuration.COMMON.project}-state-machine`, {
      definitionBody: sfn.DefinitionBody.fromChainable(definition)
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