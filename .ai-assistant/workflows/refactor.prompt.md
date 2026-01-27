---
workflow: refactor
priority: high
---

# Refactor

> **Purpose:** Systematic refactoring with proper planning, pattern detection, scope analysis, and parallel execution
> **Chatmodes:** Architect (planning) → Developer (execution)
> **Command:** `/refactor [scope flags] <refactor description>`
> **Scope:** See [scope.md](../scope.md)

## Gate Enforcement

**CRITICAL:** Refactoring affects multiple files. This workflow has mandatory approval gates at every phase.

**Valid approval responses:**
- `yes`, `y`, `approved`, `proceed`, `lgtm`, `looks good`, `go ahead`

**Invalid (do NOT treat as approval):**
- Silence or no response
- Questions or clarifications
- Partial acknowledgment ("I see", "okay", "hmm")
- Requests for more information

**When in doubt:** Ask explicitly: "I need your approval to continue. Please respond with 'yes' to proceed."

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Limit refactor to specific files/directories |
| `--project=<path>` | Project root for monorepos |

**Examples:**
```bash
/refactor --files=src/components/ rename getUserData to fetchUser
/refactor --files=src/api/ migrate from axios to fetch
/refactor --project=packages/web update all imports to use new paths
```

## Overview

This workflow guides systematic refactoring through:
1. Information gathering and clarification (interactive Q&A)
2. Pattern analysis and edge case identification
3. Plan creation with full scope documentation
4. User-approved execution with progress tracking

---

## Phase 1: Gather Context

**Goal:** Understand the refactor through conversation with the user.

### Step 1.0: Parse Scope

```bash
# Get current context
git branch --show-current
git status --porcelain
```

**Display scope context:**

```markdown
## Refactor Scope

| Scope | Value |
|-------|-------|
| Files | [from --files or "entire codebase"] |
| Project | [from --project or root] |
| Branch | [current branch] |

**Refactor Description:** [from user input]
```

### Step 1.1: Clarify Requirements

Start by asking the user about the refactor:

```markdown
## Understanding the Refactor

Before I analyze the code, let me understand what you need:

1. **What pattern/code needs to change?**
   What's the current state that needs refactoring?

2. **What's the target state?**
   What should the code look like after?

3. **Why is this refactor needed?**
   Technical debt, new pattern adoption, performance?

4. **Are there any areas to exclude?**
   Files, directories, or patterns to leave unchanged?
```

**Wait for user response before exploring code.**

### Step 1.2: Explore and Categorize

After understanding requirements, explore the code:

```markdown
## Initial Analysis

I've explored the codebase. Here's what I found:

**Refactor Type:** {type}
| Type | Description |
|------|-------------|
| `rename` | Renaming symbols (variables, functions, types, files) |
| `restructure` | Moving code between files/directories |
| `pattern-change` | Changing code patterns or conventions |
| `api-migration` | Updating to new API/library versions |
| `cleanup` | Removing dead code, unused imports |
| `type-improvement` | Improving TypeScript types |

**Scope Assessment:**
- Files affected: {N}
- Risk level: {low/medium/high/critical}
- Approach: {direct/batched/phased}

Does this categorization match your expectations?
```

**Wait for user confirmation.**

### Step 1.3: Assess Scope and Risk

| Scope | File Count | Risk Level | Approach |
|-------|------------|------------|----------|
| `small` | 1-5 files | Low | Direct changes |
| `medium` | 6-20 files | Medium | Batched changes with testing |
| `large` | 21-50 files | High | Phased approach with checkpoints |
| `massive` | 50+ files | Critical | Multiple phases, extensive testing |

---

## Phase 2: Pattern Analysis

**Goal:** Thoroughly analyze patterns and surface variations to the user.

### Step 2.1: Find All Occurrences

Search for all instances of the pattern to be refactored.

### Step 2.2: Present Findings

```markdown
## Pattern Analysis

I've searched the codebase for the pattern. Here's what I found:

**Total Occurrences:** {N} across {M} files

**Pattern Variations:**
| Variation | Count | Example | Notes |
|-----------|-------|---------|-------|
| Standard usage | 15 | `pattern()` | Normal refactor |
| With options | 5 | `pattern({ opt: true })` | May need special handling |
| Edge case | 2 | `pattern?.()` | Optional chaining |

**Files by complexity:**
- Simple changes: {list}
- Complex changes: {list}
- Potential issues: {list}
```

