import {Request, Response} from 'express';
import {z} from 'zod';
import {ExecutionStatus, SFN} from '@aws-sdk/client-sfn';

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

    const validatedBody = validationResult.data;

    // validatedBody contains the input validated against the Zod schema.
    // We iterate over each variant to create and start a Step Function execution.
    for (const variant of validatedBody.variants) {
      // Generate a unique execution name for each variant.
      // This name helps in identifying the task and preventing duplicates.
      // The structure is: timestamp-projectName-environment-variantName-browser
      const executionId = [
        Date.now(),
        validatedBody.projectName,
        validatedBody.environment,
        variant.variantName,
        variant.browser
      ].join('-');

      // Check for currently running executions with a similar name to avoid duplicates.
      // We list executions on the state machine, filtering by status 'RUNNING'.
      const listExecutionsParams = {
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        statusFilter: ExecutionStatus.RUNNING
      };

      const runningExecutions = await stepfunctions.listExecutions(listExecutionsParams);

      // A running execution is considered a duplicate if its name starts with the same
      // project, environment, variant, and browser, ignoring the timestamp.
      const duplicateExecution = runningExecutions.executions?.find(execution =>
        execution.name?.startsWith(executionId.substring(executionId.indexOf('-') + 1)) ?? false
      );

      if (duplicateExecution) {
        // If a similar task is already running, we refuse to start a new one.
        // This prevents redundant processing and potential race conditions.
        const refusalMessage = `A similar task is already running. Execution Name: ${duplicateExecution.name}`;
        console.log(refusalMessage);
        // Return a 409 Conflict status to indicate the refusal.
        res.status(409).json({
          error: 'Conflict',
          message: refusalMessage,
          details: {
            runningExecutionName: duplicateExecution.name
          }
        });
        return; // Stop processing further variants
      }

      // Prepare the parameters for starting the Step Function execution.
      // The input for the state machine is a combination of common properties
      // and the specific variant details.
      const params = {
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        input: JSON.stringify({
          ...validatedBody,
          variant
        }),
        name: executionId
      };

      console.log('Starting step function execution with params:', params);

      // Start the Step Function execution.
      await stepfunctions.startExecution(params);
    }

    // After successfully scheduling all tasks, return a 200 OK response.
    res.status(200).json({
      status: "Tasks scheduled successfully"
    });

  } catch (error) {
    console.error('Error processing task:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};
