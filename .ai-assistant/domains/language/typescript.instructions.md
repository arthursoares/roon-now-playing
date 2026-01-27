---
applyTo: "**/*.{ts,tsx}"
priority: high
role: [developer, reviewer]
---

# TypeScript Guidelines

> **Applies to:** All `.ts` and `.tsx` files
> **Related:** Add framework-specific instructions as needed

## TypeScript Version

- **TypeScript 5.x+**
- Strict mode enabled

## Type Usage Rules

### Avoid `any` Type

**Use specific types or `unknown` instead of `any`:**

```typescript
// Avoid - loses type safety
function processData(data: any) {
    return data.value;
}

// Correct - use proper types
function processData(data: { value: string }) {
    return data.value;
}

// Correct - use unknown for truly unknown types
function processData(data: unknown) {
    if (typeof data === 'object' && data !== null && 'value' in data) {
        return (data as { value: string }).value;
    }
}
```

### Use `satisfies` Instead of `as`

**Prefer `satisfies` for type assertions:**

```typescript
// Correct - satisfies ensures type safety
const config = {
    url: '/api/data',
    method: 'GET',
} satisfies RequestConfig;

// Avoid - as bypasses type checking
const config = {
    url: '/api/data',
    method: 'GET',
} as RequestConfig;
```

**When `as` is acceptable:**
- Narrowing after type guards
- DOM element type assertions
- Event target casting

```typescript
// Acceptable use of as
const target = event.target as HTMLInputElement;
const element = document.querySelector('.button') as HTMLButtonElement | null;
```

### Type Inference

**Let TypeScript infer types when possible:**

```typescript
// Correct - inferred types
const count = 0;  // number
const name = 'test';  // string
const items = [1, 2, 3];  // number[]

// Unnecessary - redundant type annotations
const count: number = 0;
const name: string = 'test';
```

**When to annotate explicitly:**
- Function parameters (always)
- Function return types (when complex or public API)
- Variables when inference would be too broad

```typescript
// Explicit types needed
function calculateValue(input: number, offset: number): number {
    return input + offset;
}

// Explicit type prevents inference to never[]
const items: string[] = [];
```

## Functional Programming Patterns

### Prefer Array Methods Over Loops

**Use array methods instead of `for` loops:**

```typescript
// Correct - use array methods
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);
const sum = numbers.reduce((acc, n) => acc + n, 0);

// Create lookup maps
const usersById = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
}, {} as Record<string, User>);

// Avoid - imperative loops
const doubled = [];
for (let i = 0; i < numbers.length; i++) {
    doubled.push(numbers[i] * 2);
}
```

**When loops are acceptable:**
- Performance-critical hot paths (measure first)
- Breaking early from iteration
- Complex state machines

### Immutability

**Avoid mutation, create new objects:**

```typescript
// Correct - immutable operations
const newArray = [...oldArray, newItem];
const newObject = { ...oldObject, updatedField: newValue };
const filtered = items.filter(item => item.active);

// Avoid - mutating existing data
oldArray.push(newItem);
oldObject.updatedField = newValue;
```

## Imports & Exports

### Import Organization

**Order and spacing:**

```typescript
// 1. External dependencies
import { something } from 'external-package';

// 2. Internal absolute imports (if using)
import { utility } from '@project/utils';

// 3. Relative imports
import { helper } from './utils/helper';
import { Type } from './types';

// Space after imports block
const myFunction = () => {};
```

### Named Exports Only

**Use named exports consistently:**

```typescript
// Correct - named export
export function calculateValue(value: number) {
    return value * 2;
}

export interface Config {
    url: string;
}

// Avoid default exports
export default function calculateValue(value: number) {
    return value * 2;
}
```

**Benefits:**
- Named exports enable better IDE refactoring
- Enforces consistent naming across imports
- Prevents confusion from different import names

## Variable Declarations

### Use `const` and `let` Only

```typescript
// Correct
const MAX_VALUE = 10;
let currentValue = 0;

// Avoid legacy var keyword
var MAX_VALUE = 10;
```

### Prefer `const` Over `let`

```typescript
// Correct - use const when value doesn't change
const result = calculate(id);
const displayName = result?.name ?? 'Unknown';

// Avoid - unnecessary let
let result = calculate(id);
```

## Type Definitions

### Interface vs Type

**Prefer `interface` for object shapes:**

```typescript
// Preferred for objects
export interface User {
    id: string;
    name: string;
    email: string;
}

// Use type for unions, intersections, utilities
export type UserId = string;
export type Status = 'active' | 'inactive' | 'error';
export type PartialUser = Partial<User>;
```

### Generic Types

```typescript
// Correct - generic function
function selectById<T extends { id: string }>(items: T[], id: string): T | undefined {
    return items.find(item => item.id === id);
}

// Usage
const user = selectById(users, 'user-1');
```

## Enums vs Union Types

**Prefer union types over enums:**

```typescript
// Correct - union type
type Status = 'pending' | 'success' | 'error';

function getStatus(): Status {
    return 'success';
}

// Avoid - enum (unless required by external API)
enum Status {
    Pending = 'pending',
    Success = 'success',
    Error = 'error',
}
```

**Rationale:** Union types are more lightweight and work better with TypeScript's type system.

## Nullable Values

### Optional vs Undefined vs Null

**Prefer `undefined` over `null`:**

```typescript
// Correct
function findUser(id: string): User | undefined {
    return users.find(u => u.id === id);
}

// Avoid
function findUser(id: string): User | null {
    return users.find(u => u.id === id) ?? null;
}
```

### Nullish Coalescing

```typescript
// Correct - nullish coalescing
const timeout = config.timeout ?? 5000;
const name = user?.name ?? 'Unknown';

// Avoid - logical OR (handles falsy values incorrectly)
const timeout = config.timeout || 5000;  // 0 would be replaced!
```

## Type Guards

### Custom Type Guards

```typescript
// Correct - type guard function
function isUser(value: unknown): value is User {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        'name' in value &&
        typeof (value as User).id === 'string' &&
        typeof (value as User).name === 'string'
    );
}

// Usage
if (isUser(data)) {
    console.log(data.name);  // TypeScript knows data is User
}
```

## Utility Types

### Common Utility Types

```typescript
// Partial - make all properties optional
type PartialUser = Partial<User>;

// Required - make all properties required
type RequiredUser = Required<PartialUser>;

// Pick - select specific properties
type UserName = Pick<User, 'id' | 'name'>;

// Omit - exclude specific properties
type UserWithoutMeta = Omit<User, 'created_at' | 'updated_at'>;

// Record - object with specific key/value types
type UserMap = Record<string, User>;

// ReturnType - extract function return type
type UserReturn = ReturnType<typeof getUser>;
```

## Error Handling

### Error Types

```typescript
// Correct - unknown error type
try {
    await fetchData();
} catch (error) {
    // error is unknown by default
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error('Unknown error', error);
    }
}
```

## Known Gotchas

### any Type
Avoid `any` at all costs - it disables type checking completely. Use `unknown` for truly unknown types, then narrow with type guards.

### Type Assertion with as
Only use `as` for DOM elements and after type guards. Prefer `satisfies` for configuration objects.

### Enum Runtime Overhead
Enums generate runtime code. Prefer union types which are compile-time only.

### Default Exports
Never use default exports. They prevent consistent naming and break IDE refactoring.

### Error Type in Catch Blocks
Errors in `catch` blocks are always `unknown`. Use type guards to narrow.

---

**See Also:**
- [Testing Guidelines](../testing/vitest.instructions.md)
