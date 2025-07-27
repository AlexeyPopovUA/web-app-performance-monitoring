# Use AWS Lambda Node.js 22 base image
FROM public.ecr.aws/lambda/nodejs:22

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy Next.js standalone build first
COPY .next/standalone/ ./

# Copy static files (these will be served by CloudFront, but needed for Next.js internals)
COPY .next/static ./.next/static/

# Copy Lambda adapter
COPY lambda-adapter.js ./

# Copy public files (now guaranteed to exist)
COPY public/ ./public/

# Install serverless-http separately to avoid dependency conflicts
RUN cd /tmp && \
    echo '{"name":"temp","version":"1.0.0"}' > package.json && \
    npm install serverless-http --no-package-lock --no-audit --no-fund && \
    mkdir -p ${LAMBDA_TASK_ROOT}/node_modules && \
    cp -r node_modules/serverless-http ${LAMBDA_TASK_ROOT}/node_modules/

# Set the CMD to the Lambda handler
CMD ["lambda-adapter.handler"]
