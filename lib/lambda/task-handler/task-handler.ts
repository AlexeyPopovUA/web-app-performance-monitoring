import type {APIGatewayProxyHandler} from 'aws-lambda';
import { SQS } from '@aws-sdk/client-sqs';

const sqs = new SQS();

export const handler: APIGatewayProxyHandler = async (event) => {
  const queueUrl = process.env.QUEUE_URL!;
  const body = JSON.parse(event.body!);
  console.log('TaskHandler APIGatewayProxyHandler event.body:', body);

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

  await sqs.sendMessage(params);

  console.log('TaskHandler APIGatewayProxyHandler sendMessage params:', params);

  return {
    statusCode: 202,
    body: JSON.stringify({message: 'Task accepted'})
  };
};
