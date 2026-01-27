---
task: create-file-list
chatmode: developer
tools: [read, write, glob, grep]
---

# Task: Create File List

> **Purpose:** Track files for batch operations (6+ files)
> **Chatmode:** Developer
> **When:** Large-scale changes requiring progress tracking

## Steps

1. **Find all files** - Search for files matching criteria
2. **Create list** - Document in `.ai-project/file-lists/`
3. **Categorize** - Group by type or status
4. **Track progress** - Update as work proceeds

## When to Use

- Refactoring 6+ files
- Migrating patterns
- Bulk updates
- Any operation needing progress tracking

## File List Template

Create at `.ai-project/file-lists/[name].md`:

```markdown
# File List: [Operation Name]

**Created:** [YYYY-MM-DD]
**Status:** In Progress

## Summary

- **Total files:** [N]
- **Completed:** [X]
- **Remaining:** [Y]
- **Progress:** [X/N] ([%])

## Search Criteria

Found using:
```bash
grep -rn "pattern" src/
```

## Files

### Pending
- [ ] `path/to/file1.ts` - [notes]
- [ ] `path/to/file2.ts` - [notes]

### In Progress
- [~] `path/to/file3.ts` - Currently working

### Completed
- [x] `path/to/file4.ts` - Done
- [x] `path/to/file5.ts` - Done

### Skipped
- [-] `path/to/file6.ts` - [reason for skipping]

## Edge Cases

Files needing special handling:
- `path/to/special.ts` - [why it's special]

## Notes

[Additional context about the operation]
```

## Status Symbols

| Symbol | Status | Meaning |
|--------|--------|---------|
| `[ ]` | Pending | Not started |
| `[~]` | In Progress | Currently working |
| `[x]` | Completed | Done |
| `[-]` | Skipped | Not applicable |

## Commands for Finding Files

```bash
# Find by pattern
grep -rn "pattern" src/ --include="*.ts" -l

# Find by file name
find src -name "*.component.ts"

# Count occurrences
grep -rc "pattern" src/ | grep -v ":0$"
```

## Updating Progress

As you complete files:
1. Move from Pending to Completed
2. Update counts in Summary
3. Add notes if needed

## Output Format

```markdown
## File List Created

**File:** `.ai-project/file-lists/auth-migration.md`
**Operation:** Migrate auth to new pattern
**Total files:** 15

**Status:**
- Pending: 15
- Completed: 0
- Skipped: 0

**Next:** Start processing files in batches
```

## Tips

- Keep list updated as you work
- Note edge cases immediately
- Group related files together
- Delete list when operation complete
