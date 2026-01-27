---
workflow: sync
priority: high
---

# Sync Documentation

> **Purpose:** Align AI documentation with the actual state of the codebase

Documentation goes stale over time as code evolves. This workflow audits and updates the `.ai-assistant/` documentation to reflect the current state of the codebase, ensuring accurate context for future AI-assisted work.

## When to Use

Run `/sync` when:
- Documentation feels out of sync with the code
- After significant refactoring or architectural changes
- Periodically (e.g., weekly or at sprint boundaries)
- Before onboarding new team members to AI-assisted development
- When the AI assistant seems to be following outdated patterns


## Audit Process

### Phase 1: Assess Current State

Start by understanding what has changed:

1. **Check recent git history**:
   ```bash
   git log --oneline -50
   ```

2. **Identify documentation last updated**:
   - Check "Last Updated" dates in `.ai-assistant/*.md` files
   - Compare against recent commit dates

3. **List modified areas** since documentation was last updated

### Phase 2: Validate Core Documentation

Review and update these files for accuracy:

#### `.memory.md` - Architecture & Patterns

1. **Session Context section**:
   - Update "Recent Work Areas" based on git history
   - Review "Ongoing Work" for completed items
   - Update "Last Updated" date

2. **Git Workflow section**:
   - Confirm main branch is current: `git remote show origin | grep 'HEAD branch'`
   - Review commit prefixes against recent commits: `git log --oneline -20`

3. **Architecture sections**:
   - Verify patterns and conventions are current
   - Check if new patterns have emerged

#### `.context.md` - Quick Reference

1. **Import patterns**: Check for new libraries or changed imports
2. **Common patterns**: Verify documented patterns are still in use
3. **File locations**: Confirm paths are still accurate

#### `INDEX.md` - Documentation Index

1. **Cross-references**: Ensure all links work
2. **Error patterns**: Add any new common errors discovered
3. **Topic coverage**: Add new patterns or topics

### Phase 3: Validate Domain Instructions

For each file in `.ai-assistant/domains/`:

1. **Spot-check patterns** against actual code:
   - Search for a few documented patterns in the codebase
   - Verify they're still in use

2. **Check for new patterns** not yet documented:
   - Look at recent commits for new conventions
   - Search for repeated patterns in new code

3. **Flag outdated guidance**:
   - Mark deprecated patterns
   - Update or remove obsolete instructions

### Phase 4: Review Decisions & Todos

#### Architecture Decision Records (`.ai-project/decisions/`)

1. Check if any decisions have been superseded
2. Add new ADRs if significant patterns have changed
3. Update status of existing ADRs if applicable

#### Long-term Todos (`.ai-project/todos/`)

1. Mark completed items
2. Remove stale entries
3. Add any new discoveries

### Phase 5: Scan for Gaps

Look for undocumented areas:

1. **New directories or packages** not mentioned in docs
2. **New patterns** not covered in domain instructions
3. **New error types** not listed in INDEX.md
4. **Changed workflows** that don't match documentation

## Output Format

After completing the audit, provide a status report:

```markdown
# Documentation Audit Report

## Summary
- **Last documented**: [date from .memory.md]
- **Commits since then**: [N commits]
- **Files updated**: [list of .ai-assistant files modified]

## Changes Made

### .memory.md
- [What was updated]

### .context.md
- [What was updated]

### INDEX.md
- [What was updated]

### Domain Instructions
- [Which files updated and why]

### Decisions
- [New/updated ADRs]

### Todos
- [Items completed/added/removed]

## Gaps Identified
- [Areas needing future documentation]

## Recommendations
- [Suggestions for improving documentation]
```

## Execution Notes

- **Be systematic**: Check each file type methodically
- **Verify before updating**: Confirm patterns exist in code before documenting
- **Keep it current**: Update "Last Updated" dates when modifying files
- **Don't over-document**: Only document patterns that are actually used
- **Flag uncertainty**: If unsure about a pattern, ask the user

## Quick Mode

For a faster refresh (e.g., end of day):

1. Update `.memory.md` Session Context with recent work
2. Add any new errors/patterns to INDEX.md
3. Update "Last Updated" date

Skip the full domain instruction review unless patterns seem wrong.
