---
task: run-typecheck
chatmode: developer
tools: [bash, read]
---

# Task: Run Type Check

> **Purpose:** Verify code has no type errors
> **Chatmode:** Developer
> **When:** After code changes, before commit

## Steps

1. **Run type checker** - Execute project's type check command
2. **Review errors** - Understand what's wrong
3. **Fix issues** - Correct type errors
4. **Re-run** - Verify fixes

## Command

See `project/config.md` for project-specific command:

```bash
# Typical commands
npm run typecheck
npx tsc --noEmit
yarn type-check
```

## Common Type Errors

### Missing Type
```typescript
// Error: Parameter 'x' implicitly has an 'any' type
// Fix: Add explicit type
function example(x: string) { ... }
```

### Type Mismatch
```typescript
// Error: Type 'string' is not assignable to type 'number'
// Fix: Correct the type or conversion
const value: number = parseInt(str, 10);
```

### Missing Property
```typescript
// Error: Property 'name' does not exist on type
// Fix: Add to interface or use type guard
if ('name' in obj) { ... }
```

### Null/Undefined
```typescript
// Error: Object is possibly 'undefined'
// Fix: Add null check or use optional chaining
const value = obj?.property ?? defaultValue;
```

## Tips

- Run type check frequently during development
- Fix errors immediately before they compound
- Use `satisfies` over `as` for type assertions
- Avoid `any` - use `unknown` if type is truly unknown

## Output Format

```markdown
**Ran:** Type check

**Result:** Pass / X errors

**Errors:** (if any)
- `path/file.ts:42` - [error description]

**Next:** [fix errors / proceed to lint]
```

## Transition

After type check:
- Pass → `verify/run-lint` or continue work
- Fail → `implement/edit-file` to fix type errors
