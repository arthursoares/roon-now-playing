---
applyTo: ".env*,**/*.{ts,js}"
priority: high
role: [developer, devops]
---

# Environment Configuration Guidelines

> **Applies to:** All environment variables and configuration
> **Related:** [security.instructions.md](../_universal/security.instructions.md) | [docker.instructions.md](../docker/node.instructions.md)

## Core Principles

1. **Fail fast** - Validate configuration at startup
2. **No secrets in code** - All secrets from environment
3. **Type safety** - Parse and validate env vars
4. **Defaults where safe** - Sensible defaults for non-sensitive values
5. **Documentation** - Every variable documented

## Environment Variable Naming

### Naming Convention

```bash
# Format: SCOPE_CATEGORY_NAME

# Application config
APP_PORT={{DEFAULT_APP_PORT}}
APP_HOST={{DEFAULT_APP_HOST}}
APP_LOG_LEVEL=info

# Database
DATABASE_URL={{EXAMPLE_DATABASE_URL}}
DATABASE_POOL_SIZE=10
DATABASE_SSL_ENABLED=true

# External services
REDIS_URL=redis://{{DEFAULT_APP_HOST}}:{{DEFAULT_REDIS_PORT}}
STRIPE_API_KEY=sk_test_xxx
SENDGRID_API_KEY=SG.xxx

# Feature flags
FEATURE_NEW_DASHBOARD=true
FEATURE_BETA_API=false
```

### Naming Rules

```bash
# Use SCREAMING_SNAKE_CASE
DATABASE_URL        # Good
databaseUrl         # Bad
database-url        # Bad

# Be specific
SMTP_HOST           # Good
HOST                # Bad - ambiguous

# Include units when relevant
CACHE_TTL_SECONDS=300
REQUEST_TIMEOUT_MS=5000
MAX_FILE_SIZE_MB=10
```

## Configuration Loading

### Type-Safe Configuration

```typescript
import { z } from 'zod';

// Define schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default({{DEFAULT_APP_PORT}}),
  HOST: z.string().default('{{DEFAULT_APP_HOST}}'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).default(10),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // External services
  STRIPE_API_KEY: z.string().startsWith('sk_'),
  SENDGRID_API_KEY: z.string().optional(),

  // Feature flags
  FEATURE_NEW_DASHBOARD: z.coerce.boolean().default(false),
});

// Parse and validate
function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

// Export typed config
export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
```

### Required vs Optional

```typescript
const envSchema = z.object({
  // Required - no default, must be set
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),

  // Required with default - safe default value
  PORT: z.coerce.number().default({{DEFAULT_APP_PORT}}),
  LOG_LEVEL: z.string().default('info'),

  // Optional - may not be present
  SENTRY_DSN: z.string().url().optional(),

  // Conditionally required
  SMTP_HOST: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
}).refine(
  (data) => {
    // If SMTP_HOST is set, SMTP_PASSWORD is required
    if (data.SMTP_HOST && !data.SMTP_PASSWORD) {
      return false;
    }
    return true;
  },
  { message: 'SMTP_PASSWORD required when SMTP_HOST is set' }
);
```

## Environment Files

### File Structure

```bash
.env                  # Default values (committed, no secrets)
.env.local            # Local overrides (not committed)
.env.development      # Development defaults
.env.production       # Production defaults (no secrets)
.env.test             # Test environment
.env.example          # Template with all variables documented
```

### Loading Order

```typescript
// Load in order, later files override earlier
// 1. .env
// 2. .env.local
// 3. .env.{NODE_ENV}
// 4. .env.{NODE_ENV}.local
// 5. Process environment (highest priority)

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

const env = process.env.NODE_ENV || 'development';

// Load files in order
[
  '.env',
  '.env.local',
  `.env.${env}`,
  `.env.${env}.local`,
].forEach(file => {
  expand(config({ path: file, override: true }));
});
```

### Example File

```bash
# .env.example - Commit this file
# Copy to .env.local and fill in values

# Application
NODE_ENV=development
PORT={{DEFAULT_APP_PORT}}
LOG_LEVEL=debug

# Database (required)
DATABASE_URL={{EXAMPLE_DATABASE_URL}}

# Redis (optional)
REDIS_URL=redis://{{DEFAULT_APP_HOST}}:{{DEFAULT_REDIS_PORT}}

# Authentication (required)
JWT_SECRET=your-32-char-secret-here
JWT_EXPIRES_IN=15m

# External Services
STRIPE_API_KEY=sk_test_...
SENDGRID_API_KEY=SG....

# Feature Flags
FEATURE_NEW_DASHBOARD=false
```

## Secrets Management

### Never Commit Secrets

```gitignore
# .gitignore
.env.local
.env.*.local
.env.production
*.key
*.pem
credentials.json
```

### Secret Sources by Environment

