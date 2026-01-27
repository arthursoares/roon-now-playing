---
provider: cursor
version: "1.0"
capabilities:
  - inline_edits
  - chat_mode
  - composer_mode
  - codebase_context
limitations:
  - no_native_slash_commands
  - no_bash_execution
  - limited_gate_enforcement
---

# Cursor Provider Configuration

> This file configures behavior specific to Cursor IDE.

## Capabilities

Cursor has **partial feature support**:

| Feature | Support | Notes |
|---------|---------|-------|
| Slash commands | None | Must use natural language instead |
| Tool use | Limited | Edit files via Composer, no Bash |
| Gate enforcement | Weak | May proceed without waiting |
| Multi-file edits | Via Composer | Use Composer mode for multi-file |
| Approval detection | Variable | May misinterpret partial responses |

## Workflow Adaptations

Since Cursor doesn't support native slash commands, adapt the workflows:

### Instead of `/implement`

Say: "Let's implement [feature]. First, explore the codebase and show me what you find. Don't make changes yet."

### Instead of `/debug`

Say: "Help me debug [issue]. First, analyze the code and form a hypothesis. Don't fix anything until I approve."

### Instead of `/refactor`

Say: "I want to refactor [pattern]. First, find all occurrences and show me a plan. Wait for my approval before making changes."

## Gate Enforcement

**WARNING:** Cursor may not reliably stop at gates.

**Stronger gate format for Cursor:**

```markdown
## STOP - APPROVAL NEEDED

I have completed the analysis phase.

**IMPORTANT:** I will NOT proceed with any changes until you explicitly type "approved" or "yes, proceed".

What would you like me to do?
- Type "approved" to continue
- Type "modify" to change the plan
- Type "cancel" to stop
```

## Communication Templates

Cursor renders markdown but may not display box characters consistently. Use simpler formats:

```markdown
---
## ⚠️ ACTION REQUIRED

[message]

**Reply with:** approved / modify / cancel
---
```

## Best Practices for Cursor

1. **Use Composer for multi-file edits** - Chat mode is for single files
2. **Be explicit about waiting** - "Do NOT make changes until I say 'approved'"
3. **Break into smaller steps** - Ask for analysis first, then changes
4. **Review diffs carefully** - Cursor may make unexpected changes
5. **Use natural language** - "implement the login feature" not "/implement"

## Limitations

- No bash/terminal command execution
- Cannot run tests directly
- May not wait for approval reliably
- Context is per-conversation, not persistent

## Recommended Workflow

1. **Explore first:** "Analyze the codebase for [topic]. Show me what you find but don't change anything."
2. **Wait for plan:** Review the analysis
3. **Approve explicitly:** "Approved. Make the changes you described."
4. **Verify:** Check the diff before accepting

---

## Entry Points

Cursor supports two entry point formats:

**Option 1: `.cursorrules` (Recommended)**
- Single file at project root
- Simple and compatible with older Cursor versions

**Option 2: `.cursor/rules/*.mdc`**
- Multiple rule files in a directory
- Supports frontmatter with `globs` and `alwaysApply`
- More granular control

Both should reference `.ai-assistant/.instructions.md` as the main instruction file.
