---
task: update-docs
chatmode: developer
tools: [read, edit, write]
gate: optional
---

# Task: Update Documentation

> **Purpose:** Prompt for documentation updates after completing work
> **Chatmode:** Developer
> **Gate:** Optional - user decides what's relevant

## When to Prompt

Prompt for documentation when:
- New feature or significant functionality added
- Patterns discovered worth remembering
- User-facing changes that need explanation
- Architecture decisions made
- Gotchas or edge cases discovered

## Documentation Check

Present this prompt after commit:

```markdown
## Documentation (Optional)

**What was done:** [brief summary of work]

**Consider documenting:**

| Type | When Relevant | Action |
|------|---------------|--------|
| AI context | New patterns, architecture decisions, gotchas | Update `.ai-project/` |
| User docs | User-facing features, API changes | Add to `docs/` |
| README | Getting started, feature overview | Update `README.md` |

**What would you like to document?**
- `ai` - Update AI assistant context
- `user` - Add/update user documentation
- `readme` - Update README
- `all` - All of the above
- `skip` - No documentation needed

Reply with one or more options (e.g., `ai, readme`) or `skip`.
```

**Wait for user response.**

---

## Templates

### AI Assistant Documentation (`.ai-project/`)

When user selects `ai`:

#### Memory Update (`.ai-project/.memory.md`)

```markdown
## Session Context

### Recent Work
- [Date]: [Brief description of what was implemented]

### Patterns Discovered
- [Pattern name]: [How it works, when to use]

### Gotchas
- [Issue]: [What to watch out for]
```

#### History Entry (`.ai-project/history/`)

For significant work, create `YYYY-MM-DD-[slug].md`:

```markdown
# [Title]

**Date:** YYYY-MM-DD
**Type:** feature | refactor | fix | improvement

## Summary
[1-2 sentences describing what was done]

## Changes
- [Key change 1]
- [Key change 2]

## Patterns Used
- [Pattern]: [Why it was used]

## Decisions Made
- [Decision]: [Rationale]

## Future Considerations
- [What to keep in mind for future work]
```

#### Context Update (`.ai-project/.context.md`)

```markdown
## [Feature/Area] Patterns

### Imports
\`\`\`typescript
import { Thing } from '@/path/to/thing';
\`\`\`

### Common Usage
\`\`\`typescript
// Example of how to use the new feature
\`\`\`
```

---

### User Documentation (`docs/`)

When user selects `user`:

#### Feature Documentation

Create `docs/[feature-name].md`:

```markdown
# [Feature Name]

[One paragraph description of what this feature does and why it exists.]

## Quick Start

\`\`\`typescript
// Minimal example to get started
\`\`\`

## Usage

### Basic Usage

[Explain the common use case]

\`\`\`typescript
// Code example
\`\`\`

### Advanced Usage

[Explain more complex scenarios]

\`\`\`typescript
// Code example
\`\`\`

## API Reference

### `functionName(param)`

[Description]

**Parameters:**
- `param` (Type) - Description

**Returns:** Type - Description

**Example:**
\`\`\`typescript
const result = functionName(value);
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option1` | `string` | `"default"` | What it does |

## Troubleshooting

### Common Issue

**Problem:** [Description]
**Solution:** [How to fix]
```

#### API Documentation

For API endpoints, create `docs/api/[endpoint].md`:

```markdown
# [Endpoint Name]

## `METHOD /path/to/endpoint`

[Description of what this endpoint does]

### Request

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |

**Body:**
\`\`\`json
{
  "field": "value"
}
\`\`\`

### Response

**Success (200):**
\`\`\`json
{
  "data": {}
}
\`\`\`

**Error (400):**
\`\`\`json
{
  "error": "message"
}
\`\`\`

### Example

\`\`\`bash
curl -X POST https://api.example.com/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"field": "value"}'
\`\`\`
```

---

### README Updates

When user selects `readme`:

#### New Feature Section

```markdown
## [Feature Name]

[Brief description - what it does and why you'd use it]

\`\`\`typescript
// Quick example
\`\`\`

See [full documentation](./docs/feature-name.md) for details.
```

#### Getting Started Addition

```markdown
### [Step Name]

[Instructions for this step]

\`\`\`bash
# Command or code
\`\`\`
```

#### Configuration Addition

```markdown
### [Config Name]

| Variable | Description | Default |
|----------|-------------|---------|
| `VAR_NAME` | What it does | `value` |
```

---

## Execution

Based on user selection:

1. **`ai`**:
   - Update `.ai-project/.memory.md` with session context
   - Create history entry if significant
   - Update `.ai-project/.context.md` if new patterns

2. **`user`**:
   - Create `docs/` directory if needed
   - Create appropriate documentation file
   - Link from README if user-facing feature

3. **`readme`**:
   - Add section for new feature/capability
   - Update getting started if workflow changed
   - Add configuration if new options

4. **`skip`**:
   - Proceed without documentation
   - No action needed

## Output

After documentation:

```markdown
## Documentation Updated

**Files modified:**
- `.ai-project/.memory.md` - Added session context
- `docs/feature-name.md` - Created feature documentation
- `README.md` - Added feature section

**Next:** Work complete!
```

If skipped:

```markdown
## Documentation Skipped

No documentation updates needed for this change.

**Next:** Work complete!
```
