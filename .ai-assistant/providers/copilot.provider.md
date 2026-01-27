---
provider: github-copilot
version: "1.0"
capabilities:
  - inline_completion
  - chat_mode
  - workspace_context
limitations:
  - no_slash_commands
  - no_file_creation
  - no_bash_execution
  - no_gate_enforcement
---

# GitHub Copilot Provider Configuration

> This file configures behavior specific to GitHub Copilot Chat.

## Capabilities

GitHub Copilot has **limited feature support**:

| Feature | Support | Notes |
|---------|---------|-------|
| Slash commands | VS Code only | Limited built-in commands |
| Tool use | None | Cannot execute tools |
| Gate enforcement | None | Cannot wait for approval |
| Multi-file edits | Manual | Suggests code, user applies |
| Approval detection | None | No workflow state |

## Workflow Adaptations

Copilot is best used for **code suggestions** rather than **workflow automation**.

### What Copilot Can Do

- Explain code
- Suggest implementations
- Answer questions about patterns
- Generate code snippets
- Review code (with `/review` in VS Code)

### What Copilot Cannot Do

- Execute multi-phase workflows
- Wait for approval gates
- Run bash commands
- Create or modify files directly
- Track task state across messages

## Recommended Usage Pattern

Use Copilot for **assistance** within a manual workflow:

1. **You:** Read the framework instructions manually
2. **Ask Copilot:** "How should I implement [feature] following the patterns in this codebase?"
3. **You:** Apply suggestions manually
4. **Ask Copilot:** "Review this code for issues"
5. **You:** Commit manually

## Communication with Copilot

When asking Copilot for help, reference the framework:

```
Following the patterns in .ai-assistant/, how should I:
1. [Your question]

Please provide code that follows the project's TypeScript and testing conventions.
```

## Best Practices for Copilot

1. **Reference conventions explicitly** - "Use the patterns from .ai-assistant/domains/typescript.instructions.md"
2. **Ask for explanations** - Copilot is good at explaining code
3. **Request reviews** - Use `/review` or ask "Review this code"
4. **Break into small asks** - One function or component at a time
5. **Copy suggestions carefully** - Verify before applying

## Limitations

- No workflow automation
- No file system access
- No command execution
- Context limited to open files
- Cannot track multi-step tasks

## Workflow Integration

Since Copilot cannot run workflows, use it alongside manual execution:

```bash
# You run validation manually
npm run typecheck
npm run lint
npm run test

# Ask Copilot to help fix issues
"The type error on line 42 says X. How should I fix it following the patterns in this codebase?"
```

---

**Entry Point:** `.github/copilot-instructions.md` → `.ai-assistant/.instructions.md`
