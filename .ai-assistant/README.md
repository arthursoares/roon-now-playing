# AI Assistant Framework

A modular AI assistant instruction framework that can be used as a git submodule or symlink in any project.

## Quick Start

### Option 1: Git Submodule (Recommended)

```bash
# Add as submodule
git submodule add https://github.com/your-org/ai-assistant-starter.git .ai-assistant

# Run /init to create project layer
```

### Option 2: Symlink

```bash
# Clone to a shared location
git clone https://github.com/your-org/ai-assistant-starter.git ~/ai-assistant

# Symlink into your project
ln -s ~/ai-assistant .ai-assistant

# Run /init to create project layer
```

### Option 3: Direct Copy

```bash
# Copy directly (not recommended - won't receive updates)
cp -r /path/to/ai-assistant-starter .ai-assistant

# Run /init to create project layer
```

### Manual Setup

If you prefer not to use `/init`:

```bash
# Copy project layer template
cp -r .ai-assistant/.ai-project .ai-project

# Edit the template files
```

## Directory Structure

```
your-project/
├── .ai-assistant/          # Base framework (submodule/symlink)
│   ├── .instructions.md    # Global execution protocol
│   ├── INDEX.md            # Cross-reference index
│   ├── scope.md            # Framework scope definition
│   ├── chatmodes/          # Role definitions
│   ├── domains/            # Technology guidelines
│   ├── workflows/          # Workflow definitions
│   ├── tasks/              # Atomic task definitions
│   ├── providers/          # Provider setup guides
│   ├── todos/              # Framework todos
│   ├── .ai-project/        # Template for project layer
│   └── README.md           # This file
│
├── .ai-project/            # Project-specific (created by /init)
│   ├── .memory.md          # Project architecture & stack
│   ├── .context.md         # Project patterns & imports
│   ├── config.md           # Project configuration settings
│   ├── placeholders.md     # Placeholder definitions
│   ├── project/            # Project commands & structure
│   ├── domains/            # Override domain rules
│   ├── workflows/          # Custom workflows
│   ├── todos/              # Project todos
│   ├── history/            # Project history
│   ├── decisions/          # Architecture Decision Records
│   └── file-lists/         # Batch operation tracking
│
├── .claude/                # Claude-specific entry (commands/)
├── CLAUDE.md               # Claude entry point
├── .cursor/                # Cursor-specific entry (optional)
└── [other providers]       # Other AI provider entry points
```

Provider-specific directories (`.claude/`, `.cursor/`, etc.) and entry files (`CLAUDE.md`, etc.) are thin wrappers that reference the generic `.ai-assistant/` framework.

The `.ai-assistant/.ai-project/` directory is a template. Running `/init` copies it to `.ai-project/` at the project root.

## Resolution Logic

When the AI assistant looks for a file (e.g., `domains/typescript.instructions.md`):

1. **First:** Check `.ai-project/domains/typescript.instructions.md`
2. **Fallback:** Use `.ai-assistant/domains/typescript.instructions.md`

This allows projects to:
- **Override** any base file by placing a file with the same path in `.ai-project/`
- **Extend** by adding new files that don't exist in base
- **Inherit** defaults by not overriding

## What Goes Where

### Base Library (`.ai-assistant/`)

Generic, reusable content:
- Execution protocols and communication style
- Role definitions (developer, tester, reviewer, etc.)
- Technology guidelines (TypeScript, testing, git, etc.)
- Workflow templates (implement, debug, refactor, etc.)
- Atomic task definitions
- Provider setup guides (Claude, Cursor, Copilot, etc.)

**Do not modify** - updates come from upstream.

### Project Layer (`.ai-project/`)

Project-specific content:
- `.memory.md` - Your project's tech stack, architecture, conventions
- `.context.md` - Common imports, file locations, patterns
- `config.md` - Project configuration settings
- `placeholders.md` - Placeholder definitions for templates
- `project/` - Commands, structure, configuration
- `domains/` - Override or extend technology rules
- `workflows/` - Custom workflows for your project
- `todos/` - Technical debt and deferred work
- `history/` - Knowledge from past work
- `decisions/` - Architecture Decision Records
- `file-lists/` - Batch operation tracking

## Customization Examples

### Override TypeScript Rules

Create `.ai-project/domains/typescript.instructions.md`:

```markdown
---
applyTo: "**/*.{ts,tsx}"
priority: high
---

# TypeScript Rules (Project Override)

## Project-Specific Type Patterns

// Your custom rules here
```

### Add Custom Workflow

Create `.ai-project/workflows/deploy.prompt.md`:

```markdown
---
workflow: deploy
priority: high
---

# Deploy Workflow

Steps for deploying this project...
```

### Extend with New Domain

Create `.ai-project/domains/graphql.instructions.md`:

```markdown
---
applyTo: "**/*.graphql"
priority: high
---

# GraphQL Guidelines

Project-specific GraphQL patterns...
```

## Updating the Base Framework

```bash
# If using submodule
cd .ai-assistant
git pull origin main
cd ..
git add .ai-assistant
git commit -m "chore: update ai-assistant framework"

# If using symlink
cd ~/ai-assistant
git pull origin main
```

## Provider Entry Points

Each AI provider has its own entry point format. These should be thin wrappers that reference the generic framework:

### Claude (`CLAUDE.md`)

```markdown
# AI Assistant Instructions

**Read and follow:** [.ai-assistant/.instructions.md](.ai-assistant/.instructions.md)

All guidelines, workflows, and domain-specific instructions are in `.ai-assistant/`.
Project-specific overrides are in `.ai-project/` (if present).
```

### Cursor (`.cursorrules`)

```markdown
Read and follow the instructions in .ai-assistant/.instructions.md

All guidelines, workflows, and domain-specific instructions are in .ai-assistant/
Project-specific overrides are in .ai-project/ (if present)
```

**Note:** Cursor also supports `.cursor/rules/*.mdc` files. See [cursor.provider.md](./providers/cursor.provider.md) for details.

### Other Providers

See `.ai-assistant/providers/` for setup guides for other AI providers (Copilot, Windsurf, Gemini, etc.).

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Chatmodes | `{role}.chatmode.md` | `developer.chatmode.md` |
| Workflows | `{name}.prompt.md` | `implement.prompt.md` |
| Tasks | `{name}.task.md` | `gather-context.task.md` |
| Domains | `{domain}.instructions.md` | `typescript.instructions.md` |
| Providers | `{provider}.provider.md` | `claude.provider.md` |
