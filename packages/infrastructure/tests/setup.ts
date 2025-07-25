// Global test setup

// Set default environment variables for tests
process.env.STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine';
process.env.REPORTS_BUCKET_NAME = 'test-reports-bucket';
process.env.STATIC_REPORT_BASE_URL = 'https://example.com/';
process.env.API_KEY = 'test-api-key';