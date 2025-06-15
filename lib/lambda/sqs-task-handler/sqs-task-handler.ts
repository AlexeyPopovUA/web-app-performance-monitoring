import type {SQSHandler} from 'aws-lambda';
import { SFN } from '@aws-sdk/client-sfn';
import { z } from 'zod';

const stepfunctions = new SFN();

// Define the validation schemas
const TaskVariantSchema = z.object({
  variantName: z.string(),
  urls: z.array(z.string().url()),
  iterations: z.number().int().positive(),
  browser: z.enum(['chrome', 'firefox', 'edge'])
});

const CommonTaskPropsSchema = z.object({
  projectName: z.string(),
  baseUrl: z.string().url(),
  environment: z.string(),
  gitBranchOrTag: z.string().optional()
});

// Combined schema for TaskGeneratorInput
const TaskGeneratorInputSchema = CommonTaskPropsSchema.extend({
  variants: z.array(TaskVariantSchema)
    // Add custom validation to ensure variant names are unique
    .refine(
      variants => {
        const variantNames = variants.map(v => v.variantName);
        const uniqueNames = new Set(variantNames);
        return uniqueNames.size === variantNames.length;
      },
      {
        message: "Variant names must be unique within a task",
        path: ["variants"]
      }
    )
});

export const handler: SQSHandler = async (event) => {
  console.log('SQSHandler');
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);

      console.log('SQSHandler body:', body);

      // Validate the body against the TaskGeneratorInput schema
      const validationResult = TaskGeneratorInputSchema.safeParse(body);

      if (!validationResult.success) {
        console.error('Validation failed:', validationResult.error.format());
        continue; // Skip this record and move to the next one
      }

      // Extract the validated data
      const validatedBody = validationResult.data;

      // Check for duplicate tasks (this is a placeholder, implement your own logic)
      const isDuplicate = false; // TODO Replace with actual duplicate check

      if (!isDuplicate) {
        const params = {
          stateMachineArn: process.env.STATE_MACHINE_ARN!,
          input: JSON.stringify(validatedBody),
          name: `execution-${record.messageId}`
        };

        console.log('SQSHandler Starting step fn execution', params);

        await stepfunctions.startExecution(params);
      }
    } catch (error) {
      console.error('Error processing SQS record:', error);
    }
  }
};
