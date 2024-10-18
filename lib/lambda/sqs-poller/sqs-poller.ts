import {SQSHandler} from 'aws-lambda';
import SQS from 'aws-sdk/clients/sqs';
import StepFunctions from 'aws-sdk/clients/stepfunctions';

const sqs = new SQS();
const stepfunctions = new StepFunctions();

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);

    // Check for duplicate tasks (this is a placeholder, implement your own logic)
    const isDuplicate = false; // Replace with actual duplicate check

    if (!isDuplicate) {
      const params = {
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        input: JSON.stringify(body),
        name: `execution-${body.taskId}`
      };

      await stepfunctions.startExecution(params).promise();
    }

    // Delete the message from the queue
    const deleteParams = {
      QueueUrl: process.env.QUEUE_URL!,
      ReceiptHandle: record.receiptHandle
    };

    await sqs.deleteMessage(deleteParams).promise();
  }
};