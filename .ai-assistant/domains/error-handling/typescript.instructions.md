---
applyTo: "**/*.{ts,tsx,js,jsx}"
priority: high
role: [developer, reviewer]
---

# Error Handling Guidelines

> **Applies to:** All application code
> **Related:** [api.instructions.md](./api.instructions.md) | [logging.instructions.md](./logging.instructions.md)

## Core Principles

1. **Fail fast** - Detect errors early, don't let them propagate silently
2. **Fail gracefully** - Provide meaningful feedback, don't crash unnecessarily
3. **Be specific** - Use typed errors with clear messages
4. **Don't swallow errors** - Always log or handle, never ignore
5. **User-friendly messages** - Technical details for logs, human messages for users

## Error Types

### Custom Error Classes

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429);
  }
}
```

### Error Code Catalog

```typescript
// Centralized error codes
export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // External
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;
```

## Try-Catch Patterns

### Basic Pattern

```typescript
// Always type error as unknown
try {
  await riskyOperation();
} catch (error: unknown) {
  if (error instanceof AppError) {
    // Known application error - handle specifically
    logger.warn('Operation failed', { code: error.code, message: error.message });
    throw error;
  }

  if (error instanceof Error) {
    // Unknown error - wrap it
    logger.error('Unexpected error', { error: error.message, stack: error.stack });
    throw new AppError('An unexpected error occurred', 'INTERNAL_ERROR', 500, false);
  }

  // Non-Error thrown (rare)
  logger.error('Unknown error type', { error });
  throw new AppError('An unexpected error occurred', 'INTERNAL_ERROR', 500, false);
}
```

### Never Swallow Errors

```typescript
// Bad - error is silently swallowed
try {
  await saveData();
} catch (error) {
  // Nothing happens - bug goes unnoticed
}

// Bad - generic catch with no logging
try {
  await saveData();
} catch {
  return null;
}

// Good - always log or rethrow
try {
  await saveData();
} catch (error) {
  logger.error('Failed to save data', { error });
  throw error;
}

// Good - handle with fallback AND log
try {
  return await fetchFromCache();
} catch (error) {
  logger.warn('Cache miss, fetching from source', { error });
  return await fetchFromSource();
}
```

### Async Error Handling

```typescript
// Promise chains
fetchData()
  .then(processData)
  .then(saveData)
  .catch(error => {
    logger.error('Pipeline failed', { error });
    throw error;
  });

// Async/await (preferred)
async function pipeline() {
  try {
    const data = await fetchData();
    const processed = await processData(data);
    return await saveData(processed);
  } catch (error) {
    logger.error('Pipeline failed', { error });
    throw error;
  }
}

// Promise.all - one failure fails all
try {
  const [users, orders] = await Promise.all([
    fetchUsers(),
    fetchOrders(),
  ]);
} catch (error) {
  // Any failure ends up here
}

// Promise.allSettled - handle partial success
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(),
]);

results.forEach((result, index) => {
  if (result.status === 'rejected') {
    logger.error(`Operation ${index} failed`, { error: result.reason });
  }
});
```

## Error Boundaries (UI)

### React Error Boundary

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React error boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

### Vue Error Handler

```typescript
// Global error handler
app.config.errorHandler = (error, instance, info) => {
  logger.error('Vue error', {
    error: error instanceof Error ? error.message : error,
    component: instance?.$options.name,
    info,
  });
};

// Component-level
export default {
  errorCaptured(error: Error, instance: ComponentPublicInstance, info: string) {
    logger.error('Component error', { error: error.message, info });
    return false; // Don't propagate
  }
};
```

## API Error Handling

### Express/Node.js

```typescript
// Error handling middleware (must be last)
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Determine response
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      }
    });
  }

  // Unknown error - don't expose details
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }
  });
});

// Async handler wrapper
const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User', req.params.id);
  }
  res.json({ data: user });
}));
```

### Client-Side API Errors

```typescript
// API client error handling
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error?.message || `HTTP ${response.status}`,
        errorData.error?.code || 'API_ERROR',
        response.status
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error or other failure
    throw new ApiError(
      'Network request failed',
      'NETWORK_ERROR',
      0
    );
  }
}
```

## User-Facing Error Messages

### Message Mapping

```typescript
// Technical error codes to user messages
const userMessages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You don\'t have permission to perform this action.',
  NOT_FOUND: 'The requested item could not be found.',
  CONFLICT: 'This action conflicts with existing data.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
  NETWORK_ERROR: 'Connection failed. Please check your internet.',
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
};

export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return userMessages[error.code] || userMessages.INTERNAL_ERROR;
  }
  return userMessages.INTERNAL_ERROR;
}
```

### Form Validation Errors

```typescript
// Display field-level errors
function renderFieldError(errors: ValidationError['fields'], fieldName: string): string | undefined {
  const fieldError = errors.find(e => e.field === fieldName);
  return fieldError?.message;
}

// Usage in form
<input name="email" />
{errors.email && <span className="error">{errors.email}</span>}
```

## Recovery Patterns

### Retry with Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const { maxRetries, baseDelay, shouldRetry = isRetryable } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, { delay });
      await sleep(delay);
    }
  }

  throw new Error('Unreachable');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return [429, 500, 502, 503, 504].includes(error.statusCode);
  }
  return false;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure || 0) > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new AppError('Circuit breaker is open', 'CIRCUIT_OPEN', 503);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened', { failures: this.failures });
    }
  }
}
```

## Known Gotchas

### Error Type in Catch

```typescript
// TypeScript catch clause variable is `unknown`
try {
  await operation();
} catch (error) {
  // error is unknown - must narrow
  if (error instanceof Error) {
    console.log(error.message);
  }
}
```

### Async Errors in Callbacks

```typescript
// Bad - unhandled promise rejection
array.forEach(async item => {
  await processItem(item); // Error won't be caught
});

// Good - use Promise.all or for...of
await Promise.all(array.map(async item => {
  await processItem(item);
}));

// Or sequential with for...of
for (const item of array) {
  await processItem(item);
}
```

### Error Stack Traces

```typescript
// Preserve stack trace when wrapping errors
try {
  await operation();
} catch (error) {
  const wrappedError = new AppError('Wrapped error', 'WRAPPED');
  if (error instanceof Error) {
    wrappedError.cause = error; // ES2022+
  }
  throw wrappedError;
}
```

### Unhandled Promise Rejections

```typescript
// Global handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason });
  // In production, you might want to exit gracefully
});

// Browser
window.addEventListener('unhandledrejection', event => {
  logger.error('Unhandled promise rejection', { reason: event.reason });
});
```

---

**See Also:**
- [Logging Guidelines](./logging.instructions.md)
- [API Guidelines](./api.instructions.md)
- [Testing Guidelines](./testing.instructions.md)
