#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Next.js Lambda Deployment Script${NC}"
echo "=================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "next.config.mjs" ]; then
    echo -e "${RED}Error: This script must be run from the packages/web-app directory${NC}"
    exit 1
fi

# Parse command line arguments
ENVIRONMENT=${1:-production}
REGION=${AWS_DEPLOYMENT_REGION:-us-east-1}

echo -e "${YELLOW}Deploying to environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}AWS Region: ${REGION}${NC}"

# Build the Next.js application
echo -e "\n${GREEN}Step 1: Building Next.js application...${NC}"
pnpm build

# Prepare deployment package
echo -e "\n${GREEN}Step 2: Preparing deployment package...${NC}"
rm -rf deployment
mkdir -p deployment

# Copy standalone build
cp -r .next/standalone/* deployment/

# Copy static files
mkdir -p deployment/.next
cp -r .next/static deployment/.next/

# Copy public files
cp -r public deployment/ 2>/dev/null || true

# Copy Lambda adapter
cp lambda-adapter.js deployment/

# Create package.json for Lambda
cat > deployment/package.json << EOF
{
  "name": "nextjs-lambda",
  "version": "1.0.0",
  "dependencies": {
    "serverless-http": "^3.2.0"
  }
}
EOF

# Install production dependencies
cd deployment && npm install --production && cd ..

# Create zip file
echo -e "\n${GREEN}Step 3: Creating deployment package...${NC}"
cd deployment
zip -r ../nextjs-lambda.zip . -x "*.git*" > /dev/null
cd ..

# Get deployment parameters from SSM
echo -e "\n${GREEN}Step 4: Getting deployment parameters...${NC}"
LAMBDA_NAME=$(aws ssm get-parameter --name "/web-perf-mon/nextjs/lambda-function-name" --query 'Parameter.Value' --output text --region $REGION 2>/dev/null || echo "")
BUCKET_NAME=$(aws ssm get-parameter --name "/web-perf-mon/nextjs/static-bucket-name" --query 'Parameter.Value' --output text --region $REGION 2>/dev/null || echo "")
DISTRIBUTION_ID=$(aws ssm get-parameter --name "/web-perf-mon/nextjs/distribution-id" --query 'Parameter.Value' --output text --region $REGION 2>/dev/null || echo "")

if [ -z "$LAMBDA_NAME" ]; then
    echo -e "${RED}Error: Could not retrieve Lambda function name from SSM${NC}"
    echo "Make sure the infrastructure is deployed first"
    exit 1
fi

echo "Lambda Function: $LAMBDA_NAME"
echo "S3 Bucket: $BUCKET_NAME"
echo "CloudFront Distribution: $DISTRIBUTION_ID"

# Deploy Lambda function
echo -e "\n${GREEN}Step 5: Deploying Lambda function...${NC}"
aws lambda update-function-code \
    --function-name $LAMBDA_NAME \
    --zip-file fileb://nextjs-lambda.zip \
    --publish \
    --region $REGION

# Wait for function to be updated
echo "Waiting for Lambda update to complete..."
aws lambda wait function-updated \
    --function-name $LAMBDA_NAME \
    --region $REGION

# Get the published version
VERSION=$(aws lambda get-function --function-name $LAMBDA_NAME --query 'Configuration.Version' --output text --region $REGION)
echo -e "${GREEN}Deployed Lambda version: $VERSION${NC}"

# Upload static assets to S3
if [ ! -z "$BUCKET_NAME" ]; then
    echo -e "\n${GREEN}Step 6: Uploading static assets to S3...${NC}"
    
    # Upload Next.js static files
    if [ -d ".next/static" ]; then
        aws s3 sync .next/static/ s3://$BUCKET_NAME/_next/static/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --metadata-directive REPLACE \
            --region $REGION
    fi
    
    # Upload public assets
    if [ -d "public" ]; then
        # Upload image files with longer cache
        find public -type f \( -name "*.ico" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.svg" \) | while read file; do
            relative_path=${file#public/}
            aws s3 cp "$file" "s3://$BUCKET_NAME/$relative_path" \
                --cache-control "public, max-age=86400" \
                --metadata-directive REPLACE \
                --region $REGION
        done
        
        # Upload other files with shorter cache
        find public -type f ! -name "*.ico" ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" ! -name "*.svg" | while read file; do
            relative_path=${file#public/}
            aws s3 cp "$file" "s3://$BUCKET_NAME/$relative_path" \
                --cache-control "public, max-age=3600" \
                --metadata-directive REPLACE \
                --region $REGION
        done
    fi
fi

# Invalidate CloudFront cache
if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo -e "\n${GREEN}Step 7: Invalidating CloudFront cache...${NC}"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text \
        --region $REGION)
    
    echo "Created CloudFront invalidation: $INVALIDATION_ID"
fi

# Cleanup
echo -e "\n${GREEN}Step 8: Cleaning up...${NC}"
rm -rf deployment nextjs-lambda.zip

# Verify deployment
echo -e "\n${GREEN}Step 9: Verifying deployment...${NC}"
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name $LAMBDA_NAME \
    --query 'FunctionUrl' \
    --output text \
    --region $REGION 2>/dev/null || echo "")

if [ ! -z "$FUNCTION_URL" ]; then
    echo "Testing Lambda function directly..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL")
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✅ Lambda function is responding correctly${NC}"
    else
        echo -e "${RED}❌ Lambda function returned HTTP $response${NC}"
    fi
fi

echo -e "\n${GREEN}Deployment complete!${NC}"
echo "=================================="
echo "Lambda Version: $VERSION"
echo "Function URL: $FUNCTION_URL"
echo "CloudFront URL: https://app.perf-mon.examples.oleksiipopov.com"