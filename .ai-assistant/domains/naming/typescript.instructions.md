---
applyTo: "**/*"
priority: high
role: [developer, reviewer]
---

# Naming Guidelines

> **Applies to:** All code - variables, functions, files, and more
> **Related:** [typescript.instructions.md](../language/typescript.instructions.md) | [documentation.instructions.md](../_universal/documentation.instructions.md)

## Core Principles

1. **Clarity over brevity** - Names should be self-explanatory
2. **Consistency** - Same concept, same name everywhere
3. **Searchability** - Names should be easy to find
4. **Context-aware** - Length proportional to scope
5. **No abbreviations** - Unless universally understood

## General Rules

### Be Descriptive

```typescript
// Bad - unclear
const d = new Date();
const u = getUser();
const arr = items.filter(x => x.active);

// Good - descriptive
const currentDate = new Date();
const currentUser = getUser();
const activeItems = items.filter(item => item.active);
```

### Avoid Abbreviations

```typescript
// Bad - requires mental translation
const usrMgr = new UserManager();
const errMsg = 'Invalid input';
const txn = createTransaction();
const cfg = loadConfig();

// Good - full words
const userManager = new UserManager();
const errorMessage = 'Invalid input';
const transaction = createTransaction();
const config = loadConfig();

// Acceptable abbreviations (universally understood)
const id = user.id;       // identifier
const url = '/api/users'; // uniform resource locator
const api = new Api();    // application programming interface
const html = render();    // hypertext markup language
const css = styles();     // cascading style sheets
const db = database;      // database (in context)
```

### Use Pronounceable Names

```typescript
// Bad - hard to discuss
const yyyymmdd = formatDate();
const cstmrLst = getCustomers();
const genymdhms = generateTimestamp();

// Good - can be spoken
const dateString = formatDate();
const customerList = getCustomers();
const timestamp = generateTimestamp();
```

## Case Conventions

### JavaScript/TypeScript

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `userName`, `isActive` |
| Functions | camelCase | `getUserById`, `calculateTotal` |
| Classes | PascalCase | `UserService`, `HttpClient` |
| Interfaces | PascalCase | `UserProps`, `ApiResponse` |
| Types | PascalCase | `UserId`, `Status` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `API_URL` |
| Enums | PascalCase | `UserRole`, `Status` |
| Enum values | PascalCase | `UserRole.Admin` |
| Files (components) | PascalCase | `UserProfile.tsx` |
| Files (utilities) | camelCase | `formatDate.ts` |
| Files (tests) | match source | `UserProfile.spec.ts` |

### CSS/Styling

```css
/* BEM naming */
.block {}
.block__element {}
.block--modifier {}

/* Examples */
.card {}
.card__header {}
.card__body {}
.card--featured {}
.card--compact {}
```

### Environment Variables

```bash
# SCREAMING_SNAKE_CASE
DATABASE_URL=postgres://...
API_KEY=xxx
NODE_ENV=production
FEATURE_FLAG_NEW_UI=true
```

## Variables

### Booleans

```typescript
// Prefix with is, has, can, should, will
const isActive = true;
const hasPermission = user.role === 'admin';
const canEdit = isOwner || hasPermission;
const shouldRender = isVisible && hasData;
const willRedirect = authRequired && !isAuthenticated;

// Bad - unclear boolean intent
const active = true;
const permission = checkPermission();
const edit = true;
const render = checkVisibility();
```

### Collections

```typescript
// Plural names for arrays/collections
const users = await fetchUsers();
const orderItems = order.items;
const selectedIds = new Set<string>();

// Bad - singular for collections
const user = await fetchUsers();  // Misleading!
const orderItem = order.items;
```

### Numbers

```typescript
// Include unit or context when relevant
const timeoutMs = 5000;
const maxRetries = 3;
const itemCount = items.length;
const priceInCents = 999;
const temperatureCelsius = 22.5;

// Bad - unit unclear
const timeout = 5000;  // Seconds? Milliseconds?
const price = 999;     // Dollars? Cents?
```

### Strings

```typescript
// Indicate type when not obvious
const userId = '550e8400-e29b-41d4-a716-446655440000';
const userEmail = 'user@example.com';
const dateString = '2024-01-15';
const jsonPayload = JSON.stringify(data);
const htmlContent = '<div>Hello</div>';
```

## Functions

### Naming Patterns

```typescript
// Actions: verb + noun
function createUser(data: UserData): User { }
function updateOrder(id: string, changes: OrderChanges): Order { }
function deleteComment(id: string): void { }
function sendEmail(to: string, subject: string): void { }

// Getters: get + noun (for computed/fetched)
function getUserById(id: string): User | undefined { }
function getActiveOrders(): Order[] { }
function getCurrentUser(): User { }

// Checkers: is/has/can + adjective/noun
function isValidEmail(email: string): boolean { }
function hasPermission(user: User, action: string): boolean { }
function canAccessResource(user: User, resource: Resource): boolean { }

// Transformers: noun + to + noun, or verb
function userToDto(user: User): UserDto { }
function formatDate(date: Date): string { }
function parseConfig(raw: string): Config { }

// Event handlers: handle + event or on + event
function handleClick(event: MouseEvent): void { }
function handleSubmit(data: FormData): void { }
const onClick = () => { };
const onUserCreate = (user: User) => { };
```

