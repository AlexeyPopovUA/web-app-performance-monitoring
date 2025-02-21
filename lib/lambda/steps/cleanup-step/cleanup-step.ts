import {S3} from '@aws-sdk/client-s3';
import {CleanupStepInput} from "./CleanupStepInput";
import {CleanupStepOutput} from "./CleanupStepOutput";
import pLimit from 'p-limit';

const s3 = new S3();
const limit = pLimit(50);

export async function handler(initialState: CleanupStepInput): Promise<CleanupStepOutput> {
  const sourceBucket = process.env.TEMPORARY_BUCKET_NAME;

  const deleteJobs = initialState.concurrentTasks.map(({reportPath}) => reportPath);

  console.log({deleteJobs});

  await Promise.all(deleteJobs.map(async (reportPath) => {
    const listObjects = await s3.listObjectsV2({Bucket: sourceBucket, Prefix: reportPath});

    console.log("listObjects.Contents?.length", listObjects.Contents?.length);

    if (listObjects.Contents && listObjects.Contents.length > 0) {
      const deleteParams = {
        Bucket: sourceBucket,
        Delete: {
          Objects: listObjects.Contents.map(({Key}) => ({Key})),
          Quiet: true
        }
      };

      await limit(() => s3.deleteObjects(deleteParams));
    }
  }));

  return initialState;
}