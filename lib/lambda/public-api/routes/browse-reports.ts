import {Request, Response} from "express";
import {S3Client, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {getTaskParametersFromReportPath} from "../../../utils/utils";
import {ListObjectsV2CommandInput} from "@aws-sdk/client-s3/dist-types/commands/ListObjectsV2Command";


const BUCKET_NAME = process.env.REPORTS_BUCKET_NAME!;
const BASE_URL = `https://${process.env.STATIC_REPORT_BASE_PATH}`;

type SingleReport = {
  projectName: string;
  variantName: string;
  environment: string;
  date: string;
  path: string;
}

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

    const groupedReports: { [key: string]: { [key: string]: { [key: string]: SingleReport[] } } } = {};

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

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Reports</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .reports-list {
            list-style: none;
            padding: 0;
        }
        .reports-list li {
            margin: 10px 0;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
        }
        .reports-list a {
            color: #0066cc;
            text-decoration: none;
        }
        .reports-list a:hover {
            text-decoration: underline;
        }
        .report-group {
            margin-left: 20px;
        }
    </style>
</head>
<body>
    <h1>Performance Reports</h1>
    ${Object.keys(groupedReports).map(projectName => `
      <h2>${projectName}</h2>
      <div class="report-group">
        ${Object.keys(groupedReports[projectName]).map(environmentName => `
          <h3>${environmentName}</h3>
          <div class="report-group">
            ${Object.keys(groupedReports[projectName][environmentName]).map(variantName => `
              <h4>${variantName}</h4>
              <ul class="reports-list report-group">
                ${groupedReports[projectName][environmentName][variantName].map(data => `
                  <li><a href="${BASE_URL}/${data.path}">${data.date}</a></li>
                `).join('')}
              </ul>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `).join('')}
</body>
</html>`;

    res.status(200);
    res.contentType('text/html');
    res.send(html);

  } catch (error) {
    console.error('Error:', error);

    res.status(500);
    res.contentType('text/html');
    res.send('<h1>Error retrieving reports</h1><p>Please try again later.</p>');
  }
};
