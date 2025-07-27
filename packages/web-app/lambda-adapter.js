const http = require('http');
const { spawn } = require('child_process');

// Start the Next.js standalone server
let serverProcess;
let serverReady = false;

function startNextServer() {
  return new Promise((resolve, reject) => {
    // Change to the correct directory where server.js is located
    const serverPath = require('fs').existsSync('./server.js') 
      ? './server.js' 
      : './packages/web-app/server.js';
    
    console.log('Starting Next.js server from:', serverPath);
    
    // Start the server process
    serverProcess = spawn('node', [serverPath], {
      env: { 
        ...process.env,
        PORT: '3000',
        NODE_ENV: 'production'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server stdout:', output);
      if (output.includes('Ready in') || output.includes('Starting...')) {
        serverReady = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
      reject(error);
    });

    // Give it a few seconds to start
    setTimeout(() => {
      if (!serverReady) {
        serverReady = true; // Assume it's ready
        resolve();
      }
    }, 5000);
  });
}

// Initialize server on cold start
let initPromise;
if (!serverProcess) {
  initPromise = startNextServer();
}

// Lambda handler
exports.handler = async (event, context) => {
  // Ensure server is started
  if (initPromise) {
    await initPromise;
    initPromise = null;
  }

  try {
    const { rawPath, rawQueryString, headers = {}, body, requestContext } = event;
    const method = requestContext.http.method;
    const path = rawPath + (rawQueryString ? `?${rawQueryString}` : '');

    console.log(`Processing ${method} ${path}`);

    // Create request to local Next.js server
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        ...headers,
        host: 'localhost:3000'
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let responseBody = '';
        const responseHeaders = {};

        // Collect response headers
        Object.entries(res.headers).forEach(([key, value]) => {
          responseHeaders[key] = value;
        });

        // Collect response body
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          const response = {
            statusCode: res.statusCode,
            headers: responseHeaders,
            body: responseBody,
            isBase64Encoded: false
          };

          console.log(`Response: ${res.statusCode} ${responseBody.length} bytes`);
          resolve(response);
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        reject({
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Internal server error', 
            message: error.message 
          })
        });
      });

      // Write request body if present
      if (body) {
        req.write(body);
      }

      req.end();
    });

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