### Step 2.3: Surface Edge Cases

```markdown
## Edge Cases to Discuss

I've identified some edge cases that need your input:

| Case | Files Affected | Question |
|------|----------------|----------|
| Conditional usage | `file1.ts`, `file2.ts` | Transform conditionally too? |
| Dynamic reference | `utils.ts` | How to handle dynamic lookup? |
| Exported API | `index.ts` | Breaking change for consumers? |
| Test mocks | `*.spec.ts` | Update mocks or skip? |

Which of these are relevant? How should we handle them?
```

**Wait for user guidance on edge cases.**

---

## Phase 3: Plan Creation

**Goal:** Create a detailed plan and get user approval before making changes.

### Step 3.1: Create Refactor Plan

Create a detailed plan document in `/tmp/refactor-plan-{name}.md`.

### Step 3.2: Plan Document Structure

```markdown
# Refactor Plan: {Title}

**Created:** {date}
**Type:** {rename|restructure|pattern-change|api-migration|cleanup|type-improvement}
**Scope:** {small|medium|large|massive} ({N} files)
**Risk Level:** {low|medium|high|critical}

## Summary

One-paragraph description of what this refactor accomplishes.

## Before/After Examples

### Before
\`\`\`typescript
// Current pattern
\`\`\`

### After
\`\`\`typescript
// New pattern
\`\`\`

## Pattern Rules

| Rule | Description |
|------|-------------|
| Rule 1 | How to transform pattern A |
| Rule 2 | How to handle edge case B |

## Scope Analysis

### Files to Modify

| # | File | Changes | Complexity |
|---|------|---------|------------|
| 1 | `path/to/file.ts` | Description | simple |
| 2 | `path/to/other.ts` | Description | complex |

### Files to Exclude

| File | Reason |
|------|--------|
| `path/to/excluded.ts` | Reason for exclusion |

## Edge Cases

| Case | Files Affected | Handling |
|------|----------------|----------|
| Case 1 | `file.ts` | How to handle |

## Validation Plan

1. Type check after each batch
2. Run affected tests after changes
3. Manual verification of complex cases
```

### Step 3.3: Get User Approval

Present the plan summary and ask for approval:

```markdown
## Refactor Plan Summary

**What:** {brief description}
**Scope:** {N} files across {directories}
**Risk:** {level}

**Key Changes:**
1. Change A
2. Change B
3. Change C

**Edge Cases:** {N} handled per our discussion

---
**Proceed with this refactor?**

Reply with:
- `yes` or `approved` - Proceed with refactoring
- `modify: [changes]` - Request changes to the plan
- `questions` - Need more clarification (I will wait)
- `cancel` - Abort the refactor
```

**⛔ GATE: STOP HERE. Do NOT begin modifying files until user responds with `yes` or `approved`.**

**Waiting for explicit approval before making any changes.**

---

## Phase 4: Execution

**Goal:** Implement the approved plan with regular progress updates.

### Step 4.1: Create File List for Tracking

Create `.ai-project/file-lists/refactor-{name}.md`:

```markdown
# Refactor: {Title}

**Plan:** `/tmp/refactor-plan-{name}.md`
**Created:** {date}
**Status:** In Progress

## Progress

- Total files: {N}
- Completed: 0
- Remaining: {N}

## Files

### Pending

- [ ] `path/to/file1.ts` - {brief note}
- [ ] `path/to/file2.ts` - {brief note}

### Completed

[Empty initially]

### Skipped

[Files that couldn't be refactored with reason]
```

### Step 4.2: Execute in Batches

For medium to large refactors, work in batches with progress updates:

```markdown
## Progress Update

**Batch 1 of {N}:** Files 1-5
- ✓ `file1.ts` - transformed
- ✓ `file2.ts` - transformed
- ✓ `file3.ts` - transformed

**Validation:** Type check passed

**Next:** Batch 2 (files 6-10)

Any concerns before I continue?
```

### Step 4.3: Handle Discrepancies

If a file doesn't match expected patterns, stop and ask:

```markdown
## Found Something Unexpected

**File:** `src/components/Special.ts`
**Expected:** `oldPattern()`
**Found:** `oldPattern.withConfig()`

This doesn't match the pattern we discussed.

**Options:**
1. **Skip** - Leave this file unchanged
2. **Transform** - Apply similar transformation
3. **Manual** - Flag for manual review later

Which approach do you prefer?
```

