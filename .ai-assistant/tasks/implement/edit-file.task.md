---
task: edit-file
chatmode: developer
tools: [read, write, edit, bash, glob, grep]
---

# Task: Edit File

> **Purpose:** Make targeted changes to an existing file
> **Chatmode:** Developer (full access)
> **Scope:** Single file modification

## Steps

1. **Read current file** - Understand existing code
2. **Identify change location** - Find exact lines to modify
3. **Make the edit** - Apply minimal, focused changes
4. **Verify syntax** - Ensure no obvious errors

## Guidelines

### Do
- Read the file before editing
- Make minimal changes to achieve the goal
- Follow existing code style
- Keep existing patterns
- Preserve comments and formatting

### Don't
- Rewrite entire files unnecessarily
- Add features not requested
- Change unrelated code
- Add unnecessary abstractions
- Remove existing comments without reason

## Project Commands

```bash
# Type check after changes
{{TYPECHECK_COMMAND}}

# Lint check
{{LINT_COMMAND}}

# Format code
{{FORMAT_COMMAND}}
```

## Tips

- Use editor's rename/refactor for symbol changes
- Check imports after adding new dependencies
- Run type check frequently during edits
- Keep diffs small and reviewable

## Common Patterns

### Adding an import
```typescript
// Add to existing imports section
import { NewThing } from '{{IMPORT_PATH}}';
```

### Adding a function
```typescript
// Follow existing function style in the file
export function newFunction(param: Type): ReturnType {
  // Implementation
}
```

### Modifying existing code
```typescript
// Before: original code
// After: modified code with minimal diff
```

## Output Format

After editing, show:

```markdown
**Edited:** `path/to/file.ts`

**Changes:**
- [Line X]: [What changed]
- [Line Y]: [What changed]

**Next:** Run type check to verify
```

## Transition

After editing, proceed to:
- `verify/run-typecheck` - Verify no type errors
- `implement/edit-file` - If more files need changes
- `test/write-tests` - If tests needed for changes
