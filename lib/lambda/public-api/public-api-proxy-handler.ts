import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.REPORTS_BUCKET_NAME!;
const BASE_URL = `https://${process.env.REPORTS_DOMAIN_NAME}`;

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        // List objects from S3
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            // Optional: You can add a Prefix here if you want to list specific folders
        });

        const response = await s3Client.send(command);

        if (!response.Contents) {
            throw new Error('No contents found in bucket');
        }

        // Filter for index.html files, excluding ones with 'page'
        const indexFiles = response.Contents
            .map(item => item?.Key ?? "")
            .filter(key => key &&
                key.endsWith('index.html') &&
                !key.includes('page'))
            .sort()
            .reverse(); // Most recent first

        // Generate HTML
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
    </style>
</head>
<body>
    <h1>Performance Reports</h1>
    <ul class="reports-list">
        ${indexFiles.map(file => `
            <li>
                <a href="${BASE_URL}/${file}">
                    ${file.split('/').slice(-2)[0]} - ${file.split('/').slice(1, -2).join('/')}
                </a>
            </li>
        `).join('')}
    </ul>
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