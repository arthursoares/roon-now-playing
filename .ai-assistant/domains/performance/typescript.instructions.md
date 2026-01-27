---
applyTo: "**/*.{ts,tsx,js,jsx}"
priority: medium
role: [developer, reviewer, architect]
---

# Performance Guidelines

> **Applies to:** All application code
> **Related:** [api.instructions.md](../api/typescript-rest.instructions.md) | [database.instructions.md](../database/prisma.instructions.md)

## Core Principles

1. **Measure first** - Don't optimize without profiling
2. **Optimize bottlenecks** - Focus on hot paths
3. **Consider tradeoffs** - Performance vs. readability/maintainability
4. **Set budgets** - Define acceptable thresholds
5. **Monitor continuously** - Performance degrades over time

## Performance Budgets

### Define Thresholds

```typescript
// Performance budgets
const PERFORMANCE_BUDGETS = {
  // Page load
  firstContentfulPaint: 1500,    // ms
  largestContentfulPaint: 2500,  // ms
  timeToInteractive: 3500,       // ms

  // Bundle size
  mainBundle: 200,     // KB (gzipped)
  chunkSize: 50,       // KB (gzipped)
  totalSize: 500,      // KB (gzipped)

  // API response
  apiResponse: 200,    // ms (p95)
  dbQuery: 50,         // ms (p95)

  // Runtime
  frameRate: 60,       // fps
  inputLatency: 100,   // ms
};
```

## Frontend Performance

### Bundle Optimization

```typescript
// Dynamic imports for code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Use in component
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>

// Route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard')),
  },
  {
    path: '/settings',
    component: lazy(() => import('./pages/Settings')),
  },
];
```

### Image Optimization

```typescript
// Use responsive images
<picture>
  <source media="(max-width: 768px)" srcset="image-small.webp" />
  <source media="(max-width: 1200px)" srcset="image-medium.webp" />
  <img src="image-large.webp" alt="Description" loading="lazy" />
</picture>

// Lazy load images
<img src="image.jpg" loading="lazy" decoding="async" alt="Description" />

// Use modern formats with fallback
<picture>
  <source srcset="image.avif" type="image/avif" />
  <source srcset="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Description" />
</picture>
```

### Virtualization for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Memoization

```typescript
// React: Memoize expensive computations
const expensiveResult = useMemo(() => {
  return items.filter(complexFilter).sort(complexSort);
}, [items]);

// React: Memoize callbacks
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);

// React: Memoize components
const MemoizedComponent = memo(function Component({ data }: Props) {
  return <div>{data.name}</div>;
});

// Vue: Computed properties are automatically cached
const filteredItems = computed(() => {
  return items.value.filter(complexFilter).sort(complexSort);
});
```

### Debounce and Throttle

```typescript
import { debounce, throttle } from 'lodash-es';

// Debounce: Wait for pause in events (search input)
const debouncedSearch = debounce((query: string) => {
  fetchSearchResults(query);
}, 300);

// Throttle: Limit event frequency (scroll, resize)
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 100);

// Cleanup on unmount
useEffect(() => {
  window.addEventListener('scroll', throttledScroll);
  return () => {
    window.removeEventListener('scroll', throttledScroll);
    throttledScroll.cancel();
  };
}, []);
```

## Backend Performance

### Database Query Optimization

```typescript
// Avoid N+1 queries
// Bad - N+1 problem
const users = await db.users.findMany();
for (const user of users) {
  user.orders = await db.orders.findMany({ where: { userId: user.id } });
}

// Good - eager loading
const users = await db.users.findMany({
  include: { orders: true },
});

// Good - batch loading
const users = await db.users.findMany();
const userIds = users.map(u => u.id);
const orders = await db.orders.findMany({
  where: { userId: { in: userIds } },
});
```

### Pagination

```typescript
// Always paginate large datasets
async function getUsers(page: number, limit: number = 20) {
  const offset = (page - 1) * limit;

  const [users, total] = await Promise.all([
    db.users.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.users.count(),
  ]);

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// For very large datasets, use cursor-based pagination
async function getUsersCursor(cursor?: string, limit: number = 20) {
  const users = await db.users.findMany({
    take: limit + 1, // Fetch one extra to check for more
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { id: 'asc' },
  });

  const hasMore = users.length > limit;
  const items = hasMore ? users.slice(0, -1) : users;

  return {
    data: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
```

### Caching Strategies

```typescript
// In-memory cache with TTL
const cache = new Map<string, { value: unknown; expires: number }>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.value as T;
  }
  cache.delete(key);
  return undefined;
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// Usage with cache-aside pattern
async function getUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  const cached = getCached<User>(cacheKey);
  if (cached) return cached;

  const user = await db.users.findUnique({ where: { id } });
  if (user) {
    setCache(cacheKey, user, 5 * 60 * 1000); // 5 minutes
  }

  return user;
}
```

### Connection Pooling

```typescript
// Database connection pool
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query with pool
async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}
```

