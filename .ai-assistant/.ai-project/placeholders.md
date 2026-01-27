# Placeholder Reference

> **Purpose:** Documents all placeholders used in AI assistant templates
> **Usage:** Replace `{{PLACEHOLDER}}` with project-specific values after running `/init`

## Core Project

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{PROJECT_NAME}}` | Project name | `my-app` |
| `{{PROJECT_TYPE}}` | Type of project | `web application`, `library`, `CLI tool` |
| `{{PROJECT_DESCRIPTION}}` | Brief description | `E-commerce platform` |

## Technology Stack

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{LANGUAGE}}` | Primary language | `TypeScript` |
| `{{LANGUAGE_VERSION}}` | Language version | `5.0` |
| `{{FRAMEWORK}}` | Main framework | `React`, `Vue`, `Next.js` |
| `{{FRAMEWORK_VERSION}}` | Framework version | `18.2` |
| `{{RUNTIME}}` | Runtime environment | `Node.js`, `Bun`, `Deno` |
| `{{RUNTIME_VERSION}}` | Runtime version | `20` |

## Build & Package

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{PACKAGE_MANAGER}}` | Package manager | `npm`, `yarn`, `pnpm` |
| `{{BUILD_TOOL}}` | Build tool | `Vite`, `Webpack`, `esbuild` |
| `{{BUILD_OUTPUT}}` | Build output directory | `dist`, `build`, `.next` |
| `{{ENTRY_POINT}}` | Application entry point | `index.js`, `main.js` |
| `{{SOURCE_DIR}}` | Source code directory | `src`, `lib`, `app` |

## Testing

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{TEST_FRAMEWORK}}` | Test runner | `Vitest`, `Jest` |
| `{{TEST_DIR}}` | Test directory | `tests`, `__tests__`, `src` |

## Code Quality

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{LINTER}}` | Linting tool | `eslint`, `biome` |
| `{{FORMATTER}}` | Formatting tool | `prettier`, `biome` |
| `{{FRAMEWORK_HOOK_RULE}}` | Framework-specific lint rule | `react-hooks/exhaustive-deps` |

## Git

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{DEFAULT_BRANCH}}` | Main branch name | `main`, `master`, `develop` |
| `{{FEATURE_BRANCH_PREFIX}}` | Feature branch prefix | `feature/`, `ft/` |

## Docker & CI/CD

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{NODE_VERSION}}` | Node.js version for Docker/CI | `20`, `22` |
| `{{BASE_IMAGE}}` | Docker base image | `node:20-alpine` |
| `{{APP_PORT}}` | Application port | `3000`, `8080` |
| `{{CI_RUNNER}}` | CI runner image | `ubuntu-latest`, `ubuntu-22.04` |
| `{{FRAMEWORK_CACHE}}` | Framework cache directory | `.next/cache`, `.nuxt` |
| `{{LOGGING_HOST}}` | Logging server host | `localhost` |
| `{{LOGGING_PORT}}` | Logging server port | `24224` |

## Environment

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{DEFAULT_APP_PORT}}` | Default app port | `3000` |
| `{{DEFAULT_APP_HOST}}` | Default app host | `localhost` |
| `{{DEFAULT_REDIS_PORT}}` | Default Redis port | `6379` |
| `{{EXAMPLE_DATABASE_URL}}` | Example database URL | `postgres://user:pass@localhost:5432/app` |

## Commands

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{DEV_COMMAND}}` | Dev server command | `npm run dev` |
| `{{BUILD_COMMAND}}` | Build command | `npm run build` |
| `{{TEST_COMMAND}}` | Test command | `npm run test` |
| `{{TEST_COVERAGE_COMMAND}}` | Test with coverage | `npm run test:coverage` |
| `{{LINT_COMMAND}}` | Lint command | `npm run lint` |
| `{{LINT_FIX_COMMAND}}` | Lint with auto-fix | `npm run lint -- --fix` |
| `{{TYPECHECK_COMMAND}}` | Type check command | `npm run typecheck` |
| `{{INSTALL_COMMAND}}` | Install dependencies | `npm ci` |

## Usage

### In Domain Instructions

Domain instruction files (`.ai-assistant/domains/*.md`) use placeholders for project-specific values:

```markdown
# Example: docker.instructions.md
FROM {{BASE_IMAGE}} AS builder
EXPOSE {{APP_PORT}}
CMD ["node", "{{BUILD_OUTPUT}}/{{ENTRY_POINT}}"]
```

### After Initialization

After running `/init`, these values are populated in `.ai-project/` files. The domain instructions reference these values for consistency.

### Adding New Placeholders

1. Add to this reference file with description and example
2. Use in domain instruction files with `{{PLACEHOLDER}}` syntax
3. Ensure `/init` workflow prompts for the value
4. Document in relevant `.ai-project/` files
