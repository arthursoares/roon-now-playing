# Project Configuration

> Override framework defaults here. Copy this file to `.ai-project/config.md` and modify as needed.

## Display Options

### Emoji Usage

Control whether emojis appear in AI responses and templates.

```yaml
use_emojis: true  # Set to 'false' to disable emojis
```

**When `use_emojis: false`:**
- Status indicators use text: `[DONE]`, `[ERROR]`, `[WARNING]`, `[ACTION]`
- Chatmode labels use text: `[Explorer]`, `[Developer]`, etc.
- Box frames still appear for visual structure

### Message Format

Choose between detailed and compact message styles.

```yaml
message_style: detailed  # Options: 'detailed', 'compact'
```

**detailed:** Full box frames with sections
**compact:** Single-line status messages

---

## Workflow Defaults

### Default Scope

```yaml
default_scope: uncommitted  # Options: 'uncommitted', 'all', 'prompt'
```

- `uncommitted` - Work on uncommitted changes by default
- `all` - Include all files by default
- `prompt` - Always ask for scope

### Auto-validation

```yaml
auto_validate: true  # Run typecheck/lint after changes
```

---

## Git Preferences

### Branch Naming

```yaml
main_branch: main
feature_pattern: feature/{description}
bugfix_pattern: fix/{description}
```

### Commit Format

```yaml
commit_style: conventional  # Options: 'conventional', 'ticket', 'simple'
```

**conventional:** `feat: add login` / `fix: handle null` / `refactor: extract util`
**ticket:** `PROJ-123: Add login feature`
**simple:** `Add login feature`

---

## Approval Preferences

### Gate Behavior

```yaml
require_explicit_approval: true  # Don't proceed on ambiguous responses
approval_words: [yes, y, approved, proceed, lgtm, go ahead]
```

---

## Example Complete Configuration

```yaml
# .ai-project/config.md

use_emojis: false
message_style: compact
default_scope: uncommitted
auto_validate: true

main_branch: main
feature_pattern: feature/{description}
commit_style: conventional

require_explicit_approval: true
```
