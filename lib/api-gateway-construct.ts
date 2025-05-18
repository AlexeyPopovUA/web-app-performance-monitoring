import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from "aws-cdk-lib/aws-logs";
import {IBucket} from "aws-cdk-lib/aws-s3";

interface ApiGatewayStackProps {
  project: string;
  env: Required<cdk.Environment>;
  taskQueue: sqs.Queue;
  reportBucket: IBucket;
  staticReportBaseURL: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id);

    // Create Lambda function for handling API requests
    const browseReportsFunction = new lambda.Function(this, `${props.project}-public-gateway-proxy-handler`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      //handler: 'public-api-proxy-handler.handler',
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
        // TODO Take from a parameter
        DEBUG: true ? "express:*" : ""
      }
    });

    props.reportBucket.grantRead(browseReportsFunction);

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
          projectName: { type: apigateway.JsonSchemaType.STRING },
          baseUrl: { type: apigateway.JsonSchemaType.STRING },
          environment: { type: apigateway.JsonSchemaType.STRING },
          gitBranchOrTag: { type: apigateway.JsonSchemaType.STRING },
          variants: {
            type: apigateway.JsonSchemaType.ARRAY,
            minItems: 1,
            items: {
              type: apigateway.JsonSchemaType.OBJECT,
              required: ['variantName', 'urls', 'iterations', 'browser'],
              properties: {
                variantName: { type: apigateway.JsonSchemaType.STRING },
                urls: {
                  type: apigateway.JsonSchemaType.ARRAY,
                  items: { type: apigateway.JsonSchemaType.STRING }
                },
                iterations: { type: apigateway.JsonSchemaType.NUMBER },
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

    // Create role for sending messages to SQS
    const sqsIntegrationRole = new iam.Role(this, `${props.project}-SqsIntegrationRole`, {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    props.taskQueue.grantSendMessages(sqsIntegrationRole);

    // Create API endpoints
    const apiResource = this.api.root.addResource('api');
    
    // Task endpoint for SQS
    const taskResource = apiResource.addResource('task');
    const integration = new apigateway.AwsIntegration({
      service: 'sqs',
      path: `${props.env.account}/${props.taskQueue.queueName}`,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: sqsIntegrationRole,
        requestParameters: {
          'integration.request.header.Content-Type': "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          'application/json': 'Action=SendMessage&MessageBody=$util.urlEncode($input.body)',
        },
        integrationResponses: [{
          statusCode: '200',
          responseTemplates: {
            'application/json': '{"status":"task queued"}',
          },
        }],
      },
    });

    // Add POST method with request validation
    taskResource.addMethod('POST', integration, {
      requestModels: {
        'application/json': taskModel
      },
      requestValidator: this.api.addRequestValidator('TaskBodyValidator', {
        validateRequestBody: true,
        validateRequestParameters: false
      }),
      methodResponses: [{ statusCode: '200' }],
    });

    // Browse reports endpoint
    const browseReportsResource = apiResource.addResource('browse-reports');
    const browseReportsIntegration = new apigateway.LambdaIntegration(browseReportsFunction);
    
    browseReportsResource.addMethod('GET', browseReportsIntegration);

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'URL of the API Gateway',
    });
  }
}
