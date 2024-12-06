import {AnalysisInitiatorOutput} from "../../types/AnalysisInitiatorOutput";
import {AnalysisInitiatorInput} from "../../types/AnalysisInitiatorInput";

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
      '--iterations', initialState.iterations.toString(),
      '--groupAlias', initialState.variantName,

      // S3 bucket configuration
      ...(temporaryBucketName ? ['--s3.bucketname', temporaryBucketName] : []),
      ...(temporaryBucketRegion ? ['--s3.region', temporaryBucketRegion] : []),

      '--summary'
    ],
  };
}