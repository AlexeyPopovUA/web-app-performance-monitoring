import {APIGatewayProxyHandler} from 'aws-lambda';
import {S3Client, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {getTaskParametersFromReportPath} from "../../utils/utils";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.REPORTS_BUCKET_NAME!;
const BASE_URL = `https://${process.env.REPORTS_DOMAIN_NAME}`;

type SingleReport = {
  projectName: string;
  variantName: string;
  environment: string;
  date: string;
  path: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      throw new Error('No contents found in bucket');
    }

    const indexFiles = response.Contents
      .map(item => item?.Key ?? "")
      .filter(key => key &&
        key.endsWith('index.html') &&
        !key.includes('page'))
      .sort()
      .reverse();

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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: html,
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
      },
      body: '<h1>Error retrieving reports</h1><p>Please try again later.</p>',
    };
  }
};