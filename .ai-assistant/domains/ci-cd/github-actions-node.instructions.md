---
applyTo: ".github/**/*,*.yml,*.yaml"
priority: high
role: [developer, devops]
---

# CI/CD Guidelines

> **Applies to:** All pipeline configurations and deployment scripts
> **Related:** [git.instructions.md](./git.instructions.md) | [docker.instructions.md](./docker.instructions.md)

## Core Principles

1. **Automate everything** - No manual steps in the release process
2. **Fail fast** - Run quick checks first
3. **Reproducible builds** - Same inputs produce same outputs
4. **Security first** - Scan for vulnerabilities, manage secrets
5. **Observable** - Know what's deployed where

## Pipeline Structure

### Standard Pipeline Stages

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [{{DEFAULT_BRANCH}}]
  pull_request:
    branches: [{{DEFAULT_BRANCH}}]

jobs:
  # Stage 1: Quick checks (fail fast)
  lint:
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
          cache: '{{PACKAGE_MANAGER}}'
      - run: {{INSTALL_COMMAND}}
      - run: {{LINT_COMMAND}}

  typecheck:
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
          cache: '{{PACKAGE_MANAGER}}'
      - run: {{INSTALL_COMMAND}}
      - run: {{TYPECHECK_COMMAND}}

  # Stage 2: Tests (after lint passes)
  test:
    needs: [lint, typecheck]
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
          cache: '{{PACKAGE_MANAGER}}'
      - run: {{INSTALL_COMMAND}}
      - run: {{TEST_COVERAGE_COMMAND}}
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  # Stage 3: Build
  build:
    needs: [test]
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
          cache: '{{PACKAGE_MANAGER}}'
      - run: {{INSTALL_COMMAND}}
      - run: {{BUILD_COMMAND}}
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: {{BUILD_OUTPUT}}/

  # Stage 4: Security scan
  security:
    needs: [build]
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
      - run: {{PACKAGE_MANAGER}} audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Pull Request Checks

```yaml
# .github/workflows/pr.yml
name: PR Checks

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr-validation:
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # For commit history

      # Check PR size
      - name: Check PR size
        run: |
          ADDITIONS=$(gh pr view ${{ github.event.pull_request.number }} --json additions -q '.additions')
          if [ "$ADDITIONS" -gt 800 ]; then
            echo "::warning::Large PR with $ADDITIONS additions. Consider splitting."
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Check commit messages
      - name: Validate commits
        run: |
          git log origin/{{DEFAULT_BRANCH}}..HEAD --format='%s' | while read msg; do
            if ! echo "$msg" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|chore|ci|revert)(\(.+\))?: .+'; then
              echo "::error::Invalid commit message: $msg"
              exit 1
            fi
          done

      # Run tests for changed files only
      - name: Test changed files
        run: |
          {{INSTALL_COMMAND}}
          {{TEST_COMMAND}} -- --changedSince=origin/{{DEFAULT_BRANCH}}
```

## Caching

### Dependency Caching

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '{{NODE_VERSION}}'
    cache: '{{PACKAGE_MANAGER}}'  # Built-in caching

# Or manual cache for more control
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Build Caching

```yaml
- uses: actions/cache@v4
  with:
    path: |
      {{FRAMEWORK_CACHE}}
      {{BUILD_OUTPUT}}/.cache
    key: ${{ runner.os }}-build-${{ hashFiles('src/**') }}
    restore-keys: |
      ${{ runner.os }}-build-
```

## Secrets Management

### Using Secrets

```yaml
jobs:
  deploy:
    runs-on: {{CI_RUNNER}}
    steps:
      - name: Deploy
        env:
          API_KEY: ${{ secrets.API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          # Secrets are masked in logs
          ./deploy.sh

      # For deployment environments
      - name: Deploy to production
        environment: production  # Uses environment-specific secrets
        env:
          API_KEY: ${{ secrets.PROD_API_KEY }}
        run: ./deploy.sh
```

### Secrets Best Practices

```yaml
# Never echo secrets
- run: echo ${{ secrets.API_KEY }}  # BAD - masked but avoid

# Use environment variables
- env:
    API_KEY: ${{ secrets.API_KEY }}
  run: ./script.sh  # Script reads from env

# Rotate secrets regularly
# Use OIDC for cloud providers instead of long-lived credentials
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/deploy
    aws-region: us-east-1
```

## Deployment Strategies

### Environment Promotion

