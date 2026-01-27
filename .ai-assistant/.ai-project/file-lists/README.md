# File Lists

This directory contains tracked batches of files that need similar changes.

## Purpose

Use file lists to:
- Track progress on multi-file refactors
- Document files needing similar changes
- Coordinate batch operations across sessions

## When to Create

Create a file list when:
- Refactoring affects more than 5 files
- Migrating patterns across the codebase
- Batch operations need progress tracking
- Work spans multiple sessions

## File Naming

Use kebab-case with descriptive names:
- `components-without-tests.md`
- `refactor-api-calls.md`
- `migrate-to-v2-types.md`

## Template Structure

```markdown
# {Title}

**Created:** {date}
**Status:** In Progress | Complete | Paused

## Search Criteria

How these files were identified:

\`\`\`bash
# Command used
\`\`\`

## Progress

| Status | Count |
|--------|-------|
| Total | X |
| Completed | X |
| Pending | X |
| Skipped | X |

## Files

### Pending
- [ ] `path/file.ts` - {note}

### In Progress
- [ ] `path/file.ts` - {status}

### Completed
- [x] `path/file.ts` - {done}

### Skipped
- `path/file.ts` - {reason}
```

## Workflow

Create file lists using: `/file-list` or follow [create-file-list.prompt.md](../workflows/create-file-list.prompt.md)

## Lifecycle

1. **Created** - Files identified and documented
2. **In Progress** - Actively working through list
3. **Complete** - All files processed
4. **Archived** - Moved to completed state
