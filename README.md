# Web App Performance Monitoring

This project provides AWS-based infrastructure for monitoring web application performance and a Next.js dashboard for viewing results.

## Architecture

- **Infrastructure**: AWS CDK stacks with Lambda functions, Step Functions, ECS, and CloudFront
- **Web App**: Next.js application with ISR (Incremental Static Regeneration) hosted on Lambda
- **Workspaces**: pnpm workspaces for organized development

## Project Structure

```
├── packages/
│   ├── infrastructure/     # AWS CDK infrastructure
│   │   ├── lib/           # CDK constructs and stacks
│   │   ├── bin/           # CDK app entry point
│   │   ├── cfg/           # Configuration
│   │   └── tests/         # Infrastructure tests
│   └── web-app/           # Next.js application
│       ├── pages/         # Next.js pages
│       ├── components/    # React components
│       └── styles/        # Styling
├── .github/workflows/     # Separate CI/CD pipelines
└── pnpm-workspace.yaml   # Workspace configuration
```

## Development

### Prerequisites

- Node.js 22+
- pnpm
- AWS CLI configured
- AWS CDK CLI

### Getting Started

```bash
# Install dependencies for all workspaces
pnpm install

# Start Next.js development server
pnpm dev

# Build all projects
pnpm build

# Run tests
pnpm test
```

### Infrastructure Commands

```bash
# Deploy infrastructure
pnpm infra:deploy

# Show infrastructure diff
pnpm infra:diff

# Work with infrastructure only
pnpm --filter @web-perf-mon/infrastructure <command>
```

### Web App Commands

```bash
# Start development server
pnpm --filter @web-perf-mon/web-app dev

# Build production version
pnpm --filter @web-perf-mon/web-app build

# Run production server locally
pnpm --filter @web-perf-mon/web-app start
```

## Deployment

The project uses separate GitHub Actions workflows:

### Infrastructure Deployment (`infrastructure.yml`)
- Triggers on changes to `packages/infrastructure/**`
- Deploys AWS CDK stacks
- Creates Lambda functions, CloudFront distributions, etc.

### Web App Deployment (`web-app.yml`) 
- Triggers on changes to `packages/web-app/**`
- Builds Next.js application
- Deploys to Lambda with ISR support
- Uploads static assets to S3
- Invalidates CloudFront cache

## Features

### Next.js Web Application
- **ISR**: Pages regenerate every 5 minutes with fresh data
- **Performance**: Fast loading with CloudFront CDN
- **Responsive**: Mobile-friendly design
- **Real-time**: Shows latest performance reports

### Infrastructure
- **Serverless**: Lambda-based architecture
- **Scalable**: Auto-scaling ECS tasks for analysis
- **Monitoring**: Built-in observability
- **Secure**: IAM roles and policies

## Configuration

Environment variables are managed through:
- GitHub repository variables (`AWS_ACCOUNT`, `AWS_DEPLOYMENT_REGION`, etc.)
- GitHub repository secrets (`API_KEY`, `GRAPHITE_AUTH`)
- CDK configuration in `packages/infrastructure/cfg/configuration.ts`

## API Integration

The Next.js app fetches data from the existing API:
- **Endpoint**: `/api/browse-reports`
- **ISR**: Data refreshes every 5 minutes automatically
- **Fallback**: Graceful handling of API failures