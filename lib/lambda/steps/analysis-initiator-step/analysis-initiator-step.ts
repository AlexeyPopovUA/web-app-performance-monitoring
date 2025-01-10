import {AnalysisInitiatorOutput} from "./AnalysisInitiatorOutput";
import {AnalysisInitiatorInput} from "./AnalysisInitiatorInput";

export async function handler(initialState: AnalysisInitiatorInput): Promise<AnalysisInitiatorOutput> {
  console.log('initiator', initialState);

  const temporaryBucketName = process.env.TEMPORARY_BUCKET_NAME;
  const temporaryBucketRegion = process.env.TEMPORARY_BUCKET_REGION;

  // TODO: Convert incoming tasks object into a Fargate Task Run definition, compatible with the fargate task runner step

  return {
    ...initialState,

    command: [
      ...initialState.urls,
      '--browser', initialState.browser,
      '--browsertime.iterations', initialState.iterations.toString(),
      '--browsertime.firefox.includeResponseBodies',
      '--browsertime.chrome.includeResponseBodies',
      '--groupAlias', initialState.variantName,
      '--sustainable.enable',
      '--plugins.add @sitespeed.io/plugin-lighthouse',

      // S3 bucket configuration
      ...(temporaryBucketName ? ['--s3.bucketname', temporaryBucketName] : []),
      ...(temporaryBucketRegion ? ['--s3.region', temporaryBucketRegion] : []),
      ...(initialState.reportPath ? ['--s3.path', initialState.reportPath] : [])
    ],
  };
}