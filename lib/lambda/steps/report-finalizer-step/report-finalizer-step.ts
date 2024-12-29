import {S3} from '@aws-sdk/client-s3';
import {ReportFinalizerInput} from "./ReportFinalizerInput";
import {ReportFinalizerOutput} from "./ReportFinalizerOutput";

const s3 = new S3();

export async function handler(initialState: ReportFinalizerInput): Promise<ReportFinalizerOutput> {
    const sourceBucket = process.env.TEMPORARY_BUCKET_NAME;
    const destinationBucket = process.env.REPORT_BUCKET_NAME;

    const copyJobs = initialState.concurrentTasks.map(({reportPath}) => reportPath);

    console.log({copyJobs});

    await Promise.all(copyJobs.map(async (reportPath) => {
        const listObjects = await s3.listObjectsV2({Bucket: sourceBucket, Prefix: reportPath});

        console.log("listObjects.Contents?.length", listObjects.Contents?.length);

        const copyPromises = listObjects.Contents?.map(async ({Key}) => {
            if (Key) {
                const copySource = `${sourceBucket}/${Key}`;

                await s3.copyObject({
                    CopySource: copySource,
                    Bucket: destinationBucket,
                    Key: Key
                });
            }
        });

        copyPromises && await Promise.all(copyPromises);
    }));

    return initialState;
}
