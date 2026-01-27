---
applyTo: "**/*.{ts,tsx,js,jsx}"
priority: critical
role: [developer, reviewer, architect]
---

# Security Guidelines

> **Applies to:** All application code
> **Related:** [api.instructions.md](./api.instructions.md) | [env-config.instructions.md](./env-config.instructions.md)

## Core Principles

1. **Defense in depth** - Multiple layers of security
2. **Least privilege** - Minimum permissions required
3. **Fail secure** - Default to denying access
4. **Never trust input** - Validate everything from external sources
5. **Keep secrets secret** - Never expose sensitive data

## Input Validation

### Validate All External Input

```typescript
// External input sources:
// - URL parameters
// - Request body
// - Query strings
// - Headers
// - File uploads
// - WebSocket messages

// Always validate before processing
function handleRequest(req: Request) {
  const userId = validateUserId(req.params.id);  // Throws if invalid
  const data = validateUserInput(req.body);       // Throws if invalid
  return processUser(userId, data);
}
```

### Validation Patterns

```typescript
import { z } from 'zod';

// Schema-based validation
const UserInputSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
});

function validateUserInput(input: unknown) {
  return UserInputSchema.parse(input);  // Throws ZodError if invalid
}

// Sanitize strings
function sanitizeString(input: string): string {
  return input
    .trim()
    .slice(0, 1000);  // Limit length
}

// Validate IDs (prevent injection)
function validateId(id: string): string {
  if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
    throw new ValidationError('Invalid ID format');
  }
  return id;
}
```

## XSS Prevention

### Never Inject Untrusted Data

```typescript
// Bad - XSS vulnerability
element.innerHTML = userInput;
document.write(userInput);

// Good - use text content or sanitization
element.textContent = userInput;

// Good - use framework's escaping
// React escapes by default
<div>{userInput}</div>

// Vue escapes by default
<div>{{ userInput }}</div>
```

### When HTML is Required

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML before rendering
const sanitizedHtml = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target'],
});

// React dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

// Vue v-html
<div v-html="sanitizedHtml" />
```

### Content Security Policy

```typescript
// Set CSP headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +  // Avoid unsafe-inline if possible
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.example.com"
  );
  next();
});
```

## SQL Injection Prevention

### Always Use Parameterized Queries

```typescript
// Bad - SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = '${userId}'`;
db.query(query);

// Good - parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// Good - with ORM (Prisma)
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// Good - with query builder (Knex)
const user = await knex('users')
  .where('id', userId)
  .first();
```

### Dynamic Column Names

```typescript
// If column name comes from user input, whitelist it
const allowedColumns = ['name', 'email', 'created_at'] as const;
type AllowedColumn = typeof allowedColumns[number];

function sortBy(column: string, direction: 'asc' | 'desc') {
  if (!allowedColumns.includes(column as AllowedColumn)) {
    throw new ValidationError('Invalid sort column');
  }
  return knex('users').orderBy(column, direction);
}
```

## Authentication

### Password Handling

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password before storing
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Password requirements
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character');
```

### JWT Handling

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '15m';       // Short-lived access token
const REFRESH_TOKEN_EXPIRES = '7d'; // Longer refresh token

interface TokenPayload {
  userId: string;
  role: string;
}

// Generate tokens
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify tokens
function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
}

// Store refresh tokens securely (database, not localStorage)
// Implement token rotation on refresh
```

### Session Security

```typescript
// Secure cookie settings
app.use(session({
  secret: process.env.SESSION_SECRET!,
  name: 'sessionId',  // Don't use default name
  cookie: {
    httpOnly: true,   // Prevent XSS access
    secure: true,     // HTTPS only
    sameSite: 'lax',  // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  },
  resave: false,
  saveUninitialized: false,
}));
```

## Authorization

### Check Permissions

```typescript
// Middleware for route protection
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}

// Usage
app.get('/admin', requireAuth, requireRole('admin'), adminHandler);
```

### Resource-Level Authorization

```typescript
// Always verify ownership/access
async function getDocument(userId: string, docId: string) {
  const doc = await db.documents.findById(docId);

  if (!doc) {
    throw new NotFoundError('Document', docId);
  }

  // Check ownership
  if (doc.ownerId !== userId) {
    // Don't reveal document exists
    throw new NotFoundError('Document', docId);
  }

  return doc;
}
```

## CSRF Protection

### Token-Based Protection

```typescript
import csrf from 'csurf';

