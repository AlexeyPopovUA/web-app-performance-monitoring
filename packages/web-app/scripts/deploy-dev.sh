#!/bin/bash
set -e

# Development deployment script - for quick iterations
echo "Next.js Lambda Development Deployment"
echo "===================================="

# Check prerequisites
if [ ! -f ".next/standalone/server.js" ]; then
    echo "Building Next.js application first..."
    pnpm build
fi

# Quick package and deploy
echo "Creating deployment package..."
cd .next/standalone
zip -r ../../lambda-dev.zip . -x "*.git*" > /dev/null
cd ../..

# Copy adapter
zip -u lambda-dev.zip lambda-adapter.js

# Get Lambda name
LAMBDA_NAME=$(aws ssm get-parameter --name "/web-perf-mon/nextjs/lambda-function-name" --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "$LAMBDA_NAME" ]; then
    echo "Error: Could not find Lambda function name"
    exit 1
fi

# Deploy without publishing (faster)
echo "Deploying to Lambda..."
aws lambda update-function-code \
    --function-name $LAMBDA_NAME \
    --zip-file fileb://lambda-dev.zip

# Cleanup
rm lambda-dev.zip

echo "Development deployment complete!"
echo "Note: This is a quick deployment without static assets update"