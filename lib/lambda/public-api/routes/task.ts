import {Request, Response} from 'express';
import {z} from 'zod';
import {ExecutionStatus, SFN} from '@aws-sdk/client-sfn';

const stepfunctions = new SFN();

// Function to sanitize execution ID by replacing invalid characters with "-"
const sanitizeExecutionId = (str: string): string => {
  // Replace invalid characters with "-", then collapse multiple consecutive "-" into single "-"
  // Invalid: whitespace, brackets, wildcards, special chars, control chars
  return str
    .replace(/[\s<>{}\[\]?*"#%\\^|~`$&,;:/\u0000-\u001F\u007F-\u009F\uFFFE-\uFFFF\uD800-\uDFFF\u10FFFF]/g, '-')
    .replace(/-+/g, '-');
};

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

    // Get running executions once for all variants
    const listExecutionsParams = {
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      statusFilter: ExecutionStatus.RUNNING
    };
    const runningExecutions = await stepfunctions.listExecutions(listExecutionsParams);

    const acceptedExecutions: Array<{
      variantName: string;
      browser: string;
      executionId: string;
    }> = [];
    
    const rejectedExecutions: Array<{
      variantName: string;
      browser: string;
      executionId: string;
      reason: string;
      runningExecutionName?: string;
    }> = [];

    // Process each variant independently
    for (const variant of validatedBody.variants) {
      // Generate a unique execution name for each variant.
      // This name helps in identifying the task and preventing duplicates.
      // The structure is: timestamp-projectName-environment-variantName-browser
      const executionId = sanitizeExecutionId([
        Date.now(),
        validatedBody.projectName,
        validatedBody.environment,
        variant.variantName,
        variant.browser
      ].join('-').toLowerCase());

      // A running execution is considered a duplicate if its name contains the same
      // project, environment, variant, and browser, ignoring the timestamp.
      // Extract pattern without timestamp (everything after first dash)
      const patternWithoutTimestamp = executionId.substring(executionId.indexOf('-') + 1);
      const duplicateExecution = runningExecutions.executions?.find(execution =>
        execution.name?.includes(patternWithoutTimestamp) ?? false
      ) ?? null;

      if (duplicateExecution) {
        // If a similar task is already running, reject this variant but continue with others
        const refusalMessage = `A similar task is already running for variant ${variant.variantName} with browser ${variant.browser}`;
        console.log(refusalMessage);
        
        rejectedExecutions.push({
          variantName: variant.variantName,
          browser: variant.browser,
          executionId,
          reason: refusalMessage,
          runningExecutionName: duplicateExecution.name
        });
        
        continue; // Skip this variant but process others
      }

      try {
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
        
        acceptedExecutions.push({
          variantName: variant.variantName,
          browser: variant.browser,
          executionId
        });
      } catch (error) {
        console.error(`Failed to start execution for variant ${variant.variantName}:`, error);
        
        rejectedExecutions.push({
          variantName: variant.variantName,
          browser: variant.browser,
          executionId,
          reason: `Failed to start execution: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    // Return success response with details about accepted and rejected executions
    res.status(200).json({
      status: "Task processing completed",
      summary: {
        totalVariants: validatedBody.variants.length,
        acceptedCount: acceptedExecutions.length,
        rejectedCount: rejectedExecutions.length
      },
      acceptedExecutions,
      rejectedExecutions
    });

  } catch (error) {
    console.error('Error processing task:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};
