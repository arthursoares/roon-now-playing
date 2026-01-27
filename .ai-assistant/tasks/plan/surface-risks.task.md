---
task: surface-risks
chatmode: architect
tools: [read, glob, grep]
---

# Task: Surface Risks

> **Purpose:** Identify potential risks, edge cases, and complications before implementation
> **Chatmode:** Architect (read-only)
> **Output:** Risk assessment with mitigations

## Steps

1. **Analyze change scope** - What will be modified?
2. **Identify dependencies** - What relies on this code?
3. **Consider edge cases** - What could go wrong?
4. **Assess impact** - How bad if something breaks?
5. **Propose mitigations** - How to reduce risk?

## Risk Categories

### Breaking Changes
- Will this change existing behavior?
- Are there callers that expect current behavior?
- Is there backward compatibility concern?

### Data Integrity
- Could this corrupt or lose data?
- Are there race conditions?
- Is rollback possible?

### Performance
- Could this slow down the system?
- Are there N+1 queries or loops?
- Memory usage concerns?

### Security
- Does this handle user input?
- Authentication/authorization impact?
- Data exposure risk?

### Integration
- Does this affect external systems?
- API contract changes?
- Third-party dependencies?

## Useful Commands

```bash
# Find all callers of a function
grep -rn "functionName(" src/

# Check what imports this module
grep -rn "from.*moduleName" src/

# Find tests that might break
grep -rn "functionName\|moduleName" src/**/*.spec.ts

# Check git history for context
git log --oneline -10 path/to/file.ts
```

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk description] | Low/Med/High | Low/Med/High | [How to prevent/detect] |

## Output Format

```markdown
## Risk Assessment: [Change Name]

### High Risk
- **[Risk]**: [Description]
  - Likelihood: High
  - Impact: [What would break]
  - Mitigation: [How to prevent]

### Medium Risk
- **[Risk]**: [Description]
  - Likelihood: Medium
  - Impact: [What would break]
  - Mitigation: [How to prevent]

### Low Risk
- **[Risk]**: [Description]
  - Note: [Why it's low risk]

### Edge Cases to Handle
1. [Edge case] - [How to handle]
2. [Edge case] - [How to handle]

### Recommendation
[Proceed with caution / Safe to proceed / Needs more investigation]
```

## Transition

After risk assessment, proceed to:
- `plan/create-plan` - Include mitigations in plan
- `plan/clarify-requirements` - If risks reveal ambiguity
