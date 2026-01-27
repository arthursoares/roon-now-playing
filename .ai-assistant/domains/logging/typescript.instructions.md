---
applyTo: "**/*.{ts,tsx,js,jsx}"
priority: high
role: [developer, reviewer]
---

# Logging Guidelines

> **Applies to:** All application code
> **Related:** [error-handling.instructions.md](./error-handling.instructions.md) | [security.instructions.md](./security.instructions.md)

## Core Principles

1. **Structured logging** - Use JSON format for machine parseability
2. **Appropriate levels** - Use correct severity for each message
3. **Contextual information** - Include relevant data for debugging
4. **No sensitive data** - Never log passwords, tokens, or PII
5. **Consistent format** - Same structure across the application

## Log Levels

### Level Hierarchy

| Level | When to Use |
|-------|-------------|
| `error` | Application errors requiring immediate attention |
| `warn` | Unexpected but handled situations |
| `info` | Significant business events |
| `debug` | Detailed debugging information |
| `trace` | Very detailed tracing (rarely used) |

### Level Selection Guide

```typescript
// ERROR - Something is broken, needs investigation
logger.error('Database connection failed', { error, retries: 3 });
logger.error('Payment processing failed', { orderId, error });

// WARN - Something unexpected but handled
logger.warn('Cache miss, fetching from database', { key });
logger.warn('Rate limit approaching', { current: 95, limit: 100 });
logger.warn('Deprecated API endpoint accessed', { endpoint, client });

// INFO - Business-significant events
logger.info('User registered', { userId, email });
logger.info('Order completed', { orderId, total, items: items.length });
logger.info('Application started', { port, environment });

// DEBUG - Development/troubleshooting details
logger.debug('Request received', { method, path, query });
logger.debug('Cache hit', { key, ttl });
logger.debug('Query executed', { sql, duration: '45ms' });

// TRACE - Extremely verbose (usually disabled)
logger.trace('Entering function', { fn: 'processItem', args });
```

## Structured Logging Format

### Logger Setup

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    service: process.env.SERVICE_NAME || 'app',
    environment: process.env.NODE_ENV || 'development',
  },
});

// Create child logger with context
export function createLogger(context: string) {
  return logger.child({ context });
}
```

### Log Structure

```typescript
// Every log entry should have:
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "api-gateway",
  "environment": "production",
  "context": "user-service",
  "message": "User registered",
  "userId": "user-123",
  "email": "j***@example.com",  // Masked
  "requestId": "req-456"
}
```

### Child Loggers

```typescript
// Create contextual logger for a module
const userLogger = createLogger('user-service');

// Add request context
function requestLogger(req: Request) {
  return logger.child({
    requestId: req.headers['x-request-id'],
    userId: req.user?.id,
    path: req.path,
  });
}

// Usage in request handler
app.get('/users/:id', (req, res) => {
  const log = requestLogger(req);
  log.info('Fetching user');
  // All logs from this request have the same requestId
});
```

## What to Log

### Do Log

```typescript
// Application lifecycle
logger.info('Application starting', { version, nodeVersion: process.version });
logger.info('Application ready', { port, healthCheck: '/health' });
logger.info('Application shutting down', { reason: 'SIGTERM' });

// Business events
logger.info('User action', { action: 'login', userId, method: 'oauth' });
logger.info('Transaction completed', { transactionId, amount, currency });
logger.info('Resource created', { resourceType: 'order', resourceId });

// Errors and failures
logger.error('Operation failed', { operation: 'payment', error: error.message, orderId });
logger.warn('External service degraded', { service: 'stripe', latency: '5000ms' });

// Performance metrics
logger.info('Request completed', { path, method, statusCode, duration: '150ms' });
logger.warn('Slow query detected', { query: 'findUsers', duration: '2500ms' });
```

### Don't Log

```typescript
// NEVER log these:
logger.info('User login', { password });           // Passwords
logger.debug('API call', { apiKey });              // API keys/tokens
logger.info('Payment', { creditCard });            // Financial data
logger.debug('Request', { authorization: token }); // Auth tokens
logger.info('User', { ssn, dateOfBirth });         // PII

// Mask sensitive data if needed for debugging
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

function maskCard(card: string): string {
  return `****${card.slice(-4)}`;
}

logger.info('User registered', { email: maskEmail(email) });
```

## Request Logging

### HTTP Request Logger

```typescript
import { v4 as uuidv4 } from 'uuid';

// Request logging middleware
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logFn = res.statusCode >= 400 ? logger.warn : logger.info;

    logFn.call(logger, 'Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.getHeader('content-length'),
    });
  });

  next();
}
```

### Correlation IDs

```typescript
// Pass correlation ID through async context
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<{ requestId: string }>();

