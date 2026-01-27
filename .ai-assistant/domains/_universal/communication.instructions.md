---
applyTo: "**/*"
priority: high
---

# Communication Templates

> **Purpose:** Predictable, semantically-colored message formats following CLI UX best practices.
> **Sources:** [clig.dev](https://clig.dev/), [CLI UX Patterns](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)

## Configuration

Emojis and message style can be configured in `.ai-project/config.md`:

```yaml
use_emojis: true   # Set to 'false' for text-only indicators
message_style: detailed  # 'detailed' or 'compact'
```

### Text-Only Mode

When `use_emojis: false` is set, use these text alternatives:

| Emoji | Text Alternative |
|-------|------------------|
| 📋 | `[TASK]` |
| ✅ | `[DONE]` |
| ✓ | `[OK]` |
| ❌ | `[ERROR]` |
| ⚠️ | `[WARNING]` |
| 🔴 | `[ACTION]` |
| 📝 | `[INPUT]` |
| ⚡ | `[CONFIRM]` |
| 💡 | `[INFO]` |
| 💬 | `[NEXT]` |

**Example without emojis:**
```
════════════════════════════════════════════════════════════
[TASK] Refactor UserProfile component
════════════════════════════════════════════════════════════

[DONE] STATUS
────────────────────────────────────────────────────────────
Refactoring complete
  [OK] 5 files updated
  [OK] Tests passing

[NEXT]
────────────────────────────────────────────────────────────
  * Run `npm run lint` to check style
```

---

## Core Principles

1. **Human-readable first** - Clear language, structured output
2. **State confirmation** - Show what changed, suggest next actions
3. **Semantic colors** - Emoji/symbols for quick scanning (green=success, red=error, yellow=warning)
4. **Progress feedback** - Never leave user staring at blank screen
5. **Explain errors** - Say WHY it failed and HOW to fix

---

## Response Structure

```
════════════════════════════════════════════════════════════
📋 TASK: [Brief task description]
════════════════════════════════════════════════════════════

✅ STATUS
────────────────────────────────────────────────────────────
[Results, what changed]
  ✓ Item completed
  ✓ Another item

⚠️ WARNING
────────────────────────────────────────────────────────────
[Risk or caution - only if applicable]

🔴 ACTION REQUIRED
────────────────────────────────────────────────────────────
[Question or decision needed]

  (A) Option one
      [consequence/description]

  (B) Option two
      [consequence/description]

👉 Your choice: _
```

---

## Section Reference

| Section | Emoji | Purpose | User Action |
|---------|-------|---------|-------------|
| TASK | 📋 | Header - current work | None |
| STATUS | ✅ | Completion, results | None |
| INFO | 💡 | Context, explanation | None |
| WARNING | ⚠️ | Risk, caution | Read carefully |
| ERROR | ❌ | Failure + fix suggestion | Read carefully |
| ACTION REQUIRED | 🔴 | Decision needed | **Must respond** |
| INPUT NEEDED | 📝 | Information required | **Must respond** |
| CONFIRM | ⚡ | Yes/no for risky action | **Must respond** |
| NEXT | 💬 | Suggested next steps | Optional |

### Section Order (Always)

1. 📋 **TASK** - Header identifying current work
2. ✅ **STATUS** / 💡 **INFO** - Results, context
3. ⚠️ **WARNING** - Risks, cautions (non-blocking)
4. ❌ **ERROR** - Failures with cause + fix
5. 🔴 **ACTION** / 📝 **INPUT** / ⚡ **CONFIRM** - User response needed
6. 💬 **NEXT** - Suggested follow-up actions

---

## Status Messages (No Action)

### Task Complete

```
════════════════════════════════════════════════════════════
📋 TASK: Refactor UserProfile component
════════════════════════════════════════════════════════════

✅ STATUS
────────────────────────────────────────────────────────────
Refactoring complete
  ✓ 5 files updated
  ✓ 12 inline styles → CSS modules
  ✓ Tests passing

💬 NEXT
────────────────────────────────────────────────────────────
• Run `npm run lint` to check style
• Run `/commit` to stage changes
```

### With Warning

```
════════════════════════════════════════════════════════════
📋 TASK: Update dependencies
════════════════════════════════════════════════════════════

✅ STATUS
────────────────────────────────────────────────────────────
12 packages upgraded

⚠️ WARNING
────────────────────────────────────────────────────────────
2 deprecation notices:
  ⚠ lodash.get → use optional chaining (?.)
  ⚠ moment → consider date-fns
```

---

## Error Messages

Follow the pattern: **What failed** → **Why** → **How to fix**

```
════════════════════════════════════════════════════════════
📋 TASK: Build project
════════════════════════════════════════════════════════════

❌ ERROR
────────────────────────────────────────────────────────────
Build failed

  What:  Cannot read property 'name' of undefined
  Where: src/components/UserProfile.tsx:45
  Why:   user object is null when component mounts

  Fix:   Add null check before accessing user.name
         → if (user?.name) { ... }

🔴 ACTION REQUIRED
────────────────────────────────────────────────────────────
How to proceed?

  (A) Apply fix automatically
  (B) Revert to last working state
  (C) Show me the code first

👉 Your choice: _
```

---

## Action Required Messages

### Decision with Options

```
════════════════════════════════════════════════════════════
📋 TASK: Implement authentication
════════════════════════════════════════════════════════════

💡 INFO
────────────────────────────────────────────────────────────
Found existing session handling in src/lib/auth.ts

🔴 ACTION REQUIRED
────────────────────────────────────────────────────────────
Choose authentication strategy:

  (A) JWT tokens
      ✓ Stateless, scalable
      ✗ Can't revoke without blocklist

  (B) Session cookies
      ✓ Easy revocation
      ✗ Requires session store

  (C) Something else
      Tell me your preference

👉 Your choice: _
```

### Input Needed

```
════════════════════════════════════════════════════════════
📋 TASK: Configure API client
════════════════════════════════════════════════════════════

📝 INPUT NEEDED
────────────────────────────────────────────────────────────
API base URL required to continue

  Format:   https://api.example.com/v1
  Found in: Dashboard → Settings → API

👉 Enter URL: _
```

---

## Confirmation Requests

Risk level determines confirmation style (per [clig.dev](https://clig.dev/)):

### Low Risk (local, reversible)

```
════════════════════════════════════════════════════════════
📋 TASK: Format code
════════════════════════════════════════════════════════════

⚡ CONFIRM
────────────────────────────────────────────────────────────
Reformat 23 files with Prettier?

  Reversible: Yes (git tracked)

👉 Proceed? (y/n): _
```

### Medium Risk (remote changes, deletions)

```
════════════════════════════════════════════════════════════
📋 TASK: Delete unused files
════════════════════════════════════════════════════════════

⚠️ WARNING
────────────────────────────────────────────────────────────
This will permanently delete 8 files

⚡ CONFIRM
────────────────────────────────────────────────────────────
Files to delete:
  • src/utils/deprecated.ts
  • src/components/OldHeader.tsx
  • src/hooks/useLegacy.ts
  • ... and 5 more

👉 Type 'yes' to confirm, or 'list' to see all: _
```

### High Risk (destructive, irreversible)

```
════════════════════════════════════════════════════════════
📋 TASK: Force push to main
════════════════════════════════════════════════════════════

❌ DANGER
────────────────────────────────────────────────────────────
Force push will overwrite remote history
This affects all collaborators and cannot be undone

⚡ CONFIRM
────────────────────────────────────────────────────────────
Type the branch name to confirm: main

👉 Branch name: _
```

---

## Progress Indicators

For long-running operations, show progress immediately (within 100ms):

### Spinner + Status

```
📋 Installing dependencies...
   ⠋ Resolving packages
   ⠙ Downloading @types/node
   ⠹ Linking dependencies
```

### Progress Bar

```
📋 Processing files
   [████████████░░░░░░░░] 60% (12/20)
   Current: src/components/Button.tsx
```

### Multi-step with Checkmarks

```
📋 Running validation
   ✓ Type check passed
   ✓ Lint passed (2 warnings)
   ⠋ Running tests...
   ○ Build (pending)
```

---

## Compact Format

For quick updates during work, use inline without borders:

```
📋 Analyzing codebase...
   ✓ Found 15 components
   ✓ Identified 3 patterns
   ⚠ 2 files have circular imports
📋 Generating report...
```

---

## Quick Reference

```
INFORMATIONAL (no action):     ACTION REQUIRED (must respond):
  ✅ STATUS  - Results           🔴 ACTION  - Decision needed
  💡 INFO    - Context           📝 INPUT   - Info needed
  💬 NEXT    - Follow-up         ⚡ CONFIRM - Yes/no

ATTENTION (read carefully):    PROGRESS (during work):
  ⚠️ WARNING - Caution           ✓ Complete   ⠋ Working
  ❌ ERROR   - Fix suggestion    ○ Pending
```

---

**Last Updated:** 2025-11-29
