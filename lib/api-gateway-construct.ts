import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from "aws-cdk-lib/aws-logs";
import {IBucket} from "aws-cdk-lib/aws-s3";

interface ApiGatewayStackProps {
  project: string;
  env: Required<cdk.Environment>;
  reportBucket: IBucket;
  staticReportBaseURL: string;
  stateMachineArn: string;
  apiKey: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const browseReportsFunction = new lambda.Function(this, `${props.project}-public-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambda.handler',
      logRetention: logs.RetentionDays.ONE_DAY,
      code: lambda.Code.fromAsset('dist/public-api'),
      // important for the big amounts of S3 items
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        REPORTS_BUCKET_NAME: props.reportBucket.bucketName,
        // TODO Rename the env var
        STATIC_REPORT_BASE_URL: props.staticReportBaseURL,
        REGION: props.env.region,
        STATE_MACHINE_ARN: props.stateMachineArn,
        API_KEY: props.apiKey,
        // TODO Take from a parameter
        DEBUG: true ? "express:*" : ""
      }
    });

    props.reportBucket.grantRead(browseReportsFunction);

    // Grant permission to start execution on the state machine
    const stateMachinePolicy = new iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [props.stateMachineArn],
    });
    browseReportsFunction.addToRolePolicy(stateMachinePolicy);

    // Create API Gateway
    this.api = new apigateway.RestApi(this, `${props.project}-PerformanceMonitoringApi`, {
      restApiName: 'Performance Monitoring API',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Define API Gateway Model for /api/task validation (close to Yup schema)
    const taskModel = this.api.addModel('TaskModel', {
      contentType: 'application/json',
      modelName: 'TaskModel',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['projectName', 'baseUrl', 'environment', 'variants'],
        properties: {
          projectName: {type: apigateway.JsonSchemaType.STRING},
          baseUrl: {type: apigateway.JsonSchemaType.STRING},
          environment: {type: apigateway.JsonSchemaType.STRING},
          gitBranchOrTag: {type: apigateway.JsonSchemaType.STRING},
          variants: {
            type: apigateway.JsonSchemaType.ARRAY,
            minItems: 1,
            items: {
              type: apigateway.JsonSchemaType.OBJECT,
              required: ['variantName', 'urls', 'iterations', 'browser'],
              properties: {
                variantName: {type: apigateway.JsonSchemaType.STRING},
                urls: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: {type: apigateway.JsonSchemaType.STRING}
                },
                iterations: {type: apigateway.JsonSchemaType.NUMBER},
                browser: {
                  type: apigateway.JsonSchemaType.STRING,
                  enum: ['chrome', 'firefox', 'edge']
                }
              }
            }
          }
        }
      }
    });

    // Create API endpoints
    const apiResource = this.api.root.addResource('api');

    // Create API key for the task endpoint with a more explicit name
    const apiKeyResource = new apigateway.ApiKey(this, `${props.project}-ApiKey`, {
      value: props.apiKey,
      enabled: true, // Explicitly enable the API key
      description: 'API Key for task endpoint'
    });

    // Create usage plan for the API key with more explicit settings
    const plan = new apigateway.UsagePlan(this, `${props.project}-UsagePlan`, {
      name: `${props.project}-UsagePlan`,
      description: 'Usage plan for task endpoint',
      apiStages: [
        {
          api: this.api,
          stage: this.api.deploymentStage,
        },
      ],
      // Optional: add throttling or quota if needed
      throttle: {
        rateLimit: 10,
        burstLimit: 20
      }
    });

    // Add API key to usage plan
    plan.addApiKey(apiKeyResource);

    // Task endpoint using Lambda integration instead of SQS
    const taskResource = apiResource.addResource('task');
    const taskIntegration = new apigateway.LambdaIntegration(browseReportsFunction);

    // taskResource.addMethod('POST', taskIntegration, {
    //   apiKeyRequired: true, // Require API key for this endpoint
    //   methodResponses: [
    //     {
    //       statusCode: '200',
    //       responseModels: {
    //         'application/json': apigateway.Model.EMPTY_MODEL,
    //       },
    //     },
    //     {
    //       statusCode: '400',
    //       responseModels: {
    //         'application/json': apigateway.Model.ERROR_MODEL,
    //       },
    //     },
    //     {
    //       statusCode: '401',
    //       responseModels: {
    //         'application/json': apigateway.Model.ERROR_MODEL,
    //       },
    //     },
    //     {
    //       statusCode: '500',
    //       responseModels: {
    //         'application/json': apigateway.Model.ERROR_MODEL,
    //       },
    //     },
    //   ],
    // });

    // Browse reports endpoint
    const browseReportsResource = apiResource.addResource('browse-reports');
    const browseReportsIntegration = new apigateway.LambdaIntegration(browseReportsFunction);

    browseReportsResource.addMethod('GET', browseReportsIntegration);
    taskResource.addMethod('POST', taskIntegration, {apiKeyRequired: true});

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'URL of the API Gateway',
    });

    // Output API key value for reference
    new cdk.CfnOutput(this, 'ApiKeyValue', {
      value: props.apiKey,
      description: 'API Key for authenticating requests to the task endpoint',
      exportName: `${props.project}-ApiKey`
    });
  }
}
