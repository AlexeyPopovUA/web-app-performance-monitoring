import { Handler } from 'aws-lambda'

// @ts-expect-error
export async function handler (event, context): Handler<unknown, unknown> {
  console.log('taskGeneratorStep', event);
  console.log('taskGeneratorStep', context);

  return event;
}