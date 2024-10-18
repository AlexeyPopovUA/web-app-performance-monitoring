import {APIGatewayProxyHandler} from 'aws-lambda';
import SQS from 'aws-sdk/clients/sqs';
//import StepFunctions from 'aws-sdk/clients/stepfunctions';

const sqs = new SQS();
//const stepfunctions = new StepFunctions();

export const handler: APIGatewayProxyHandler = async (event) => {
  const queueUrl = process.env.QUEUE_URL!;
  const body = JSON.parse(event.body!);

  // Validate task payload
  if (!body.taskId) {
    return {
      statusCode: 400,
      body: JSON.stringify({message: 'Invalid task payload'})
    };
  }

  // Create SQS message
  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body)
  };

  await sqs.sendMessage(params).promise();

  return {
    statusCode: 202,
    body: JSON.stringify({message: 'Task accepted'})
  };
};