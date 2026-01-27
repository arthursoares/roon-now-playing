---
task: find-patterns
chatmode: architect
tools: [read, glob, grep]
---

# Task: Find Patterns

> **Purpose:** Find all occurrences of a pattern, symbol, or convention in the codebase
> **Chatmode:** Architect (read-only)
> **Output:** Categorized list of matches with variations

## Steps

1. **Define search criteria** - What pattern are we looking for?
2. **Search across codebase** - Find all occurrences
3. **Categorize results** - Group by type, location, or variation
4. **Analyze variations** - Note differences between occurrences
5. **Report findings** - Present organized results

## Common Pattern Searches

### Symbol/Function Usage
```bash
grep -rn "symbolName" src/ --include="*.ts"
```

### Import Patterns
```bash
grep -rn "from.*libraryName" src/
```

### Type Definitions
```bash
grep -rn "type.*TypeName\|interface.*TypeName" src/
```

### Component Props
```bash
grep -rn "Props.*{" src/components/
```

### API Endpoints
```bash
grep -rn "fetch\|axios\|api" src/ --include="*.ts"
```

### Error Handling
```bash
grep -rn "try.*catch\|\.catch(" src/
```

## Useful Commands

```bash
# Count occurrences per file
grep -rc "pattern" src/ | grep -v ":0$"

# Find with context
grep -rn -A2 -B2 "pattern" src/

# Find in specific file types
grep -rn "pattern" src/ --include="*.tsx" --include="*.ts"

# Find excluding directories
grep -rn "pattern" src/ --exclude-dir={node_modules,dist}

# Case-insensitive search
grep -rin "pattern" src/
```

## Tips

- Use regex for flexible matching: `grep -rn "fetch.*api" src/`
- Check for variations in naming (camelCase, snake_case)
- Include test files - they often show expected patterns
- Note inconsistencies - they might be bugs or tech debt
- Consider editor/IDE search for complex queries

## Output Format

```markdown
## Pattern Analysis: [Pattern Name]

**Search Criteria:** `[regex or search term]`

**Total Occurrences:** [N]

### Category 1: [Description]
| File | Line | Usage |
|------|------|-------|
| `path/file.ts` | 42 | [how it's used] |

### Category 2: [Variation]
| File | Line | Usage |
|------|------|-------|
| `path/other.ts` | 15 | [different usage] |

### Observations
- [Pattern consistency note]
- [Variation that might need attention]
```

## Transition

After finding patterns, proceed to:
- `plan/create-plan` - If refactoring patterns
- `track/create-file-list` - If batch changes needed
