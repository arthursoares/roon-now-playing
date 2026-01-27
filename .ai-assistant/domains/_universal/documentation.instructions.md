---
applyTo: "**/*"
priority: medium
role: [developer, reviewer]
---

# Documentation Guidelines

> **Applies to:** All code documentation, comments, and READMEs
> **Related:** [naming.instructions.md](./naming.instructions.md) | [code-review.instructions.md](./code-review.instructions.md)

## Core Principles

1. **Code is primary** - Self-documenting code first, comments second
2. **Explain why, not what** - Comments explain intent, not mechanics
3. **Keep in sync** - Outdated docs are worse than no docs
4. **Audience-aware** - Write for the reader, not yourself
5. **Minimal but sufficient** - Document what's needed, no more

## Code Comments

### When to Comment

```typescript
// Good - explains WHY
// Clamp to [-60, 20] range to prevent speaker damage
const clampedGain = Math.max(-60, Math.min(20, totalGain));

// Good - explains non-obvious behavior
// setTimeout with 0 moves to next event loop tick,
// ensuring DOM has updated before measurement
setTimeout(() => measureHeight(), 0);

// Good - references external context
// Algorithm from https://en.wikipedia.org/wiki/Exponential_backoff
const delay = baseDelay * Math.pow(2, attempt);

// Bad - states the obvious
// Increment counter
counter++;

// Bad - paraphrases code
// Check if user is admin
if (user.role === 'admin') { ... }
```

### When NOT to Comment

```typescript
// Don't comment self-explanatory code
function calculateTotalPrice(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

// Don't leave commented-out code
// function oldImplementation() { ... }  // DELETE THIS

// Don't use comments as version control
// Added by John on 2024-01-15  // Use git blame instead

// Don't explain bad code, fix it instead
// i is the index  // Just name it `index`
for (let i = 0; i < arr.length; i++) { ... }
```

### TODO Comments

```typescript
// Standard format: TODO(username): description
// TODO(alice): Handle pagination for large result sets

// With issue reference
// TODO(JIRA-123): Migrate to new API before deprecation

// Types of markers
// TODO: Future improvement
// FIXME: Known bug that needs fixing
// HACK: Temporary workaround
// NOTE: Important information for maintainers

// Don't leave indefinite TODOs
// TODO: Fix this later  // BAD - when? what?
// TODO(bob): Add retry logic for network failures - see ISSUE-456  // GOOD
```

## JSDoc Comments

### Functions

```typescript
/**
 * Calculates the total price including tax and discounts.
 *
 * @param items - Array of cart items with price and quantity
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @param discount - Optional discount amount in dollars
 * @returns Total price after tax and discount
 *
 * @example
 * ```ts
 * const total = calculateTotal(
 *   [{ price: 10, quantity: 2 }],
 *   0.08,
 *   5
 * );
 * // Returns: 16.6 (20 + 1.6 tax - 5 discount)
 * ```
 *
 * @throws {ValidationError} If items array is empty
 */
export function calculateTotal(
  items: CartItem[],
  taxRate: number,
  discount?: number
): number {
  // Implementation
}
```

### Interfaces and Types

```typescript
/**
 * Represents a user in the system.
 *
 * Users can have different roles that determine their permissions.
 * See {@link UserRole} for available roles.
 */
export interface User {
  /** Unique identifier (UUID v4) */
  id: string;

  /** User's display name (1-100 characters) */
  name: string;

  /** Email address (must be unique, used for authentication) */
  email: string;

  /** User's role in the system */
  role: UserRole;

  /** ISO 8601 timestamp of account creation */
  createdAt: string;

  /**
   * Last login timestamp, or null if never logged in.
   * Updated on each successful authentication.
   */
  lastLoginAt: string | null;
}
```

### Classes

```typescript
/**
 * Manages WebSocket connections with automatic reconnection.
 *
 * @example
 * ```ts
 * const socket = new ReconnectingWebSocket('wss://api.example.com');
 * socket.on('message', handleMessage);
 * socket.connect();
 * ```
 *
 * @remarks
 * Uses exponential backoff for reconnection attempts.
 * Maximum 5 reconnection attempts before giving up.
 */
export class ReconnectingWebSocket {
  /**
   * Creates a new WebSocket manager.
   *
   * @param url - WebSocket server URL
   * @param options - Configuration options
   */
  constructor(url: string, options?: WebSocketOptions) {
    // ...
  }

  /**
   * Initiates connection to the server.
   *
   * @returns Promise that resolves when connected
   * @throws {ConnectionError} If connection fails after all retries
   */
  async connect(): Promise<void> {
    // ...
  }
}
```

## README Files

### Project README Structure

```markdown
# Project Name

Brief description of what this project does.

## Features

- Feature 1
- Feature 2
- Feature 3

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Installation

Detailed installation instructions...

## Usage

Basic usage examples...

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DEBUG` | Enable debug mode | `false` |

## API Reference

Link to detailed API docs or brief overview...

## Contributing

How to contribute to the project...

## License

MIT License - see LICENSE file
```

### Component/Module README

```markdown
# ComponentName

Brief description of what this component does and when to use it.

