---
applyTo: "**/*.{ts,tsx,js,jsx}"
priority: high
role: [developer, reviewer]
---

# Data Validation Guidelines

> **Applies to:** All data input, API boundaries, and form handling
> **Related:** [api.instructions.md](../api/typescript-rest.instructions.md) | [security.instructions.md](../_universal/security.instructions.md)

## Core Principles

1. **Validate at boundaries** - API endpoints, form submissions, external data
2. **Fail fast** - Reject invalid data immediately
3. **Be specific** - Clear error messages for each validation failure
4. **Type safety** - Schema validation provides runtime types
5. **Defense in depth** - Client and server validation

## Schema Validation with Zod

### Basic Schemas

```typescript
import { z } from 'zod';

// Primitive types
const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const dateSchema = z.date();

// With constraints
const emailSchema = z.string().email();
const positiveNumber = z.number().positive();
const nonEmptyString = z.string().min(1);

// Object schema
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date(),
});

// Infer TypeScript type
type User = z.infer<typeof userSchema>;
```

### Common Patterns

```typescript
// Optional with default
const configSchema = z.object({
  port: z.number().default(3000),
  debug: z.boolean().default(false),
});

// Nullable vs Optional
const schema = z.object({
  optional: z.string().optional(),      // string | undefined
  nullable: z.string().nullable(),      // string | null
  both: z.string().nullish(),           // string | null | undefined
});

// Transform data
const trimmedString = z.string().trim();
const lowercaseEmail = z.string().email().toLowerCase();
const parsedDate = z.string().transform(s => new Date(s));

// Coercion (parse from string)
const coercedNumber = z.coerce.number();  // "123" → 123
const coercedBoolean = z.coerce.boolean(); // "true" → true
const coercedDate = z.coerce.date();       // "2024-01-15" → Date
```

### Validation and Parsing

```typescript
// Parse (throws on error)
try {
  const user = userSchema.parse(input);
  // user is typed as User
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.errors);
  }
}

// Safe parse (returns result object)
const result = userSchema.safeParse(input);
if (result.success) {
  const user = result.data;  // Typed as User
} else {
  const errors = result.error.errors;
}

// Partial validation (all fields optional)
const partialUser = userSchema.partial();

// Pick specific fields
const nameOnly = userSchema.pick({ name: true, email: true });

// Omit fields
const withoutId = userSchema.omit({ id: true });
```

## API Request Validation

### Express Middleware

```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Validation middleware factory
function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    req.validated = result.data;
    next();
  };
}

// Usage
const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
});

app.post('/users', validate(createUserSchema), (req, res) => {
  const { name, email } = req.validated.body;
  // ... create user
});
```

### Request Schema Patterns

```typescript
// GET with query params
const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
});

// GET with path params
const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// POST/PUT with body
const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
  }).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
  ),
});
```

## Form Validation

### Client-Side Validation

```typescript
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
}).refine(
  data => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// React Hook Form integration
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <input type="password" {...register('confirmPassword')} />
      {errors.confirmPassword && <span>{errors.confirmPassword.message}</span>}

      <button type="submit">Sign Up</button>
    </form>
  );
}
```

### Field-Level Validation

```typescript
// Real-time validation
async function validateField(field: string, value: unknown) {
  const fieldSchema = signupSchema.shape[field as keyof typeof signupSchema.shape];

  if (!fieldSchema) return null;

  const result = fieldSchema.safeParse(value);
  return result.success ? null : result.error.errors[0].message;
}

// Async validation (e.g., check email uniqueness)
const emailSchema = z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { message: 'Email already registered' }
);
```

## Custom Validators

### Custom Refinements

```typescript
// Simple refinement
const positiveNumber = z.number().refine(
  n => n > 0,
  { message: 'Must be positive' }
);

// With context
const dateRange = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  data => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// Async refinement
const uniqueUsername = z.string().refine(
  async (username) => {
    const exists = await db.users.findUnique({ where: { username } });
    return !exists;
  },
  { message: 'Username already taken' }
);
```

### Custom Error Messages

```typescript
const userSchema = z.object({
  name: z.string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string',
  }).min(1, 'Name cannot be empty').max(100, 'Name is too long'),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  }).int('Age must be a whole number').positive('Age must be positive'),
});
```

