---
workflow: create-file-list
priority: medium
---

# Create File List

> **Purpose:** Track batches of files that need similar changes for large-scale work
> **Template:** [file-lists/README.md](../file-lists/README.md)

## When to Create a File List

Create a file list when:

- Refactoring affects more than 5 files
- Migrating patterns across the codebase
- Batch operations need progress tracking
- Multiple files need the same type of change
- Work spans multiple sessions

## Creating a File List

### Step 1: Create the File

Create a new file in `.ai-project/file-lists/`:

```bash
.ai-project/file-lists/{descriptive-name}.md
```

**Naming conventions:**
- Use kebab-case
- Be descriptive: `components-without-tests.md`, `refactor-api-calls.md`

### Step 2: Document the Search

Record how the files were found:

```markdown
# {Title}

**Created:** {date}
**Status:** In Progress | Complete | Paused

## Search Criteria

How these files were identified:

```bash
# Command used to find files
grep -r "pattern" src/ --include="*.ts"
find src -name "*.ts" -exec grep -l "pattern" {} \;
```

## Selection Criteria

- Include: {what makes a file relevant}
- Exclude: {what disqualifies a file}
```

### Step 3: List the Files

Organize with checkboxes for tracking:

```markdown
## Files

### Pending

- [ ] `src/components/Button.ts` - {brief note}
- [ ] `src/components/Input.ts` - {brief note}
- [ ] `src/services/api.ts` - {brief note}

### In Progress

- [ ] `src/components/Form.ts` - Started, waiting for review

### Completed

- [x] `src/utils/helpers.ts` - Done
- [x] `src/utils/formatters.ts` - Done

### Skipped

- `src/legacy/old.ts` - Reason: deprecated, will be removed
```

### Step 4: Add Progress Summary

Track overall progress:

```markdown
## Progress

| Status | Count |
|--------|-------|
| Total | 25 |
| Completed | 10 |
| In Progress | 2 |
| Pending | 12 |
| Skipped | 1 |

**Last Updated:** {date}
```

## Example File List

```markdown
# Components Without Stories

**Created:** 2025-01-15
**Status:** In Progress

## Search Criteria

Vue components without corresponding Storybook stories:

```bash
# Find Vue files without stories
for f in $(find src/components -name "*.vue"); do
  story="${f%.vue}.stories.ts"
  if [ ! -f "$story" ]; then
    echo "$f"
  fi
done
```

## Selection Criteria

- Include: Vue components in `src/components/`
- Exclude: Layout wrappers, internal components with `_` prefix

## Progress

| Status | Count |
|--------|-------|
| Total | 15 |
| Completed | 5 |
| In Progress | 1 |
| Pending | 8 |
| Skipped | 1 |

**Last Updated:** 2025-01-16

## Files

### Pending

- [ ] `src/components/buttons/PrimaryButton.vue` - Interactive component
- [ ] `src/components/buttons/SecondaryButton.vue` - Interactive component
- [ ] `src/components/forms/TextField.vue` - Form input
- [ ] `src/components/forms/SelectField.vue` - Form input
- [ ] `src/components/cards/UserCard.vue` - Display component
- [ ] `src/components/cards/ProductCard.vue` - Display component
- [ ] `src/components/modals/ConfirmModal.vue` - Modal component
- [ ] `src/components/modals/AlertModal.vue` - Modal component

### In Progress

- [ ] `src/components/navigation/Sidebar.vue` - Complex component, drafting stories

### Completed

- [x] `src/components/buttons/IconButton.vue` - 3 stories created
- [x] `src/components/forms/Checkbox.vue` - 4 stories created
- [x] `src/components/forms/Radio.vue` - 3 stories created
- [x] `src/components/indicators/Badge.vue` - 2 stories created
- [x] `src/components/indicators/Spinner.vue` - 2 stories created

### Skipped

- `src/components/_internal/PortalTarget.vue` - Internal utility, no visual output

## Notes

- Prioritizing interactive components first
- Form components need accessibility testing in stories
```

## Working with File Lists

### During Refactoring

1. Move file from "Pending" to "In Progress"
2. Make the changes
3. Verify changes (type check, tests)
4. Move file to "Completed" with note
5. Update progress counts

### When Skipping Files

Always document why:

```markdown
### Skipped

- `src/legacy/old.ts` - Reason: deprecated, will be removed in v2
- `src/generated/types.ts` - Reason: auto-generated, changes would be overwritten
```

### Resuming Work

When returning to a file list:

1. Check current status
2. Review "In Progress" items
3. Continue with next "Pending" item
4. Update progress summary

## Archiving Completed Lists

When all files are processed:

1. Update status to "Complete"
2. Add completion date
3. Optionally move to a completed folder or archive

```markdown
# Components Without Stories

**Created:** 2025-01-15
**Completed:** 2025-01-20
**Status:** Complete

...
```

---

## References

- [File Lists README](../file-lists/README.md)
- [Refactor Workflow](./refactor.prompt.md)
