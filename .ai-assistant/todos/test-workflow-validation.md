---
id: test-workflow-validation
title: Add Testing Infrastructure for Workflows
priority: low
category: test
status: open
created: 2025-11-29
updated: 2025-11-29
labels: [testing, workflows, infrastructure]
---

# Add Testing Infrastructure for Workflows

## Description

Create a testing strategy and infrastructure for validating AI assistant workflows. Workflows are markdown-based prompt definitions that guide AI behavior - traditional unit testing doesn't apply directly.

## Context

| Aspect | Details |
|--------|---------|
| **Current State** | 21 workflows exist with no automated validation |
| **Challenge** | AI outputs are non-deterministic, making exact assertions difficult |
| **Goal** | Ensure workflows maintain structural integrity and produce expected behaviors |

## Proposed Approach

### Phase 1: Structural Validation (Low effort)

- Create a script to validate workflow file structure
- Check: YAML frontmatter, required sections, gate definitions
- Can run in CI

### Phase 2: Test Fixture Project (Medium effort)

- Create a minimal test project in `tests/fixtures/`
- Known code patterns for workflows to operate on
- Predictable outcomes for verification

### Phase 3: Scenario Definitions (Medium effort)

- Define test scenarios per workflow in `tests/workflows/`
- Format: input state -> expected output/behavior
- Could be YAML or markdown

## Proposed Structure

```
tests/
├── fixtures/
│   └── sample-project/     # Minimal project for testing
├── workflows/
│   ├── explore.scenarios.md
│   ├── plan.scenarios.md
│   └── implement.scenarios.md
└── validate-structure.ts   # Structural linter
```

## Affected Files

| File | Changes Needed |
|------|----------------|
| `tests/validate-structure.ts` | Create structural validator |
| `tests/fixtures/` | Create test fixture project |
| `tests/workflows/*.scenarios.md` | Define test scenarios |
| `.github/workflows/` | Add CI validation step (optional) |

## Acceptance Criteria

- [ ] Structural validator checks all workflow files
- [ ] Test fixture project with predictable code patterns
- [ ] At least 3 workflow scenarios documented
- [ ] Validation runs without errors on current workflows
- [ ] Documentation for adding new workflow tests

## Considerations

- Focus on structural outcomes, not exact AI text output
- Reset fixture project state between tests if needed
- Mock approval responses in gate scenarios
- Full integration tests require actual AI execution (expensive)

## Related

- **Workflows:** `.ai-assistant/workflows/`
- **Testing Domain:** `.ai-assistant/domains/testing/vitest.instructions.md`
