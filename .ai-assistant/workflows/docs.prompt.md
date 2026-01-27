---
workflow: docs
priority: medium
---

# Docs

> **Purpose:** Add or improve documentation for code
> **Prerequisites:** Target files or areas identified
> **Related:** [typescript.instructions.md](../domains/typescript.instructions.md)

## Overview

The Docs workflow helps add meaningful documentation to code. Good documentation explains the "why" not just the "what", and helps future developers (including AI assistants) understand intent and context.

## When to Use

Run `/docs` when:
- Adding documentation to new or existing code
- Improving unclear or outdated documentation
- Documenting public APIs or exported functions
- Adding README files to packages or directories

## Steps

### 1. Identify Documentation Scope

Determine what needs documentation:

```bash
# Find files without JSDoc comments
# Look for exported functions/classes

# Check for missing README files
find . -type d -name "src" -exec test ! -f {}/README.md \; -print
```

**Target areas:**
- Exported functions and classes
- Complex algorithms or business logic
- Public APIs and interfaces
- Package/module entry points

### 2. Analyze Code Purpose

Before documenting, understand:
- What does this code do?
- Why does it exist?
- How is it used?
- What are the edge cases?

Read the implementation and any existing tests to understand behavior.

### 3. Add Documentation

**For Functions (JSDoc):**
```typescript
/**
 * Brief description of what the function does.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 *
 * @example
 * ```typescript
 * const result = functionName(input);
 * ```
 */
export function functionName(paramName: Type): ReturnType {
  // ...
}
```

**For Classes:**
```typescript
/**
 * Brief description of the class purpose.
 *
 * @example
 * ```typescript
 * const instance = new ClassName(config);
 * instance.method();
 * ```
 */
export class ClassName {
  // ...
}
```

**For Complex Logic (Inline Comments):**
```typescript
// Explain WHY, not WHAT
// Good: "Skip validation for internal calls to avoid circular dependency"
// Bad: "Check if internal is true"
if (isInternal) {
  return data;
}
```

**For Modules/Packages (README.md):**
```markdown
# Module Name

Brief description of module purpose.

## Usage

\`\`\`typescript
import { something } from './module';
\`\`\`

## API

### `functionName(param)`

Description of the function.
```

### 4. Documentation Standards

**Do:**
- Explain the "why" behind decisions
- Include usage examples
- Document edge cases and gotchas
- Keep descriptions concise but complete
- Use consistent terminology

**Don't:**
- State the obvious ("Increments counter by 1")
- Document implementation details that may change
- Add comments to self-explanatory code
- Use vague descriptions ("Handles stuff")

### 5. Verify Documentation

After adding documentation:
- Ensure examples compile/work
- Check for spelling/grammar
- Verify accuracy against implementation
- Run type check to catch JSDoc type issues

```bash
npm run typecheck
```

## Rules

### Prohibited

- **Do not add noise documentation** - Comments that restate the obvious
- **Do not document every line** - Only add value where needed
- **Do not guess at intent** - Ask if unclear about purpose

### Required

- **JSDoc for exported functions** - Public API must be documented
- **Examples for complex usage** - Show how to use non-obvious APIs
- **README for packages** - Each package/module should have one

### Recommended

- **Document edge cases** - What happens with null, empty, etc.
- **Link related code** - Reference related functions or modules
- **Update stale docs** - Fix outdated documentation when found

## Output Format

Report what was documented:

```markdown
## Documentation Report

### Files Updated
- `src/utils/parser.ts` - Added JSDoc to 3 functions
- `src/services/api.ts` - Added module description
- `src/components/README.md` - Created package README

### Documentation Added
- `parseConfig()` - Function description, params, return, example
- `ApiService` - Class description, usage example
- `src/components/` - README with usage and API docs

### Notes
- `legacyHandler()` - Skipped, marked for deprecation
- Consider adding architecture docs for data flow
```

## Quick Reference

### JSDoc Tags

| Tag | Purpose | Example |
|-----|---------|---------|
| `@param` | Parameter description | `@param name - User's display name` |
| `@returns` | Return value | `@returns The parsed configuration` |
| `@throws` | Exceptions | `@throws {Error} If config is invalid` |
| `@example` | Usage example | See code block examples above |
| `@deprecated` | Mark as deprecated | `@deprecated Use newFunction instead` |
| `@see` | Reference related | `@see parseConfig` |

### Documentation Checklist

- [ ] Exported functions have JSDoc
- [ ] Complex logic has explanatory comments
- [ ] Public APIs have examples
- [ ] Packages have README files
- [ ] Edge cases are documented
- [ ] Examples are accurate and tested

## References

- [TypeScript Guidelines](../domains/typescript.instructions.md)
- [JSDoc Reference](https://jsdoc.app/)