**Wait for user decision before continuing.**

---

## Phase 5: Validation

**Goal:** Verify changes preserve behavior and all tests pass.

### Step 5.1: Run Full Validation

```bash
# Type checking (full)
npm run typecheck

# Linting (full)
npm run lint

# All tests affected by the refactor
npm run test -- {affected-pattern}

# Consider running full test suite for large refactors
npm run test
```

### Step 5.2: Test Coverage Check

Evaluate if the refactor requires test updates:

```markdown
## Test Coverage Analysis

**Refactor Type:** {type}

| Scenario | Action Required |
|----------|-----------------|
| Renamed public API | Update tests referencing old names |
| Changed function signatures | Update test calls and mocks |
| Moved code to new files | Update import paths in tests |
| New patterns introduced | Consider adding pattern-specific tests |
| Internal restructure only | Existing tests should suffice |

**Tests requiring updates:**
- [ ] `test/file.spec.ts` - [reason for update]

**New tests needed:**
- [ ] None / [list if any]
```

### Step 5.3: Update Affected Tests

If tests need updates due to the refactor:

1. Update import paths for moved code
2. Update references to renamed symbols
3. Update mocks for changed interfaces
4. Add tests for any new public APIs

### Step 5.4: Verification Report

```markdown
## Refactor Complete: {Title}

**Files Modified:** {N}
**Files Skipped:** {N} (with reasons)
**Tests Updated:** {N}

### Validation Results
| Check | Status |
|-------|--------|
| Type check | ✓ Pass |
| Lint | ✓ Pass |
| Affected tests | ✓ Pass ({N} tests) |
| Full test suite | ✓ Pass (if run) |

### Summary of Changes
- [Change 1]
- [Change 2]

### Manual Review Recommended
- [ ] `file.ts` - Complex edge case, please verify behavior

---
**Can you verify the refactor works as expected?**

After verification:
- **Commit** - Proceed to documentation check, then commit
- **Adjust** - Need to fix something
- **Review** - Show full diff
```

**⛔ GATE: All tests must pass before proceeding to commit.**

**Wait for user verification before proceeding.**

---

## Phase 6: Docs (Developer) - Optional

**Goal:** Update documentation to reflect the refactor before committing.

When user confirms verification, prompt for documentation:

```markdown
## Documentation (Optional)

**Refactor completed:** {Title}

**Consider documenting:**

| Type | When Relevant | Action |
|------|---------------|--------|
| AI context | Pattern changes, new conventions | Update `.ai-project/` |
| User docs | API changes, breaking changes | Update `docs/` |
| README | Usage changes | Update `README.md` |

**What would you like to document?**
- `ai` - Update AI assistant context (recommended for pattern changes)
- `user` - Add/update user documentation
- `readme` - Update README
- `skip` - No documentation needed
```

**⏸️ Wait for user response. If `skip`, proceed to commit.**

See [docs/update-docs.task.md](../tasks/docs/update-docs.task.md) for templates.

---

## Phase 7: Commit (Committer)

**Goal:** Commit all changes including documentation.

```markdown
## Ready to Commit

**Files to commit:** [implementation + docs]

**Message:**
```
refactor: {title}

{Brief description of refactor}
```

**Commit?** (yes / edit message / cancel)
```

**⛔ GATE: Wait for explicit confirmation before committing.**

---

## Principles

1. **Ask, don't assume** - Clarify requirements and edge cases with user
2. **Get approval before executing** - Never refactor without explicit approval
3. **Preserve behavior** - Refactors should not change functionality
4. **Surface issues early** - Report discrepancies, don't silently skip
5. **All tests must pass** - Update tests for renamed/moved code, run full validation
6. **Confirm before committing** - User verification required

---

## Quick Reference

| Phase | Key Action | Gate |
|-------|------------|------|
| Gather Context | Ask questions, explore code | User confirms understanding |
| Pattern Analysis | Find variations, surface edge cases | User guides edge case handling |
| Plan | Design solution | **User approves plan** |
| Execute | Implement with progress updates | User resolves discrepancies |
| Validate | Verify changes, update/run all tests | **All tests pass** |
| Docs | Update documentation | *Optional* |
| Commit | Commit all changes | **User confirms** |

---

**See Also:**
- [Implement](./implement.prompt.md)
- [Commit](./commit.prompt.md)
- [Create File List](./create-file-list.prompt.md)
- [Tasks: docs/](../tasks/docs/)
