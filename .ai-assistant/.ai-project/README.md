# Project Layer

> **Note:** This is a template. Run `/init` to copy this to `.ai-project/` at your project root.

This directory contains project-specific AI assistant configuration and tracking.

## Structure

```
.ai-project/
├── .memory.md          # Project architecture and tech stack
├── .context.md         # Common patterns and imports
├── project/            # Project-specific configuration
│   ├── commands.md     # Available commands
│   ├── structure.md    # Directory layout
│   ├── patterns.md     # Code templates
│   ├── stack.md        # Technology stack
│   └── config.md       # Configuration files
├── domains/            # Override/extend domain rules
├── workflows/          # Custom workflows
├── todos/              # Technical debt tracking
├── history/            # Knowledge from past work
├── decisions/          # Architecture Decision Records
└── file-lists/         # Batch operation tracking
```

## Resolution Order

When the AI looks for a file:

1. **First:** Check `.ai-project/{path}`
2. **Fallback:** Use `.ai-assistant/{path}`

## Overriding Base Files

Create a file with the same path as in `.ai-assistant/` to override it:

```bash
# Override TypeScript rules
.ai-project/domains/typescript.instructions.md

# Custom commit workflow
.ai-project/workflows/commit.prompt.md
```

## Getting Started

1. **Configure memory:** Edit `.memory.md` with your project's details
2. **Set patterns:** Edit `.context.md` with common imports
3. **Document project:** Fill in `project/` files

## What to Track

### Todos
Track technical debt, shortcuts, and deferred work in `todos/`.

### History
Document significant completed work in `history/`.

### Decisions
Record architectural decisions in `decisions/`.

### File Lists
Track multi-file refactoring progress in `file-lists/`.
