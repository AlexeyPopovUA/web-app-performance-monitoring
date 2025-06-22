import {Request, Response} from 'express';
import {z} from 'zod';
import {SFN} from '@aws-sdk/client-sfn';

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

export const postTask = async (req: Request, res: Response) => {
  console.log('Task handler received request');

  // Note: API key validation is now handled by API Gateway directly
  // We're removing the duplicate validation in Lambda

  try {
    const body = req.body;

    console.log('Task handler body:', body);

    // Validate the body against the TaskGeneratorInput schema
    const validationResult = TaskGeneratorInputSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.format());
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.format()
      });
      return;
    }

    // Extract the validated data
    const validatedBody = validationResult.data;

    // Generate a unique execution name
    const executionId = `execution-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const params = {
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      input: JSON.stringify(validatedBody),
      name: executionId
    };

    console.log('Starting step function execution', params);

    await stepfunctions.startExecution(params);

    res.status(200).json({
      status: "task scheduled",
      executionId: executionId
    });

  } catch (error) {
    console.error('Error processing task:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};