```typescript
// Development: .env.local file
// CI/CD: GitHub Secrets, GitLab CI Variables
// Production: Secret manager (AWS Secrets Manager, Vault, etc.)

// Example: AWS Secrets Manager
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function loadSecrets() {
  if (process.env.NODE_ENV !== 'production') {
    return; // Use .env in development
  }

  const client = new SecretsManager({ region: 'us-east-1' });
  const response = await client.getSecretValue({
    SecretId: 'app/production/secrets',
  });

  const secrets = JSON.parse(response.SecretString!);

  // Inject into process.env
  Object.assign(process.env, secrets);
}
```

### Secret Rotation

```typescript
// Support multiple keys during rotation
const API_KEYS = (process.env.API_KEYS || '').split(',').filter(Boolean);

function validateApiKey(key: string): boolean {
  return API_KEYS.includes(key);
}

// Graceful handling during rotation
const DB_PASSWORDS = [
  process.env.DATABASE_PASSWORD,
  process.env.DATABASE_PASSWORD_OLD,
].filter(Boolean);

async function connectWithFallback() {
  for (const password of DB_PASSWORDS) {
    try {
      return await connect({ password });
    } catch (error) {
      continue;
    }
  }
  throw new Error('All database passwords failed');
}
```

## Feature Flags

### Simple Feature Flags

```typescript
// Environment-based flags
const features = {
  newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
  betaApi: process.env.FEATURE_BETA_API === 'true',
  darkMode: process.env.FEATURE_DARK_MODE === 'true',
};

// Usage
if (features.newDashboard) {
  return <NewDashboard />;
}
return <Dashboard />;
```

### Typed Feature Flags

```typescript
const featureFlagSchema = z.object({
  FEATURE_NEW_DASHBOARD: z.coerce.boolean().default(false),
  FEATURE_BETA_API: z.coerce.boolean().default(false),
  FEATURE_MAX_ITEMS: z.coerce.number().default(100),
});

export const features = featureFlagSchema.parse(process.env);

// Type-safe access
if (features.FEATURE_NEW_DASHBOARD) {
  // ...
}
```

## Configuration Patterns

### Per-Environment Config

```typescript
interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
}

const databaseConfigs: Record<string, Partial<DatabaseConfig>> = {
  development: {
    poolSize: 5,
    ssl: false,
  },
  production: {
    poolSize: 20,
    ssl: true,
  },
  test: {
    poolSize: 1,
    ssl: false,
  },
};

export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  const defaults = databaseConfigs[env] || {};

  return {
    url: process.env.DATABASE_URL!,
    poolSize: Number(process.env.DATABASE_POOL_SIZE) || defaults.poolSize || 10,
    ssl: process.env.DATABASE_SSL === 'true' ?? defaults.ssl ?? false,
  };
}
```

### Config Namespacing

```typescript
// Organized config object
export const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || {{DEFAULT_APP_PORT}},
    host: process.env.HOST || '{{DEFAULT_APP_HOST}}',
  },
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: Number(process.env.DATABASE_POOL_SIZE) || 10,
  },
  redis: {
    url: process.env.REDIS_URL,
    enabled: Boolean(process.env.REDIS_URL),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
  features: {
    newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
  },
} as const;
```

## Validation

### Startup Validation

```typescript
// Validate all config at startup
function validateConfig() {
  const errors: string[] = [];

  // Required variables
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Format validation
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL');
  }

  // Numeric validation
  const port = Number(process.env.PORT);
  if (process.env.PORT && (isNaN(port) || port < 1 || port > 65535)) {
    errors.push('PORT must be a valid port number (1-65535)');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}

// Call at startup
validateConfig();
```

### Runtime Checks

```typescript
// For optional services, check at runtime
function getRedisClient() {
  if (!config.redis.enabled) {
    throw new Error('Redis is not configured. Set REDIS_URL to enable.');
  }
  return createRedisClient(config.redis.url);
}
```

## Known Gotchas

### Boolean Parsing

```typescript
// Environment variables are always strings
process.env.FEATURE_ENABLED = 'false';

// Bad - always truthy (non-empty string)
if (process.env.FEATURE_ENABLED) { }  // true!

// Good - explicit comparison
if (process.env.FEATURE_ENABLED === 'true') { }

// Best - use Zod coercion
const schema = z.object({
  FEATURE_ENABLED: z.coerce.boolean().default(false),
});
```

### Number Parsing

```typescript
// Bad - NaN if not set
const port = parseInt(process.env.PORT);  // NaN

// Good - with fallback
const port = parseInt(process.env.PORT || '{{DEFAULT_APP_PORT}}', 10);

// Best - with validation
const port = z.coerce.number().default({{DEFAULT_APP_PORT}}).parse(process.env.PORT);
```

### Variable Expansion

```bash
# .env
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Requires dotenv-expand
import { expand } from 'dotenv-expand';
expand(config());
```

### Docker Environment

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env.production

# Environment takes precedence over env_file
```

---

**See Also:**
- [Security Guidelines](../_universal/security.instructions.md)
- [Docker Guidelines](../docker/node.instructions.md)
- [CI/CD Guidelines](../ci-cd/)
