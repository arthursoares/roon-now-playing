# Architecture Decision Records (ADRs)

This directory contains records of significant architectural decisions.

## Purpose

ADRs document:
- Important architectural choices
- Context and reasoning behind decisions
- Alternatives that were considered
- Consequences (positive and negative)

## When to Create

Create an ADR when:
- Choosing between significant approaches
- Adopting a new pattern or technology
- Making decisions that affect many files
- Establishing conventions for the project

## File Naming

Use descriptive names:
- `state-management.md`
- `api-client-pattern.md`
- `testing-strategy.md`

## Template

```markdown
# ADR: {Title}

**Date:** {YYYY-MM-DD}
**Status:** Proposed | Accepted | Deprecated | Superseded

## Context

[What is the issue motivating this decision?]

## Decision

[What is the change we're making?]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

## Alternatives Considered

### {Alternative 1}
- Pros: [...]
- Cons: [...]
- Why not: [...]
```

## Status Definitions

- **Proposed** - Under consideration
- **Accepted** - Decision has been made and implemented
- **Deprecated** - No longer recommended but still exists
- **Superseded** - Replaced by another ADR (link to new one)
