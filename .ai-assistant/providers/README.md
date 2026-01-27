# Provider Configurations

This directory contains provider-specific configurations that document capabilities, limitations, and adaptations for different AI coding assistants.

## Provider Compatibility Matrix

| Feature | Claude Code | Cursor | Copilot | Windsurf | Gemini |
|---------|-------------|--------|---------|----------|--------|
| **Slash Commands** | Full | None | Limited | Partial | None |
| **Tool Execution** | Full | Limited | None | Partial | Partial |
| **Gate Enforcement** | Strong | Weak | None | Weak | Weak |
| **Multi-file Edits** | Full | Composer | Manual | Full | Partial |
| **Bash/Terminal** | Full | None | None | Partial | Partial |
| **File Creation** | Full | Yes | No | Yes | Yes |
| **Workflow Automation** | Full | Manual | Manual | Partial | Partial |

### Legend

- **Full** - Feature works as designed
- **Partial** - Feature works with limitations
- **Limited** - Significantly reduced functionality
- **Weak** - Unreliable, may not work consistently
- **None** - Feature not available
- **Manual** - User must perform action manually

## Provider Files

| Provider | File | Recommendation |
|----------|------|----------------|
| Claude Code | [claude.provider.md](./claude.provider.md) | **Recommended** - Full feature support |
| Cursor | [cursor.provider.md](./cursor.provider.md) | Good for inline edits, weak on workflows |
| GitHub Copilot | [copilot.provider.md](./copilot.provider.md) | Best for code suggestions only |
| Windsurf | [windsurf.provider.md](./windsurf.provider.md) | Similar to Cursor |
| Gemini | [gemini.provider.md](./gemini.provider.md) | Experimental support |

## Choosing a Provider

### Full Workflow Support

Use **Claude Code** if you want:
- Multi-phase workflows (explore → plan → code → commit)
- Reliable approval gates
- Bash command execution
- Automated validation

### Quick Inline Edits

Use **Cursor** if you want:
- Fast inline completions
- Composer for multi-file edits
- IDE integration
- But: manage workflows manually

### Code Suggestions Only

Use **GitHub Copilot** if you want:
- Autocomplete suggestions
- Code explanations
- Simple Q&A
- But: perform all actions manually

## Adapting Workflows

When using providers with limited support, adapt the workflows:

### Instead of Slash Commands

```markdown
# Claude Code
/implement add user authentication

# Cursor/Other
"I want to implement user authentication.
First, explore the codebase and show me related files.
Do NOT make changes until I approve."
```

### Instead of Automatic Gates

```markdown
# Claude Code (automatic)
**⛔ GATE: STOP HERE.**

# Other Providers (explicit)
"STOP. I need to review before continuing.
Do NOT proceed until I type 'approved'."
```

### Instead of Bash Execution

```markdown
# Claude Code
npm run test

# Other Providers
"Please tell me the test command to run.
I will run it and paste the results."
```

## Adding New Providers

To add support for a new provider:

1. Create `{provider}.provider.md` in this directory
2. Document capabilities and limitations
3. Provide workflow adaptations
4. Add to the compatibility matrix above

Use the existing provider files as templates.
