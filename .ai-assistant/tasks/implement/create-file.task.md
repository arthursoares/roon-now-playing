---
task: create-file
chatmode: developer
tools: [read, write, edit, bash, glob, grep]
---

# Task: Create File

> **Purpose:** Create a new source file following project conventions
> **Chatmode:** Developer (full access)
> **Note:** Prefer editing existing files when possible

## Steps

1. **Verify need** - Confirm new file is necessary
2. **Choose location** - Follow project structure
3. **Use correct naming** - Match project conventions
4. **Follow template** - Use existing patterns as reference
5. **Add exports** - Update barrel files if needed

## Project Conventions

```
{{PROJECT_STRUCTURE}}
```

### File Naming
- Components: `{{COMPONENT_NAMING}}`
- Utilities: `{{UTILITY_NAMING}}`
- Types: `{{TYPE_NAMING}}`
- Tests: `{{TEST_NAMING}}`

## Pre-Creation Checklist

- [ ] Does similar file already exist? (prefer edit)
- [ ] Is this the right directory?
- [ ] Does naming match conventions?
- [ ] Will this be imported correctly?

## Templates

### Component File
```typescript
{{COMPONENT_TEMPLATE}}
```

### Utility File
```typescript
{{UTILITY_TEMPLATE}}
```

### Type File
```typescript
{{TYPE_TEMPLATE}}
```

## After Creation

```bash
# Verify file is in right location
ls -la path/to/new-file.ts

# Check imports work
{{TYPECHECK_COMMAND}}

# Update barrel exports if needed
echo "export * from './new-file';" >> path/to/index.ts
```

## Tips

- Look at similar files for patterns
- Don't forget to export from index files
- Add JSDoc comments for public APIs
- Create corresponding test file

## Output Format

After creating, show:

```markdown
**Created:** `path/to/new-file.ts`

**Purpose:** [What this file does]

**Exports:**
- `functionName` - [description]

**Next steps:**
- [ ] Add to barrel exports
- [ ] Create test file
- [ ] Verify imports
```

## Transition

After creating, proceed to:
- `implement/edit-file` - Update barrel exports
- `test/write-tests` - Create test file
- `verify/run-typecheck` - Verify no errors