### Reusable Validators

```typescript
// Custom validator factories
const stringId = () => z.string().uuid();
const pagination = () => z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const dateString = () => z.string().refine(
  s => !isNaN(Date.parse(s)),
  { message: 'Invalid date format' }
).transform(s => new Date(s));

// Use in schemas
const listSchema = z.object({
  query: pagination(),
});
```

## Error Handling

### Formatting Errors

```typescript
import { z } from 'zod';

function formatZodErrors(error: z.ZodError) {
  return error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

// API response format
function handleValidationError(error: z.ZodError) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: formatZodErrors(error),
    },
  };
}

// Example output
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email", "code": "invalid_string" },
      { "field": "age", "message": "Expected number, received string", "code": "invalid_type" }
    ]
  }
}
```

### Error Map Customization

```typescript
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === 'string') {
      return { message: 'This field must be text' };
    }
    if (issue.expected === 'number') {
      return { message: 'This field must be a number' };
    }
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

## Sanitization

### Input Sanitization

```typescript
// Trim and normalize strings
const cleanString = z.string()
  .trim()
  .transform(s => s.replace(/\s+/g, ' '));  // Normalize whitespace

// Lowercase email
const email = z.string()
  .email()
  .toLowerCase()
  .trim();

// Remove HTML
import DOMPurify from 'dompurify';

const safeHtml = z.string().transform(s =>
  DOMPurify.sanitize(s, { ALLOWED_TAGS: [] })
);

// Limit length
const limitedString = z.string()
  .max(1000)
  .transform(s => s.slice(0, 1000));
```

### Type Coercion

```typescript
// From query strings/form data
const querySchema = z.object({
  page: z.coerce.number().default(1),
  active: z.string()
    .transform(s => s === 'true')
    .pipe(z.boolean()),
  ids: z.string()
    .transform(s => s.split(','))
    .pipe(z.array(z.string().uuid())),
});

// Parse: ?page=2&active=true&ids=uuid1,uuid2
// Result: { page: 2, active: true, ids: ['uuid1', 'uuid2'] }
```

## Complex Validation

### Discriminated Unions

```typescript
const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal('keypress'),
    key: z.string(),
    modifiers: z.array(z.enum(['ctrl', 'alt', 'shift'])),
  }),
  z.object({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down']),
    amount: z.number(),
  }),
]);

type Event = z.infer<typeof eventSchema>;
```

### Recursive Schemas

```typescript
// Tree structure
interface Category {
  id: string;
  name: string;
  children: Category[];
}

const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    children: z.array(categorySchema),
  })
);
```

### Cross-Field Validation

```typescript
const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive(),
  })).min(1, 'Order must have at least one item'),

  discount: z.number().min(0).max(100).optional(),
  total: z.number().positive(),
}).refine(
  data => {
    const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = subtotal * (data.discount || 0) / 100;
    const expectedTotal = subtotal - discountAmount;
    return Math.abs(data.total - expectedTotal) < 0.01;
  },
  { message: 'Total does not match calculated value' }
);
```

## Known Gotchas

### Coercion Behavior

```typescript
// z.coerce.number() behavior
z.coerce.number().parse('');     // NaN (might want to handle)
z.coerce.number().parse('abc');  // NaN
z.coerce.number().parse(null);   // 0

// Safer: check for NaN
const safeNumber = z.coerce.number().refine(
  n => !Number.isNaN(n),
  { message: 'Invalid number' }
);
```

### Optional vs Nullable

```typescript
// Optional: field can be omitted
z.string().optional()  // string | undefined

// Nullable: field can be null
z.string().nullable()  // string | null

// Both:
z.string().nullish()   // string | null | undefined

// Default only works for undefined
z.string().optional().default('hello')  // Works
z.string().nullable().default('hello')  // null stays null!
```

### Parse vs SafeParse

```typescript
// parse() throws - use in trusted contexts
const data = schema.parse(trustedInput);

// safeParse() returns result - use for user input
const result = schema.safeParse(userInput);
if (!result.success) {
  // Handle errors
}
```

---

**See Also:**
- [API Guidelines](../api/typescript-rest.instructions.md)
- [Security Guidelines](../_universal/security.instructions.md)
- [Error Handling Guidelines](../error-handling/typescript.instructions.md)