// Middleware to set context
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  asyncLocalStorage.run({ requestId }, () => next());
});

// Logger that automatically includes correlation ID
function getLogger() {
  const store = asyncLocalStorage.getStore();
  return logger.child({ requestId: store?.requestId });
}

// Usage anywhere in the call stack
async function processOrder(orderId: string) {
  const log = getLogger();
  log.info('Processing order', { orderId });
  // requestId automatically included
}
```

## Error Logging

### Logging Errors

```typescript
// Log error with full context
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    operation: 'riskyOperation',
    error: error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : error,
    input: { /* relevant input data, sanitized */ },
  });
  throw error;
}

// For known errors, include error code
if (error instanceof AppError) {
  logger.error('Application error', {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
  });
}
```

### Error Aggregation

```typescript
// Include fields that help aggregate similar errors
logger.error('Database query failed', {
  errorCode: 'DB_CONNECTION_ERROR',
  errorType: error.constructor.name,
  database: 'users',
  operation: 'find',
  // These fields help group similar errors
});
```

## Performance Logging

### Timing Operations

```typescript
// Measure and log operation duration
async function timedOperation<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow operation', { operation: name, duration: `${duration}ms` });
    } else {
      logger.debug('Operation completed', { operation: name, duration: `${duration}ms` });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Operation failed', { operation: name, duration: `${duration}ms`, error });
    throw error;
  }
}

// Usage
const users = await timedOperation('fetchUsers', () => db.users.findMany());
```

### Metrics Logging

```typescript
// Log metrics for monitoring
logger.info('metrics', {
  type: 'gauge',
  metric: 'active_connections',
  value: connectionPool.activeCount,
});

logger.info('metrics', {
  type: 'histogram',
  metric: 'request_duration',
  value: duration,
  labels: { endpoint: '/api/users', method: 'GET' },
});
```

## Log Management

### Log Rotation

```typescript
import pino from 'pino';
import { createWriteStream } from 'pino-pretty';

// Development: pretty print
const devStream = createWriteStream({
  colorize: true,
  translateTime: 'HH:MM:ss',
  ignore: 'pid,hostname',
});

// Production: JSON to file with rotation
// Use external tools like logrotate or log shipping
const prodTransport = pino.transport({
  target: 'pino/file',
  options: { destination: '/var/log/app/app.log' },
});

export const logger = pino(
  { level: process.env.LOG_LEVEL || 'info' },
  process.env.NODE_ENV === 'production' ? prodTransport : devStream
);
```

### Log Sampling

```typescript
// For high-volume logs, use sampling
function shouldSample(rate: number): boolean {
  return Math.random() < rate;
}

// Log 10% of debug messages in production
if (shouldSample(0.1)) {
  logger.debug('Detailed operation info', { data });
}

// Always log errors, sample info
if (level === 'error' || shouldSample(0.5)) {
  logger.log(level, message, data);
}
```

## Console.log Prohibition

### Never Use console.log

```typescript
// Bad - loses structure, hard to filter
console.log('User logged in:', userId);
console.error('Error:', error);

// Good - structured, filterable
logger.info('User logged in', { userId });
logger.error('Operation failed', { error: error.message });
```

### ESLint Rule

```json
{
  "rules": {
    "no-console": "error"
  }
}
```

## Known Gotchas

### Circular References

```typescript
// Bad - causes JSON.stringify to fail
const obj = { a: 1 };
obj.self = obj;
logger.info('Data', obj);  // Error!

// Good - use safe serialization
import { serialize } from 'safe-stable-stringify';

function safeLog(data: unknown) {
  try {
    return JSON.parse(serialize(data));
  } catch {
    return '[Unserializable]';
  }
}
```

### Large Objects

```typescript
// Bad - logs entire large object
logger.debug('Response', { data: hugeArray });

// Good - log summary
logger.debug('Response', {
  dataCount: hugeArray.length,
  sampleIds: hugeArray.slice(0, 5).map(d => d.id),
});
```

### Async Context Loss

```typescript
// Bad - loses request context
setTimeout(() => {
  logger.info('Delayed operation');  // No requestId
}, 1000);

// Good - preserve context
const requestId = getCurrentRequestId();
setTimeout(() => {
  logger.info('Delayed operation', { requestId });
}, 1000);
```

### Log Level in Production

```typescript
// Don't log debug in production by default
const logger = pino({
  level: process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
});
```

---

**See Also:**
- [Error Handling Guidelines](./error-handling.instructions.md)
- [Security Guidelines](./security.instructions.md)
- [Performance Guidelines](./performance.instructions.md)
