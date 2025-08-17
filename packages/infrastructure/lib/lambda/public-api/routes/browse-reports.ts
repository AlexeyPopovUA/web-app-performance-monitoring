import {Request, Response} from "express";
import {S3Client, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {getTaskParametersFromReportPath} from "../../../utils/utils";
import {ListObjectsV2CommandInput} from "@aws-sdk/client-s3/dist-types/commands/ListObjectsV2Command";
import {GroupedReports} from "@web-perf-mon/shared";

const BUCKET_NAME = process.env.REPORTS_BUCKET_NAME!;

async function listHtmlFiles(s3Client: S3Client, continuationToken?: string): Promise<string[]> {
  const htmlFiles: string[] = [];
  const params: ListObjectsV2CommandInput = {
    Bucket: BUCKET_NAME,
    Prefix: 'reports/',
  };

  const listObjectsCommand = new ListObjectsV2Command(params);

  try {
    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    const data = await s3Client.send(listObjectsCommand);

    if (data.Contents) {
      for (const object of data.Contents) {
        if (object.Key && object.Key.endsWith("index.html") && !object.Key.includes("pages")) {
          htmlFiles.push(object.Key);
        }
      }
    }

    if (data.IsTruncated) {
      // Recursively call the function with the next continuation token
      const nextHtmlFiles = await listHtmlFiles(s3Client, data.NextContinuationToken);
      htmlFiles.push(...nextHtmlFiles);
    }

  } catch (err) {
    console.error("Error:", err);
  }

  return htmlFiles;
}

// TODO Support request of a list of projects
// TODO Support request of a list of reports for a specific project
export const browseReportsHandler = async (req: Request<unknown, unknown, unknown, {
  environment: string;
}>, res: Response) => {
  console.log('browseResourcesRouteHandler');
  try {
    const indexFiles = await listHtmlFiles(new S3Client({}));

    console.log('indexFiles:', JSON.stringify(indexFiles));

    const groupedReports: GroupedReports = {};

    indexFiles.forEach(file => {
      const {projectName, variantName, environment, timestamp} = getTaskParametersFromReportPath(file);
      const date = new Date(timestamp).toString();

      if (!groupedReports[projectName]) {
        groupedReports[projectName] = {};
      }
      if (!groupedReports[projectName][environment]) {
        groupedReports[projectName][environment] = {};
      }
      if (!groupedReports[projectName][environment][variantName]) {
        groupedReports[projectName][environment][variantName] = [];
      }

      groupedReports[projectName][environment][variantName].push({
        environment,
        projectName,
        variantName,
        date,
        path: file
      });
    });

    console.log('groupedReports:', JSON.stringify(groupedReports));

    res.status(200);
    res.contentType('json');
    res.send(groupedReports);

  } catch (error) {
    console.error('Error:', error);

    res.status(500);
    res.contentType('text/html');
    res.send('<h1>Error retrieving reports</h1><p>Please try again later.</p>');
  }
};
