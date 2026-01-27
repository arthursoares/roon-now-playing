---
provider: windsurf
version: "1.0"
capabilities:
  - cascade_mode
  - inline_edits
  - file_creation
limitations:
  - partial_gate_enforcement
  - limited_bash
---

# Windsurf Provider Configuration

> This file configures behavior specific to Windsurf (Codeium).

## Capabilities

Windsurf has **partial feature support**:

| Feature | Support | Notes |
|---------|---------|-------|
| Slash commands | None | Use natural language |
| Tool use | Partial | Cascade can edit files |
| Gate enforcement | Weak | May not wait reliably |
| Multi-file edits | Full | Cascade mode handles well |
| Approval detection | Variable | Be explicit about waiting |

## Workflow Adaptations

### Use Cascade Mode

For multi-file operations, use Cascade mode which has more capabilities than chat.

### Explicit Instructions

Since gate enforcement is weak, be very explicit:

```markdown
I want to implement [feature].

IMPORTANT INSTRUCTIONS:
1. First, analyze the codebase and show me your findings
2. Do NOT create or modify any files yet
3. Present a plan and wait for my approval
4. Only proceed when I type "approved"

Start with step 1 - show me the analysis.
```

## Gate Enforcement

Use stronger language than the standard gates:

```markdown
## STOP - WAITING FOR APPROVAL

I have completed the analysis.

**I WILL NOT PROCEED** until you type one of:
- "approved" - continue with changes
- "modify" - adjust the plan
- "cancel" - stop

What is your decision?
```

## Best Practices for Windsurf

1. **Use Cascade for multi-file** - More reliable than chat
2. **Be explicit about waiting** - "Do NOT proceed until..."
3. **Request analysis first** - Don't jump to changes
4. **Review changes carefully** - May make unexpected edits
5. **Commit manually** - Don't rely on automated commits

## Limitations

- Gate enforcement is unreliable
- May proceed without waiting
- Limited terminal/bash support
- Natural language commands only

---

**Entry Point:** `.windsurfrules` → `.ai-assistant/.instructions.md`
