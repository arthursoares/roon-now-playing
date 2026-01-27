---
applyTo: "**/*.{ts,js}"
priority: high
role: [developer, architect, reviewer]
---

# API Design Guidelines

> **Applies to:** All API endpoints and client code
> **Related:** [error-handling.instructions.md](../error-handling/typescript.instructions.md) | [security.instructions.md](../_universal/security.instructions.md)

## Core Principles

1. **Consistency** - Same patterns everywhere
2. **Predictability** - Clients know what to expect
3. **Discoverability** - APIs are self-documenting
4. **Resilience** - Graceful degradation, proper error handling

## REST API Design

### URL Structure

```
# Collection resources (plural nouns)
GET    /api/users              # List users
POST   /api/users              # Create user
GET    /api/users/:id          # Get user
PUT    /api/users/:id          # Replace user
PATCH  /api/users/:id          # Update user
DELETE /api/users/:id          # Delete user

# Nested resources (relationships)
GET    /api/users/:id/orders   # User's orders
POST   /api/users/:id/orders   # Create order for user

# Actions (when CRUD doesn't fit)
POST   /api/users/:id/activate
POST   /api/orders/:id/cancel
```

### Naming Conventions

```typescript
// Use plural nouns for collections
/api/users          // Not /api/user
/api/products       // Not /api/product

// Use kebab-case for multi-word resources
/api/order-items    // Not /api/orderItems
/api/user-profiles  // Not /api/userProfiles

// Avoid verbs in URLs (use HTTP methods)
GET /api/users      // Not GET /api/getUsers
DELETE /api/users/1 // Not POST /api/deleteUser
```

### HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Read resource | Yes | Yes |
| POST | Create resource | No | No |
| PUT | Replace resource | Yes | No |
| PATCH | Partial update | Yes | No |
| DELETE | Remove resource | Yes | No |

### Status Codes

```typescript
// Success
200 OK              // Successful GET, PUT, PATCH
201 Created         // Successful POST (include Location header)
204 No Content      // Successful DELETE

// Client Errors
400 Bad Request     // Invalid input, validation failed
401 Unauthorized    // Not authenticated
403 Forbidden       // Authenticated but not authorized
404 Not Found       // Resource doesn't exist
409 Conflict        // Resource state conflict
422 Unprocessable   // Semantic validation error

// Server Errors
500 Internal Error  // Unexpected server error
502 Bad Gateway     // Upstream service failed
503 Unavailable     // Service temporarily down
504 Gateway Timeout // Upstream service timeout
```

## Request/Response Format

### Request Structure

```typescript
// Query parameters for filtering/pagination
GET /api/users?status=active&page=1&limit=20&sort=-createdAt

// Request body for mutations
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin"
}
```

### Response Structure

```typescript
// Single resource
{
  "data": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Collection with pagination
{
  "data": [
    { "id": "user-1", "name": "Alice" },
    { "id": "user-2", "name": "Bob" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "age", "message": "Must be at least 18" }
    ]
  }
}
```

### Type Definitions

```typescript
// Standard API response wrapper
interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// Paginated response
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error response
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
  };
}
```

## API Client Implementation

### HTTP Client Wrapper

```typescript
// Base API client
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(response.status, error);
  }

  return response.json();
}

// Typed API methods
export const api = {
  get: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
```

### Request Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryOn: [408, 429, 500, 502, 503, 504],
};

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok && config.retryOn.includes(response.status)) {
        throw new RetryableError(response.status);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;

      if (attempt < config.maxRetries && isRetryable(error)) {
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

## Versioning

### URL Versioning (Recommended)

```
/api/v1/users
/api/v2/users
```

### Header Versioning (Alternative)

```
GET /api/users
Accept: application/vnd.api.v2+json
```

### Deprecation Strategy

```typescript
// Response header for deprecated endpoints
X-API-Deprecated: true
X-API-Sunset: 2024-06-01
X-API-Successor: /api/v2/users

// Log deprecation warnings
app.use('/api/v1/*', (req, res, next) => {
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Sunset', '2024-06-01');
  logger.warn('Deprecated API accessed', {
    path: req.path,
    client: req.headers['user-agent']
  });
  next();
});
```

## Query Parameters

### Filtering

```
# Equality
GET /api/users?status=active

# Multiple values
GET /api/users?status=active,pending

# Comparison operators
GET /api/products?price[gte]=100&price[lte]=500

# Search
GET /api/users?search=john
```

### Sorting

```
# Single field (prefix with - for descending)
GET /api/users?sort=-createdAt

# Multiple fields
GET /api/users?sort=-createdAt,name
```

### Pagination

```
# Offset-based
GET /api/users?page=2&limit=20

# Cursor-based (for large datasets)
GET /api/users?cursor=eyJpZCI6MTIzfQ&limit=20
```

### Field Selection

```
# Include only specific fields
GET /api/users?fields=id,name,email

# Expand related resources
GET /api/orders?expand=customer,items
```

## Rate Limiting

### Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### 429 Response

```typescript
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

## Caching

### Cache Headers

```typescript
// Static resources
Cache-Control: public, max-age=31536000, immutable

// Dynamic but cacheable
Cache-Control: private, max-age=300
ETag: "abc123"

// Never cache
Cache-Control: no-store
```

### Conditional Requests

```typescript
// Client sends
If-None-Match: "abc123"

// Server responds
304 Not Modified  // If unchanged
200 OK            // If changed, with new ETag
```

## Common Patterns

### Bulk Operations

```typescript
// Batch create
POST /api/users/batch
{
  "items": [
    { "name": "Alice", "email": "alice@example.com" },
    { "name": "Bob", "email": "bob@example.com" }
  ]
}

// Response with partial success
{
  "data": {
    "succeeded": [{ "id": "1", "name": "Alice" }],
    "failed": [{ "index": 1, "error": "Email already exists" }]
  }
}
```

### Long-Running Operations

```typescript
// Start operation
POST /api/reports/generate
Response: 202 Accepted
{
  "data": {
    "operationId": "op-123",
    "status": "pending",
    "statusUrl": "/api/operations/op-123"
  }
}

// Poll for status
GET /api/operations/op-123
{
  "data": {
    "operationId": "op-123",
    "status": "completed",
    "result": { "downloadUrl": "/api/reports/report-456" }
  }
}
```

### Webhooks

```typescript
// Webhook payload
{
  "id": "evt-123",
  "type": "order.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "orderId": "order-456",
    "total": 99.99
  }
}

// Webhook signature verification
const signature = req.headers['x-webhook-signature'];
const isValid = verifySignature(payload, signature, secret);
```

## Known Gotchas

### Content-Type Matters

```typescript
// Always set Content-Type for POST/PUT/PATCH
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Empty Responses

```typescript
// 204 No Content has no body - don't try to parse
if (response.status === 204) {
  return null;
}
return response.json();
```

### Trailing Slashes

Be consistent - pick one and stick to it:
```
/api/users      // Preferred
/api/users/     // Alternative (configure redirects)
```

### Date Formats

Always use ISO 8601 in UTC:
```typescript
{
  "createdAt": "2024-01-15T10:30:00Z"  // UTC
}
```

---

**See Also:**
- [Error Handling Guidelines](../error-handling/typescript.instructions.md)
- [Security Guidelines](../_universal/security.instructions.md)
- [Data Validation Guidelines](../validation/zod.instructions.md)
