---
provider: gemini
version: "1.0"
capabilities:
  - large_context
  - code_generation
  - file_analysis
limitations:
  - experimental_tool_use
  - variable_gate_enforcement
---

# Gemini Provider Configuration

> This file configures behavior specific to Google Gemini (via AGENTS.md or GEMINI.md).

## Capabilities

Gemini has **experimental feature support**:

| Feature | Support | Notes |
|---------|---------|-------|
| Slash commands | None | Use natural language |
| Tool use | Experimental | Depends on integration |
| Gate enforcement | Variable | May not wait reliably |
| Multi-file edits | Depends | Integration-specific |
| Large context | Strong | Good for large codebases |

## Workflow Adaptations

Gemini's capabilities vary based on how it's integrated (IDE plugin, API, web interface).

### For IDE Integrations

If using Gemini in an IDE:

```markdown
Analyze the codebase for [topic].
Show me your findings but do NOT make changes.
I will tell you when to proceed.
```

### For API/CLI Use

If using Gemini via API:

```markdown
I want to implement [feature].

Instructions:
1. First, return ONLY your analysis - no code changes
2. Wait for my next message with approval
3. Then return the implementation

Begin with the analysis.
```

## Gate Enforcement

Use natural language gates since Gemini may not recognize formatted gates:

```markdown
I have completed the analysis phase.

Please note: I need your explicit approval before I proceed.
- Say "yes" or "approved" to continue
- Say "modify" to change the approach
- Say "stop" to cancel

I am waiting for your response.
```

## Best Practices for Gemini

1. **Leverage large context** - Gemini handles large codebases well
2. **Use simple instructions** - Avoid complex formatting
3. **Request analysis first** - Don't ask for changes immediately
4. **Be explicit about steps** - "First do X, then wait for my approval"
5. **Verify understanding** - Ask Gemini to confirm before proceeding

## Integration Notes

### GEMINI.md Entry Point

For projects using Gemini, create `GEMINI.md`:

```markdown
# Gemini Instructions

Read and follow: .ai-assistant/.instructions.md

Key rules:
1. Analyze before changing
2. Wait for explicit approval
3. Follow project patterns
```

### AGENTS.md Entry Point

For Google's agent framework:

```markdown
# Agent Instructions

This project uses the AI Assistant Framework.
See .ai-assistant/.instructions.md for all guidelines.

Important: Wait for user approval before making changes.
```

## Limitations

- Inconsistent tool use support
- May not follow complex workflows
- Gate enforcement varies by integration
- Limited bash/terminal support

---

**Entry Points:**
- `GEMINI.md` → `.ai-assistant/.instructions.md`
- `AGENTS.md` → `.ai-assistant/.instructions.md`