```yaml
# Deploy to staging on {{DEFAULT_BRANCH}} push
name: Deploy

on:
  push:
    branches: [{{DEFAULT_BRANCH}}]

jobs:
  deploy-staging:
    runs-on: {{CI_RUNNER}}
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh staging

  # Manual approval for production
  deploy-production:
    needs: [deploy-staging]
    runs-on: {{CI_RUNNER}}
    environment: production  # Requires approval
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh production
```

### Blue-Green Deployment

```yaml
deploy:
  steps:
    # Deploy to inactive environment
    - name: Deploy to blue
      run: |
        ./deploy.sh blue
        ./health-check.sh blue

    # Switch traffic
    - name: Switch traffic
      run: |
        ./switch-traffic.sh blue
        ./verify-switch.sh

    # Rollback on failure
    - name: Rollback on failure
      if: failure()
      run: ./switch-traffic.sh green
```

### Canary Deployment

```yaml
deploy:
  steps:
    - name: Deploy canary (10%)
      run: |
        ./deploy-canary.sh 10
        sleep 300  # Monitor for 5 minutes

    - name: Check canary metrics
      run: |
        ERROR_RATE=$(./get-error-rate.sh canary)
        if [ "$ERROR_RATE" -gt 1 ]; then
          ./rollback-canary.sh
          exit 1
        fi

    - name: Full rollout
      run: ./deploy-canary.sh 100
```

## Release Management

### Semantic Versioning

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: {{CI_RUNNER}}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog
        run: |
          git log $(git describe --tags --abbrev=0 HEAD^)..HEAD \
            --format='- %s' > CHANGELOG.md

      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          body_path: CHANGELOG.md
          files: |
            {{BUILD_OUTPUT}}/*
```

### Automated Version Bumping

```yaml
# Using conventional commits
- name: Bump version
  run: |
    npm version $(npx conventional-recommended-bump -p angular) \
      --no-git-tag-version

- name: Create tag
  run: |
    VERSION=$(node -p "require('./package.json').version")
    git tag "v$VERSION"
    git push origin "v$VERSION"
```

## Quality Gates

### Required Checks

```yaml
# Branch protection rules (configure in GitHub)
# - Require status checks: lint, test, build
# - Require reviews: 1
# - Require up-to-date branches

# In workflow, set required checks
jobs:
  lint:
    # This job name must match branch protection rule
    runs-on: {{CI_RUNNER}}
    steps:
      - run: npm run lint

  # Matrix builds report as single check
  test:
    strategy:
      matrix:
        node: [{{NODE_VERSION}}]
    runs-on: {{CI_RUNNER}}
    steps:
      - run: npm test
```

### Code Coverage

```yaml
test:
  steps:
    - run: {{TEST_COVERAGE_COMMAND}}

    - name: Check coverage threshold
      run: |
        COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage $COVERAGE% is below 80% threshold"
          exit 1
        fi
```

## Notifications

### Slack Notifications

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    channel: '#deployments'
    fields: repo,commit,author,action,ref
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Failure Notifications

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `CI failed on ${context.sha.slice(0, 7)}`,
        body: `Workflow: ${context.workflow}\nRun: ${context.runId}`,
        labels: ['ci-failure']
      })
```

## Performance Optimization

### Parallel Jobs

```yaml
jobs:
  # These run in parallel
  lint:
    runs-on: {{CI_RUNNER}}
    steps: [...]

  typecheck:
    runs-on: {{CI_RUNNER}}
    steps: [...]

  # This waits for both
  test:
    needs: [lint, typecheck]
    runs-on: {{CI_RUNNER}}
```

### Matrix Builds

```yaml
test:
  strategy:
    fail-fast: false  # Don't cancel others on failure
    matrix:
      os: [{{CI_RUNNER}}]
      node: [{{NODE_VERSION}}]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
    - run: npm test
```

## Known Gotchas

### Workflow Permissions

```yaml
# Default permissions are restrictive
permissions:
  contents: read
  pull-requests: write  # If you need to comment on PRs
  issues: write         # If you need to create issues
```

### Checkout Depth

```yaml
# Shallow clone by default - some operations need full history
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history for versioning/changelogs
```

### Concurrent Runs

```yaml
# Prevent concurrent deployments
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false  # Don't cancel running deploys
```

### Environment Variables in Scripts

```yaml
# Variables aren't available in run scripts by default
- run: echo $MY_VAR  # Won't work

# Must set in env
- env:
    MY_VAR: ${{ vars.MY_VAR }}
  run: echo $MY_VAR  # Works
```

---

**See Also:**
- [Git Guidelines](./git.instructions.md)
- [Docker Guidelines](./docker.instructions.md)
- [Environment Configuration](./env-config.instructions.md)
