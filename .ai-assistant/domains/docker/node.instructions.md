---
applyTo: "Dockerfile*,docker-compose*.yml,*.dockerfile"
priority: medium
role: [developer, devops]
---

# Docker Guidelines

> **Applies to:** All Docker configurations and container builds
> **Related:** [ci-cd.instructions.md](./ci-cd.instructions.md) | [env-config.instructions.md](./env-config.instructions.md)

## Core Principles

1. **Minimal images** - Include only what's needed
2. **Reproducible builds** - Pin versions, use multi-stage
3. **Security** - Don't run as root, scan for vulnerabilities
4. **Layer optimization** - Order commands for caching
5. **Health checks** - Verify container health

## Dockerfile Best Practices

### Multi-Stage Builds

```dockerfile
# Stage 1: Build
FROM {{BASE_IMAGE}} AS builder

WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production
FROM {{BASE_IMAGE}} AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Use non-root user
USER nodejs

# Expose port
EXPOSE {{APP_PORT}}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:{{APP_PORT}}/health || exit 1

# Start application
CMD ["node", "{{BUILD_OUTPUT}}/{{ENTRY_POINT}}"]
```

### Layer Optimization

```dockerfile
# Bad - busts cache on any file change
COPY . .
RUN npm install

# Good - dependencies cached separately
COPY package*.json ./
RUN npm ci
COPY . .
```

### Minimize Image Size

```dockerfile
# Use alpine images
FROM {{BASE_IMAGE}}

# Clean up in same layer
RUN apk add --no-cache python3 make g++ && \
    npm ci && \
    apk del python3 make g++

# Use .dockerignore
# .dockerignore:
# node_modules
# .git
# *.md
# .env*
# coverage
# dist
```

## Security

### Non-Root User

```dockerfile
# Create and use non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set ownership
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser
```

### Read-Only Filesystem

```dockerfile
# In docker-compose or runtime
docker run --read-only --tmpfs /tmp myapp
```

### No Secrets in Images

```dockerfile
# Bad - secret in image history
ARG API_KEY
ENV API_KEY=$API_KEY

# Good - use runtime secrets
# Pass at runtime: docker run -e API_KEY=xxx myapp

# Or use Docker secrets
docker secret create api_key ./secret.txt
docker service create --secret api_key myapp
```

### Scan for Vulnerabilities

```bash
# Scan image
docker scout cves myapp:latest

# Or use Trivy
trivy image myapp:latest

# In CI
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:latest
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

## Docker Compose

### Development Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: development  # Use dev stage
    ports:
      - "{{APP_PORT}}:{{APP_PORT}}"
    volumes:
      - .:/app
      - /app/node_modules  # Preserve container's node_modules
    environment:
      - NODE_ENV=development
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev
      - POSTGRES_DB=app
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: myapp:${VERSION:-latest}
    restart: unless-stopped
    ports:
      - "{{APP_PORT}}:{{APP_PORT}}"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:{{APP_PORT}}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Override Files

```yaml
# docker-compose.override.yml (auto-loaded in dev)
version: '3.8'

services:
  app:
    build:
      target: development
    volumes:
      - .:/app
    command: npm run dev
```

## Health Checks

### Application Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:{{APP_PORT}}/health || exit 1
```

### Compose Health Check

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:{{APP_PORT}}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Dependency Health

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

## Environment Variables

### Development

```yaml
services:
  app:
    environment:
      - NODE_ENV=development
      - DEBUG=app:*
    env_file:
      - .env.development
```

### Production

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    external: true
  api_key:
    external: true
```

## Networking

### Service Discovery

```yaml
services:
  app:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend

  nginx:
    networks:
      - frontend

networks:
  frontend:
  backend:
```

### Internal vs External

```yaml
services:
  app:
    ports:
      - "{{APP_PORT}}:{{APP_PORT}}"  # External access

  db:
    expose:
      - "5432"  # Internal only
```

## Volumes

### Named Volumes

```yaml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
    driver: local
```

### Bind Mounts (Development)

```yaml
services:
  app:
    volumes:
      - .:/app:delegated  # Performance hint for macOS
      - /app/node_modules  # Preserve container's modules
```

## Logging

### Logging Configuration

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "app,environment"
        env: "NODE_ENV"
```

### Centralized Logging

```yaml
services:
  app:
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "{{LOGGING_HOST}}:{{LOGGING_PORT}}"
        tag: "app.{{.Name}}"
```

## Common Patterns

### Init Container Pattern

```yaml
services:
  migrate:
    image: myapp:latest
    command: npm run migrate
    depends_on:
      db:
        condition: service_healthy

  app:
    image: myapp:latest
    depends_on:
      migrate:
        condition: service_completed_successfully
```

### Sidecar Pattern

```yaml
services:
  app:
    image: myapp:latest

  log-collector:
    image: fluent-bit:latest
    volumes:
      - app_logs:/var/log/app:ro
```

## Known Gotchas

### Build Context

```dockerfile
# .dockerignore is crucial for performance
# Exclude:
node_modules
.git
*.md
.env*
coverage
dist
.DS_Store
```

### Cache Invalidation

```dockerfile
# ARG invalidates cache for subsequent layers
ARG CACHEBUST=1
RUN npm ci  # Runs every time if CACHEBUST changes

# Better: Use BuildKit cache mounts
RUN --mount=type=cache,target=/root/.npm npm ci
```

### Signal Handling

```dockerfile
# PID 1 problem - use dumb-init or tini
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "{{BUILD_OUTPUT}}/{{ENTRY_POINT}}"]

# Or use exec form (doesn't use shell)
CMD ["node", "{{BUILD_OUTPUT}}/{{ENTRY_POINT}}"]  # Good - node is PID 1
CMD node {{BUILD_OUTPUT}}/{{ENTRY_POINT}}         # Bad - shell is PID 1
```

### Environment vs ARG

```dockerfile
# ARG - build-time only
ARG NODE_VERSION=20

# ENV - runtime available
ENV NODE_ENV=production

# ARG to ENV pattern
ARG VERSION
ENV APP_VERSION=$VERSION
```

### Layer Caching with COPY

```dockerfile
# Specific files first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Then rest of source
COPY . .
```

---

**See Also:**
- [CI/CD Guidelines](./ci-cd.instructions.md)
- [Environment Configuration](./env-config.instructions.md)
- [Security Guidelines](./security.instructions.md)
