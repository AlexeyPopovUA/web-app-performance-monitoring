# Project: Web App Performance Monitoring

This project uses AWS CDK to define and deploy infrastructure for monitoring web application performance. The primary language is TypeScript.

## Key Commands

*   **Install dependencies:** `pnpm install`
*   **Build the project:** `pnpm run build`
*   **Run tests:** `pnpm test`
*   **Deploy a stack:** push changes to git main branch, then the GitHub action works will deploy the stack automatically.
*   **Lint files:** `npx eslint . --ext .ts`

## Rules & Conventions

*   **Coding Style:**
    *   Adhere to the rules in `.eslintrc`.
    *   Use `PascalCase` for class and interface names (e.g., `MyMonitoringStack`).
    *   Use `camelCase` for variables and functions (e.g., `getMetric`).
    *   Stack id should start with project name, taken from configuration file, e.g., `webapp-performance-monitoring-MyStack`. Find examples in other stacks.
*   **Commit Messages:**
    *   Follow the Conventional Commits specification.

## Architectural Notes

*   The core logic is in `lib/`.
*   Entry points for CDK stacks are in `bin/`.
*   Configuration is managed in the `cfg/` directory.
