---
applyTo: "**/*.{ts,js,sql}"
priority: high
role: [developer, reviewer]
---

# Database Guidelines

> **Applies to:** All database operations and schema design
> **Related:** [api.instructions.md](../api/typescript-rest.instructions.md) | [performance.instructions.md](../performance/typescript.instructions.md)

## Core Principles

1. **Data integrity** - Use constraints, transactions, foreign keys
2. **Query efficiency** - Optimize queries, use indexes
3. **Safe migrations** - Always reversible, no data loss
4. **Security** - Parameterized queries, least privilege
5. **Consistency** - Naming conventions, patterns

## Schema Design

### Naming Conventions

```sql
-- Tables: plural, snake_case
CREATE TABLE users (...);
CREATE TABLE order_items (...);

-- Columns: snake_case
CREATE TABLE users (
  id UUID PRIMARY KEY,
  first_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Primary keys: id or table_name_id
id UUID PRIMARY KEY  -- Preferred
user_id UUID PRIMARY KEY  -- Also acceptable

-- Foreign keys: referenced_table_id
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  shipping_address_id UUID REFERENCES addresses(id)
);

-- Indexes: idx_table_column(s)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at);

-- Unique constraints: uq_table_column(s)
CREATE UNIQUE INDEX uq_users_email ON users(email);
```

### Standard Columns

```sql
-- Every table should have these
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... other columns ...
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Soft delete pattern (when needed)
CREATE TABLE orders (
  -- ...
  deleted_at TIMESTAMP WITH TIME ZONE,  -- NULL = not deleted
  -- ...
);
```

### Use Appropriate Types

```sql
-- IDs
id UUID PRIMARY KEY  -- Preferred for distributed systems
id SERIAL PRIMARY KEY  -- OK for simple apps

-- Strings
name VARCHAR(100)  -- When length matters
description TEXT  -- No length limit

-- Numbers
price DECIMAL(10, 2)  -- Money (precise)
quantity INTEGER  -- Whole numbers
rating NUMERIC(3, 2)  -- Decimals with precision

-- Dates/Times
created_at TIMESTAMP WITH TIME ZONE  -- Always use timezone
birth_date DATE  -- Date only
duration INTERVAL  -- Time spans

-- Booleans
is_active BOOLEAN DEFAULT true

-- JSON (use sparingly)
metadata JSONB  -- Structured data (JSONB for indexing)
```

## Queries

### Parameterized Queries

```typescript
// Always use parameterized queries
// Bad - SQL injection vulnerability
const query = `SELECT * FROM users WHERE email = '${email}'`;

// Good - parameterized
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);

// Good - with ORM
const user = await prisma.user.findUnique({
  where: { email },
});

// Good - with query builder
const user = await knex('users').where('email', email).first();
```

### Efficient Queries

```typescript
// Select only needed columns
// Bad
SELECT * FROM users;

// Good
SELECT id, name, email FROM users;

// Avoid N+1 queries
// Bad - N+1
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [user.id]);
}

// Good - JOIN or subquery
const usersWithOrders = await db.query(`
  SELECT u.*, json_agg(o.*) as orders
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id
`);

// Good - separate queries with IN
const users = await db.query('SELECT * FROM users');
const userIds = users.map(u => u.id);
const orders = await db.query(
  'SELECT * FROM orders WHERE user_id = ANY($1)',
  [userIds]
);
```

### Pagination

```typescript
// Offset pagination (simple but slow for large offsets)
SELECT * FROM users
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

// Cursor pagination (efficient for large datasets)
SELECT * FROM users
WHERE created_at < $1
ORDER BY created_at DESC
LIMIT 20;

// Implementation
async function getUsers(cursor?: string, limit = 20) {
  const query = cursor
    ? `SELECT * FROM users WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2`
    : `SELECT * FROM users ORDER BY created_at DESC LIMIT $1`;

  const params = cursor ? [cursor, limit + 1] : [limit + 1];
  const rows = await db.query(query, params);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;

  return {
    data,
    nextCursor: hasMore ? data[data.length - 1].created_at : null,
  };
}
```

## Transactions

### Basic Transactions

```typescript
// Use transactions for multi-statement operations
const client = await pool.connect();

try {
  await client.query('BEGIN');

  await client.query(
    'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
    [amount, fromAccountId]
  );

  await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
    [amount, toAccountId]
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### With Prisma

```typescript
// Prisma transactions
await prisma.$transaction(async (tx) => {
  await tx.account.update({
    where: { id: fromAccountId },
    data: { balance: { decrement: amount } },
  });

  await tx.account.update({
    where: { id: toAccountId },
    data: { balance: { increment: amount } },
  });
});
```

### Isolation Levels

```sql
-- Read Committed (default) - each statement sees committed data
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Repeatable Read - transaction sees snapshot from start
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Serializable - strictest, prevents phantom reads
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

## Indexes

### When to Add Indexes

```sql
-- Foreign keys (almost always)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Frequently filtered columns
CREATE INDEX idx_users_status ON users(status);

-- Frequently sorted columns
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Composite for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

### Index Types

```sql
-- B-tree (default, general purpose)
CREATE INDEX idx_users_email ON users(email);

