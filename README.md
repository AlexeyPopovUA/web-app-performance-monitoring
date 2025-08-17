# Web App Performance Monitoring

This project provides AWS-based infrastructure for monitoring web application performance and a Next.js dashboard for viewing results.

## Architecture

- **Infrastructure**: AWS CDK stacks with Lambda functions, Step Functions, S3, and CloudFront
- **Web App**: Next.js application with Static Site Generation (SSG) hosted on S3/CloudFront
- **Shared Types**: Centralized TypeScript types for consistent data structures across packages
- **Workspaces**: pnpm workspaces for organized monorepo development

## Project Structure

```
├── packages/
│   ├── infrastructure/     # AWS CDK infrastructure
│   │   ├── lib/           # CDK constructs and stacks
│   │   │   ├── lambda/    # Lambda functions for API and Step Functions
│   │   │   ├── task-processing-constructs/  # ECS and Step Function constructs
│   │   │   └── utils/     # Shared utilities
│   │   ├── bin/           # CDK app entry point
│   │   ├── cfg/           # Configuration
│   │   ├── examples/      # API examples and sample data
│   │   └── tests/         # Infrastructure tests
│   ├── shared/            # Shared TypeScript types and utilities
│   │   └── src/           # Type definitions (GroupedReports, SingleReport)
│   └── web-app/           # Next.js application
│       ├── app/           # Next.js App Router pages
│       └── components/    # React components (ReportsGrid)
├── .github/workflows/     # CI/CD pipelines for infrastructure and web app
└── pnpm-workspace.yaml   # Workspace configuration
```

## Key Features

- **Performance Monitoring**: Automated web application performance testing using Step Functions and ECS
- **Report Dashboard**: Interactive Next.js dashboard for viewing performance reports
- **Type Safety**: Shared TypeScript types ensure consistency across infrastructure and frontend
- **AWS Integration**: Fully serverless architecture with S3, Lambda, CloudFront, and ECS
- **CI/CD**: Separate deployment pipelines for infrastructure and web application

## Development

### Prerequisites

- Node.js 22+
- pnpm 10.13+
- AWS CLI configured
- AWS CDK CLI

### Getting Started

```bash
# Install dependencies for all workspaces
pnpm install

# Build shared types first
pnpm --filter @web-perf-mon/shared build

# Start Next.js development server
pnpm dev

# Build all projects
pnpm build

# Run tests
pnpm test
```

### Workspace Commands

```bash
# Work with specific packages
pnpm --filter @web-perf-mon/infrastructure <command>
pnpm --filter @web-perf-mon/web-app <command>
pnpm --filter @web-perf-mon/shared <command>
```

## Deployment

The project uses GitHub Actions for automated deployments:

- **Infrastructure Pipeline**: Deploys AWS resources when `packages/infrastructure/` or `packages/shared/` changes
- **Web App Pipeline**: Builds and deploys the Next.js app to S3/CloudFront when `packages/web-app/` or `packages/shared/` changes

## Environment Configuration

Set the following environment variables:

- `AWS_ACCOUNT`: AWS Account ID
- `AWS_DEPLOYMENT_REGION`: Primary deployment region
- `HOSTED_ZONE_ID`: Route 53 hosted zone for custom domains
- `API_KEY`: API key for accessing performance monitoring endpoints

## Package Dependencies

- **shared**: Provides common types used by both infrastructure and web-app
- **infrastructure**: Uses shared types for API responses and data structures
- **web-app**: Uses shared types for component props and data display