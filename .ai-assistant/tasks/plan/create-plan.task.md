---
task: create-plan
chatmode: architect
tools: [read, glob, grep]
gate: approval-required
---

# Task: Create Plan

> **Purpose:** Design implementation approach before writing code
> **Chatmode:** Architect (read-only)
> **Gate:** User must approve plan before implementation proceeds

## Steps

1. **Summarize understanding** - Confirm what will be built
2. **List affected files** - What will change
3. **Define approach** - How it will be implemented
4. **Identify risks** - What could go wrong
5. **Present for approval** - Wait for user confirmation

## Plan Template

```markdown
## Implementation Plan: [Feature/Change Name]

### Summary
[1-2 sentences describing what will be done]

### Files to Modify
- `path/to/file.ts` - [change description]
- `path/to/other.ts` - [change description]

### New Files
- `path/to/new.ts` - [purpose]

### Approach
1. [Step 1 - specific action]
2. [Step 2 - specific action]
3. [Step 3 - specific action]

### Edge Cases
- [Edge case 1 and how it will be handled]
- [Edge case 2 and how it will be handled]

### Risks
- [Risk 1] - [mitigation]

### Testing Strategy
- [How changes will be tested]

---

**Approve this plan?** (yes / no / modify)
```

## Tips

- Be specific about file paths and changes
- Include line numbers if modifying specific functions
- Don't over-engineer - keep scope minimal
- Flag anything you're unsure about
- Consider rollback strategy for risky changes

## Approval Gate

**CRITICAL:** Do not proceed to implementation until user explicitly approves.

Valid approvals:
- "yes", "approved", "looks good", "proceed", "lgtm"

If user says "no" or requests changes:
- Revise the plan based on feedback
- Present updated plan for approval

## Useful Commands

```bash
# Check file exists before planning changes
ls -la path/to/file.ts

# Preview file structure
head -50 path/to/file.ts

# Check for similar patterns
grep -rn "similar pattern" src/
```

## Output Format

Present the plan using the template above, then explicitly ask:

```markdown
---

**Approve this plan?** (yes / no / modify)
```

## Transition

After approval, proceed to:
- `implement/edit-file` - For each file in the plan
- `test/write-tests` - If tests are part of the plan
- `verify/run-checks` - After implementation complete