-- Partial index (filter specific rows)
CREATE INDEX idx_active_users ON users(email) WHERE deleted_at IS NULL;

-- GIN for JSONB
CREATE INDEX idx_users_metadata ON users USING GIN(metadata);

-- Full-text search
CREATE INDEX idx_posts_search ON posts USING GIN(to_tsvector('english', title || ' ' || content));
```

### Index Anti-Patterns

```sql
-- Don't over-index (slows writes)
-- Don't index low-cardinality columns alone
CREATE INDEX idx_users_is_active ON users(is_active);  -- Bad if only 2 values

-- Don't forget composite index order matters
-- For queries on (a, b), index (a, b) works but (b, a) doesn't
```

## Migrations

### Migration Structure

```typescript
// migrations/001_create_users.ts
export async function up(db: Database): Promise<void> {
  await db.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_users_email ON users(email);
  `);
}

export async function down(db: Database): Promise<void> {
  await db.query('DROP TABLE users');
}
```

### Safe Migration Practices

```sql
-- Add columns as nullable first
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Then add constraint after backfill
UPDATE users SET phone = 'unknown' WHERE phone IS NULL;
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- Add indexes concurrently (no locks)
CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone);

-- Rename with alias period
ALTER TABLE old_name RENAME TO new_name;
-- Keep old name as view temporarily
CREATE VIEW old_name AS SELECT * FROM new_name;
-- Drop view after migration complete
```

### Data Migrations

```typescript
// Separate data migrations from schema migrations
export async function up(db: Database): Promise<void> {
  // Add new column
  await db.query('ALTER TABLE users ADD COLUMN full_name VARCHAR(200)');

  // Backfill in batches
  let processed = 0;
  while (true) {
    const result = await db.query(`
      UPDATE users
      SET full_name = first_name || ' ' || last_name
      WHERE full_name IS NULL
      LIMIT 1000
      RETURNING id
    `);

    processed += result.rowCount;
    if (result.rowCount === 0) break;

    console.log(`Migrated ${processed} users`);
  }
}
```

## Connection Management

### Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections in pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Timeout for new connections
});

// Use pool for queries
export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// For transactions, get dedicated client
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Connection Limits

```typescript
// Configure based on environment
const poolConfig = {
  development: { max: 5 },
  test: { max: 2 },
  production: { max: 20 },
};

// Calculate: connections = (cores * 2) + effective_spindle_count
// For cloud: check provider limits
```

## Performance

### Query Analysis

```sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = '123'
ORDER BY created_at DESC
LIMIT 10;

-- Look for:
-- - Seq Scan (might need index)
-- - High actual rows vs estimated
-- - Sort operations (might need index)
```

### Common Optimizations

```sql
-- Use EXISTS instead of COUNT for existence checks
-- Bad
SELECT COUNT(*) FROM orders WHERE user_id = $1;
if (count > 0) { ... }

-- Good
SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1);

-- Use LIMIT for single row queries
-- Bad
SELECT * FROM users WHERE email = $1;

-- Good
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- Batch inserts
-- Bad
INSERT INTO logs (message) VALUES ('msg1');
INSERT INTO logs (message) VALUES ('msg2');

-- Good
INSERT INTO logs (message) VALUES ('msg1'), ('msg2'), ('msg3');
```

## Security

### Least Privilege

```sql
-- Create application user with minimal permissions
CREATE USER app_user WITH PASSWORD 'xxx';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Separate user for migrations
CREATE USER migration_user WITH PASSWORD 'xxx';
GRANT ALL PRIVILEGES ON DATABASE app TO migration_user;
```

### Row Level Security

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy for user access
CREATE POLICY documents_user_policy ON documents
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Set user context
SET app.current_user_id = 'user-123';
SELECT * FROM documents;  -- Only sees own documents
```

## Known Gotchas

### NULL Handling

```sql
-- NULL is not equal to anything, including NULL
WHERE status = NULL  -- Never matches
WHERE status IS NULL  -- Correct

-- NULL in NOT IN
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned WHERE user_id IS NULL);
-- Returns no rows if subquery has NULL!

-- Use NOT EXISTS instead
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM banned b WHERE b.user_id = u.id);
```

### UUID Performance

```sql
-- Random UUIDs cause index fragmentation
-- Use UUIDv7 (time-ordered) for better performance
-- Or use integer PKs with UUID as secondary unique column
```

### Timestamp Precision

```sql
-- Always use TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE  -- Stores in UTC
created_at TIMESTAMP  -- Bad - ambiguous

-- Compare timestamps carefully
WHERE created_at = '2024-01-15'  -- Matches only exact midnight
WHERE created_at >= '2024-01-15' AND created_at < '2024-01-16'  -- All day
```

---

**See Also:**
- [API Guidelines](../api/typescript-rest.instructions.md)
- [Performance Guidelines](../performance/typescript.instructions.md)
- [Security Guidelines](../_universal/security.instructions.md)