### Avoid Generic Names

```typescript
// Bad - too generic
function process(data: unknown) { }
function handle(item: Item) { }
function doStuff() { }
function getData() { }
function manage(entity: Entity) { }

// Good - specific
function validateUserInput(input: unknown) { }
function applyDiscount(item: CartItem) { }
function sendWelcomeEmail() { }
function fetchOrderHistory() { }
function archiveInactiveUsers() { }
```

## Classes and Types

### Classes

```typescript
// Noun or noun phrase
class UserService { }
class OrderRepository { }
class EmailNotificationSender { }
class DatabaseConnectionPool { }

// Avoid redundant suffixes when context is clear
class User { }  // Not UserModel, UserClass
class Order { } // Not OrderEntity

// Use suffix for infrastructure
class UserController { }
class OrderService { }
class PaymentGateway { }
```

### Interfaces

```typescript
// Describe what it is, not what it does (usually)
interface User { }
interface OrderItem { }
interface ApiResponse<T> { }

// Props interfaces for components
interface UserProfileProps { }
interface ButtonProps { }

// Don't prefix with I
interface User { }      // Good
interface IUser { }     // Bad (Hungarian notation)
```

### Type Aliases

```typescript
// Describe the concept
type UserId = string;
type Timestamp = number;
type Status = 'pending' | 'active' | 'completed';

// Function types describe the action
type CreateUser = (data: UserData) => User;
type ValidateEmail = (email: string) => boolean;
type EventHandler<T> = (event: T) => void;
```

## Files and Directories

### File Names

```typescript
// Components: PascalCase
UserProfile.tsx
OrderSummary.vue
NavigationMenu.svelte

// Utilities/Helpers: camelCase or kebab-case
formatDate.ts
validate-email.ts
useLocalStorage.ts

// Tests: match source file
UserProfile.spec.tsx
formatDate.test.ts

// Index files
index.ts  // Re-exports

// Types: often separate file
types.ts
user.types.ts
```

### Directory Structure

```
src/
├── components/     # React/Vue components
│   ├── common/     # Shared components
│   └── features/   # Feature-specific
├── hooks/          # Custom hooks
├── services/       # API/business logic
├── utils/          # Utility functions
├── types/          # Type definitions
├── constants/      # Constant values
└── pages/          # Page components
```

## Special Cases

### React/Vue Components

```typescript
// Component names: PascalCase, descriptive
function UserProfileCard({ user }: Props) { }
function OrderSummaryTable({ orders }: Props) { }
function NavigationSidebar() { }

// Hooks: use + description
function useLocalStorage<T>(key: string): [T, (value: T) => void] { }
function useDebounce<T>(value: T, delay: number): T { }
function useCurrentUser(): User | null { }
```

### Event Handlers

```typescript
// Component props
interface ButtonProps {
  onClick?: () => void;
  onHover?: () => void;
  onFocus?: () => void;
}

// Handler functions
const handleClick = () => { };
const handleFormSubmit = (data: FormData) => { };
const handleUserSelect = (user: User) => { };
```

### API Endpoints

```typescript
// REST: plural nouns, kebab-case
/api/users
/api/users/:id
/api/order-items
/api/user-profiles

// Query parameters: camelCase or snake_case (be consistent)
/api/users?sortBy=createdAt&pageSize=20
/api/users?sort_by=created_at&page_size=20
```

## Anti-Patterns

### Avoid These

```typescript
// Single-letter variables (except in short lambdas)
const n = users.length;  // Bad
const count = users.length;  // Good

// Short lambdas are OK
users.filter(u => u.active);  // OK
users.filter(user => user.active);  // Also OK

// Numbered names
const user1 = getUser();
const user2 = getAdmin();
// Better:
const regularUser = getUser();
const adminUser = getAdmin();

// Type in name (Hungarian notation)
const strName = 'John';     // Bad
const arrUsers = [];        // Bad
const objConfig = {};       // Bad
const name = 'John';        // Good
const users = [];           // Good
const config = {};          // Good

// Negated booleans
const isNotActive = false;  // Bad - double negative in conditions
const isActive = true;      // Good

// Vague names
const data = fetch();       // Bad - what data?
const info = getInfo();     // Bad - what info?
const temp = calculate();   // Bad - temporary what?
```

## Known Gotchas

### Reserved Words

```typescript
// Avoid JavaScript reserved words
const class = 'user';    // Error
const className = 'user'; // OK

const new = createItem(); // Error
const newItem = createItem(); // OK
```

### Shadowing

```typescript
// Avoid shadowing outer scope variables
const user = getCurrentUser();

function processOrder(order: Order) {
  const user = order.user;  // Shadows outer user
  // Confusing: which user?
}

// Better: be specific
function processOrder(order: Order) {
  const orderUser = order.user;
  // Clear distinction
}
```

### Consistency in Codebase

```typescript
// Pick one and stick to it
fetchUsers() vs getUsers()      // Pick one style
userId vs user_id vs userID     // Pick one format
onClick vs handleClick          // Pick one pattern
```

---

**See Also:**
- [TypeScript Guidelines](../language/typescript.instructions.md)
- [Documentation Guidelines](../_universal/documentation.instructions.md)
- [Code Review Guidelines](../_universal/code-review.instructions.md)
