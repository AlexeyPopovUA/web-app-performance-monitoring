const { parse } = require('url');
const serverless = require('serverless-http');

// Import the Next.js server
const NextServer = require('./.next/standalone/server.js');

// Convert Lambda Function URL event to Node.js HTTP request format
function createRequest(event) {
  const { rawPath, rawQueryString, headers, body, isBase64Encoded } = event;
  
  const url = `${rawPath}${rawQueryString ? `?${rawQueryString}` : ''}`;
  
  // Decode body if base64 encoded
  const decodedBody = isBase64Encoded && body 
    ? Buffer.from(body, 'base64').toString('utf-8')
    : body;

  return {
    url,
    method: event.requestContext.http.method,
    headers: headers || {},
    body: decodedBody,
    rawBody: body,
    isBase64Encoded
  };
}

// Main handler for Lambda Function URLs
exports.handler = async (event, context) => {
  // Set Lambda context to not wait for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Check if this is a Lambda Function URL event
    if (event.requestContext && event.requestContext.http) {
      const request = createRequest(event);
      
      // Create a mock HTTP request/response for Next.js
      const { IncomingMessage, ServerResponse } = require('http');
      const { Socket } = require('net');
      
      const socket = new Socket();
      const req = new IncomingMessage(socket);
      const res = new ServerResponse(req);
      
      // Set request properties
      req.url = request.url;
      req.method = request.method;
      req.headers = request.headers;
      req.body = request.body;
      
      // Collect response data
      const responseData = {
        statusCode: 200,
        headers: {},
        body: '',
        isBase64Encoded: false
      };
      
      // Override response methods
      const chunks = [];
      res.write = (chunk) => {
        chunks.push(chunk);
        return true;
      };
      
      res.end = (chunk) => {
        if (chunk) chunks.push(chunk);
        responseData.body = Buffer.concat(chunks.map(c => 
          Buffer.isBuffer(c) ? c : Buffer.from(c)
        )).toString('utf-8');
      };
      
      res.setHeader = (name, value) => {
        responseData.headers[name.toLowerCase()] = value;
      };
      
      res.writeHead = (statusCode, headers) => {
        responseData.statusCode = statusCode;
        if (headers) {
          Object.entries(headers).forEach(([name, value]) => {
            responseData.headers[name.toLowerCase()] = value;
          });
        }
      };
      
      // Use the serverless-http adapter as fallback
      const app = serverless(NextServer);
      const response = await app(event, context);
      
      return response;
    } else {
      // Fallback for other event types
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid event type' })
      };
    }
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};