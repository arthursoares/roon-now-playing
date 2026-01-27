---
provider: claude
version: "1.0"
capabilities:
  - slash_commands
  - tool_use
  - gate_enforcement
  - multi_file_edits
  - bash_execution
---

# Claude Code Provider Configuration

> This file configures behavior specific to Claude Code (Anthropic's CLI).

## Capabilities

Claude Code has **full feature support**:

| Feature | Support | Notes |
|---------|---------|-------|
| Slash commands | Full | `/implement`, `/debug`, etc. work natively |
| Tool use | Full | Read, Write, Edit, Bash, etc. |
| Gate enforcement | Strong | Claude respects STOP/WAIT instructions well |
| Multi-file edits | Full | Can edit many files in sequence |
| Approval detection | Good | Understands approval tokens reliably |

## Gate Behavior

Claude Code reliably respects gate instructions. Use the standard gate format:

```markdown
**⛔ GATE: STOP HERE. Do NOT proceed until user responds with explicit approval.**

**Waiting for:** `yes`, `approved`, `proceed`, `lgtm`, or `go ahead`
```

## Workflow Execution

All workflows in `.ai-assistant/workflows/` are fully supported:
- `/implement` - Full explore → plan → code → commit cycle
- `/debug` - Systematic investigation with approval gates
- `/refactor` - Multi-file changes with tracking
- `/validate` - Runs typecheck, lint, tests
- `/commit` - Review and commit with confirmation

## Communication Templates

Claude renders markdown well. Use the full communication template format:

```
╔═══════════════════════════════════════════════════════════╗
║ 🔴 ACTION REQUIRED                                        ║
╠═══════════════════════════════════════════════════════════╣
║ [message]                                                 ║
╚═══════════════════════════════════════════════════════════╝
```

## Best Practices for Claude

1. **Use explicit approval tokens** - Claude understands "yes/no" well
2. **Reference files by path** - Claude can read files directly
3. **Break complex tasks into phases** - Matches Claude's planning capability
4. **Use TodoWrite for tracking** - Claude has native todo support

## Limitations

- Context window limits may affect very large codebases
- Long sessions may require context refresh
- Some operations require user permission grants

---

**Entry Point:** `CLAUDE.md` → `.ai-assistant/.instructions.md`