### Async Processing

```typescript
// Move heavy work to background jobs
import { Queue } from 'bull';

const emailQueue = new Queue('email', process.env.REDIS_URL);

// Instead of processing inline
app.post('/register', async (req, res) => {
  const user = await createUser(req.body);

  // Queue email instead of sending inline
  await emailQueue.add('welcome', { userId: user.id });

  res.status(201).json({ data: user });
});

// Process in background
emailQueue.process('welcome', async (job) => {
  const user = await db.users.findUnique({ where: { id: job.data.userId } });
  await sendWelcomeEmail(user);
});
```

## Memory Management

### Avoid Memory Leaks

```typescript
// React: Clean up subscriptions
useEffect(() => {
  const subscription = eventEmitter.subscribe(handleEvent);

  return () => {
    subscription.unsubscribe();
  };
}, []);

// Clear intervals/timeouts
useEffect(() => {
  const interval = setInterval(poll, 1000);
  return () => clearInterval(interval);
}, []);

// Remove event listeners
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Stream Large Data

```typescript
// Don't load entire file into memory
// Bad
const content = fs.readFileSync('large-file.json', 'utf-8');
const data = JSON.parse(content);

// Good - stream processing
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import JSONStream from 'jsonstream';

await pipeline(
  createReadStream('large-file.json'),
  JSONStream.parse('items.*'),
  async function* (source) {
    for await (const item of source) {
      yield processItem(item);
    }
  }
);
```

## Profiling

### Frontend Profiling

```typescript
// Performance marks
performance.mark('operation-start');
await heavyOperation();
performance.mark('operation-end');

performance.measure('heavy-operation', 'operation-start', 'operation-end');

const measures = performance.getEntriesByName('heavy-operation');
console.log(`Operation took ${measures[0].duration}ms`);

// Web Vitals
import { getCLS, getFID, getLCP } from 'web-vitals';

getCLS(console.log);  // Cumulative Layout Shift
getFID(console.log);  // First Input Delay
getLCP(console.log);  // Largest Contentful Paint
```

### Backend Profiling

```typescript
// Simple timing
const start = performance.now();
await operation();
const duration = performance.now() - start;
logger.info('Operation completed', { duration: `${duration.toFixed(2)}ms` });

// Wrap functions for timing
function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    if (duration > 100) {
      logger.warn('Slow operation', { name, duration: `${duration.toFixed(2)}ms` });
    }
  });
}

// Database query logging
prisma.$use(async (params, next) => {
  const start = performance.now();
  const result = await next(params);
  const duration = performance.now() - start;

  if (duration > 50) {
    logger.warn('Slow query', {
      model: params.model,
      action: params.action,
      duration: `${duration.toFixed(2)}ms`,
    });
  }

  return result;
});
```

## Common Anti-Patterns

### Avoid These

```typescript
// Bad - unnecessary re-renders
function Component({ items }) {
  // Creates new function on every render
  return items.map(item => (
    <Item key={item.id} onClick={() => handleClick(item.id)} />
  ));
}

// Good - stable callback
function Component({ items }) {
  const handleItemClick = useCallback((id: string) => {
    handleClick(id);
  }, []);

  return items.map(item => (
    <Item key={item.id} onClick={handleItemClick} id={item.id} />
  ));
}

// Bad - blocking the main thread
const result = heavyComputation(largeData);

// Good - use Web Workers for heavy computation
const worker = new Worker('./heavy-worker.js');
worker.postMessage(largeData);
worker.onmessage = (e) => setResult(e.data);

// Bad - synchronous I/O in Node.js
const data = fs.readFileSync('file.json');

// Good - async I/O
const data = await fs.promises.readFile('file.json');
```

## Known Gotchas

### Premature Optimization

```typescript
// Don't optimize without measuring
// Most code is not performance-critical

// Measure first:
// 1. Profile in production-like conditions
// 2. Identify actual bottlenecks
// 3. Set measurable goals
// 4. Optimize and verify improvement
```

### Hidden Costs

```typescript
// JSON.parse/stringify are expensive
const copy = JSON.parse(JSON.stringify(obj));  // Slow
const copy = structuredClone(obj);             // Better

// Array methods create new arrays
const result = arr.filter(...).map(...).reduce(...);  // 3 iterations
// Consider single loop if performance-critical
```

### Browser Reflows

```typescript
// Bad - triggers reflow for each read
elements.forEach(el => {
  const height = el.offsetHeight;  // Triggers reflow
  el.style.height = `${height + 10}px`;  // Triggers reflow
});

// Good - batch reads, then writes
const heights = elements.map(el => el.offsetHeight);  // Single reflow
elements.forEach((el, i) => {
  el.style.height = `${heights[i] + 10}px`;
});
```

---

**See Also:**
- [Database Guidelines](../database/prisma.instructions.md)
- [API Guidelines](../api/typescript-rest.instructions.md)
- [Testing Guidelines](../testing/vitest.instructions.md)
