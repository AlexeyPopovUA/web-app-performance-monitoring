import {S3} from '@aws-sdk/client-s3';

// @ts-ignore
export async function handler(initialState): Promise<unknown> {
  console.log('finalizer', initialState);

  const s3 = new S3();
  const sourceBucket = process.env.TEMPORARY_BUCKET_NAME;
  const destinationBucket = process.env.REPORT_BUCKET_NAME;

  // TODO Remove the hardcoded prefix later
  const prefix = 'nextjs-images/';

  const listObjects = await s3.listObjectsV2({Bucket: sourceBucket, Prefix: prefix});

  const copyPromises = listObjects.Contents?.map(async ({Key}) => {
    if (Key) {
      const copySource = `${sourceBucket}/${Key}`;
      const destinationKey = Key.replace(prefix, '');

      console.log('Copying', copySource, 'to', destinationKey);

      await s3.copyObject({
        CopySource: copySource,
        Bucket: destinationBucket,
        Key: `${prefix}${destinationKey}`
      });
    }
  });

  copyPromises && await Promise.all(copyPromises);

  return {
    ...initialState,
    // TODO Remove the debugging info later
    listObjects
  };
}