// Enable CSRF protection
app.use(csrf({ cookie: true }));

// Include token in forms
app.get('/form', (req, res) => {
  res.render('form', { csrfToken: req.csrfToken() });
});

// Token is automatically validated on POST
```

### SameSite Cookies

```typescript
// SameSite attribute prevents CSRF
res.cookie('session', sessionId, {
  sameSite: 'strict', // Or 'lax' for GET requests from external sites
  httpOnly: true,
  secure: true,
});
```

## Secrets Management

### Never Hardcode Secrets

```typescript
// Bad - hardcoded secret
const API_KEY = 'sk_live_abc123xyz';

// Bad - secret in code even if env checked
const API_KEY = process.env.API_KEY || 'sk_live_abc123xyz';

// Good - environment variable, fail if missing
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
```

### Secrets Checklist

```typescript
// Never commit these to git:
// - API keys
// - Database credentials
// - JWT secrets
// - OAuth client secrets
// - Encryption keys
// - Private certificates

// .gitignore
.env
.env.*
*.key
*.pem
credentials.json
secrets/
```

### Secret Rotation

```typescript
// Support multiple keys during rotation
const API_KEYS = (process.env.API_KEYS || '').split(',');

function validateApiKey(key: string): boolean {
  return API_KEYS.includes(key);
}
```

## Security Headers

```typescript
import helmet from 'helmet';

// Use helmet for security headers
app.use(helmet());

// Or set individually
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HTTP Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
});
```

## Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many login attempts' } },
});

app.use('/api/', apiLimiter);
app.use('/auth/', authLimiter);
```

## File Upload Security

```typescript
import multer from 'multer';
import path from 'path';

// Restrict file types
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
const maxFileSize = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads',
    filename: (req, file, cb) => {
      // Generate safe filename
      const ext = path.extname(file.originalname);
      const safeName = `${Date.now()}-${Math.random().toString(36)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

// Validate file content, not just extension
import fileType from 'file-type';

async function validateFileContent(buffer: Buffer): Promise<boolean> {
  const type = await fileType.fromBuffer(buffer);
  return type !== undefined && allowedMimeTypes.includes(type.mime);
}
```

## Logging Security Events

```typescript
// Log security-relevant events
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  logger.warn(`SECURITY: ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
  });
}

// Examples
logSecurityEvent('LOGIN_FAILED', { email, ip, reason: 'invalid_password' });
logSecurityEvent('UNAUTHORIZED_ACCESS', { userId, resource, ip });
logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip, endpoint });
logSecurityEvent('SUSPICIOUS_INPUT', { input: sanitized, ip });
```

## Known Gotchas

### URL Parameter Injection

```typescript
// Bad - open redirect
res.redirect(req.query.returnUrl);

// Good - validate redirect URL
const allowedHosts = ['example.com', 'app.example.com'];
function safeRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    if (!allowedHosts.includes(parsed.host)) {
      return '/';
    }
    return url;
  } catch {
    return '/';
  }
}
```

### Timing Attacks

```typescript
// Bad - timing attack on password comparison
if (password === storedPassword) { ... }

// Good - constant-time comparison
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
```

### Prototype Pollution

```typescript
// Bad - vulnerable to prototype pollution
function merge(target: any, source: any) {
  for (const key in source) {
    target[key] = source[key];
  }
}

// Good - check for dangerous keys
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(source)) {
    if (!dangerous.includes(key)) {
      target[key] = source[key];
    }
  }
}
```

### Information Disclosure

```typescript
// Bad - reveals system information
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,  // Never in production!
  });
});

// Good - generic error for unknown errors
app.use((err, req, res, next) => {
  logger.error('Request failed', { err });

  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    });
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
});
```

---

**See Also:**
- [API Guidelines](./api.instructions.md)
- [Environment Configuration](./env-config.instructions.md)
- [Error Handling Guidelines](./error-handling.instructions.md)
