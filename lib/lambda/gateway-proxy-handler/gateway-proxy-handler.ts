import type {APIGatewayProxyHandler} from 'aws-lambda';
import {SQS} from '@aws-sdk/client-sqs';
import {object, string, array, number, ValidationError} from 'yup';

const sqs = new SQS();

// See examples/api-gateway.http for a sample request payload
const taskSchema = object({
  projectName: string().required(),
  baseUrl: string().required(),
  environment: string().required(),
  gitBranchOrTag: string().optional(),
  urls: array().of(
    object({
      shortPageName: string().required(),
      url: string().required(),
      iterations: number().required(),
      browsers: array().of(string()).required()
    })
  ).required()
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const queueUrl = process.env.QUEUE_URL!;
  let body;

  // Validate task payload
  try {
    body = JSON.parse(event.body!);
    await taskSchema.validate(body, {abortEarly: false});
  } catch (err: unknown) {
    return {
      statusCode: 400,
      body: JSON.stringify({message: 'Invalid task payload', errors: (err as ValidationError).errors})
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