## Usage

\`\`\`tsx
import { ComponentName } from './ComponentName';

<ComponentName
  prop1="value"
  prop2={123}
  onEvent={handleEvent}
/>
\`\`\`

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `prop1` | `string` | Yes | - | Description |
| `prop2` | `number` | No | `0` | Description |

## Examples

### Basic Usage
...

### With Custom Styling
...

## Notes

- Important consideration 1
- Important consideration 2
```

## API Documentation

### Endpoint Documentation

```typescript
/**
 * @api {post} /api/users Create User
 * @apiName CreateUser
 * @apiGroup Users
 * @apiVersion 1.0.0
 *
 * @apiBody {String} name User's display name (1-100 chars)
 * @apiBody {String} email User's email address
 * @apiBody {String="admin","user","guest"} [role=user] User's role
 *
 * @apiSuccess {Object} data Created user object
 * @apiSuccess {String} data.id User's unique ID
 * @apiSuccess {String} data.name User's display name
 * @apiSuccess {String} data.email User's email
 *
 * @apiError (400) ValidationError Invalid input data
 * @apiError (409) ConflictError Email already exists
 *
 * @apiExample {curl} Example:
 *     curl -X POST https://api.example.com/users \
 *       -H "Content-Type: application/json" \
 *       -d '{"name": "John", "email": "john@example.com"}'
 */
```

### OpenAPI/Swagger

```yaml
paths:
  /users:
    post:
      summary: Create a new user
      description: Creates a new user account with the provided information.
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - email
              properties:
                name:
                  type: string
                  minLength: 1
                  maxLength: 100
                  description: User's display name
                email:
                  type: string
                  format: email
                  description: User's email address
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Validation error
        '409':
          description: Email already exists
```

## Architecture Decision Records (ADRs)

### ADR Template

```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status

Accepted

## Context

We need to choose a primary database for the application.
Requirements include:
- ACID compliance for financial transactions
- Complex querying capabilities
- Horizontal scalability potential
- Team familiarity

## Decision

We will use PostgreSQL as our primary database.

## Consequences

### Positive
- Strong ACID guarantees
- Rich query language and indexing
- Excellent JSON support for flexible schemas
- Large community and ecosystem

### Negative
- Requires more operational expertise than managed NoSQL
- Horizontal scaling requires additional tooling (Citus, etc.)

### Neutral
- Will need to set up replication for high availability

## Alternatives Considered

1. **MongoDB** - Rejected due to ACID requirements
2. **MySQL** - Viable but PostgreSQL has better JSON support
3. **CockroachDB** - Considered for future if scale requires

## References

- [PostgreSQL vs MongoDB](https://example.com/comparison)
- Team discussion notes from 2024-01-10
```

## Inline Documentation

### Magic Numbers

```typescript
// Bad - what does 86400000 mean?
setTimeout(cleanup, 86400000);

// Good - named constant with context
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(cleanup, ONE_DAY_MS);

// Or with comment
setTimeout(cleanup, 86400000); // 24 hours in milliseconds
```

### Complex Algorithms

```typescript
/**
 * Implements Fisher-Yates shuffle for unbiased randomization.
 *
 * Time complexity: O(n)
 * Space complexity: O(1) - in-place
 *
 * @see https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];

  // Iterate from last element to second element
  for (let i = result.length - 1; i > 0; i--) {
    // Pick random index from 0 to i (inclusive)
    const j = Math.floor(Math.random() * (i + 1));
    // Swap elements at i and j
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
```

### Regex Patterns

```typescript
// Always document complex regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Matches: local@domain.tld
// Parts: [^\s@]+ (local) @ [^\s@]+ (domain) \. [^\s@]+ (tld)

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Matches: "hello-world", "post-123"
// Doesn't match: "-hello", "hello-", "Hello"
```

## Documentation Anti-Patterns

### Avoid

```typescript
// Redundant documentation
/**
 * Gets the user.
 * @param id - The id
 * @returns The user
 */
function getUser(id: string): User { ... }

// Outdated documentation (worse than none)
/**
 * Returns user's full name.  // Actually returns email now!
 */
function getUserEmail(): string { ... }

// Over-documentation
/**
 * This function adds two numbers together.
 * It takes two parameters, a and b, both of which are numbers.
 * It returns the sum of these two numbers.
 * The return type is number.
 *
 * @param a - The first number to add
 * @param b - The second number to add
 * @returns The sum of a and b
 */
function add(a: number, b: number): number {
  return a + b;
}
```

## Known Gotchas

### Documentation Drift

```typescript
// Documentation can become outdated
// Strategy: Include documentation in code review checklist
// Update docs when changing code behavior
```

### JSDoc Parsing

```typescript
// Some tools don't parse all JSDoc tags
// Stick to common tags: @param, @returns, @throws, @example

// Generic syntax can be tricky
/**
 * @template T
 * @param {T[]} items
 * @returns {T | undefined}
 */
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

---

**See Also:**
- [Naming Guidelines](./naming.instructions.md)
- [Code Review Guidelines](./code-review.instructions.md)
- [TypeScript Guidelines](./typescript.instructions.md)
