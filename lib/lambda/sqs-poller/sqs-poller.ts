import {SQSHandler} from 'aws-lambda';
import StepFunctions from 'aws-sdk/clients/stepfunctions';

const stepfunctions = new StepFunctions();

export const handler: SQSHandler = async (event) => {
  console.log('SQSHandler');
  for (const record of event.Records) {
    const body = JSON.parse(record.body);

    console.log('SQSHandler body:', body);

    // Check for duplicate tasks (this is a placeholder, implement your own logic)
    const isDuplicate = false; // Replace with actual duplicate check

    if (!isDuplicate) {
      const params = {
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        input: JSON.stringify(body),
        name: `execution-${body.taskId}`
      };

      console.log('SQSHandler Starting step fn execution', params);

      await stepfunctions.startExecution(params).promise();
    }
  }
};
