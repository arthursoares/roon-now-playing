---
workflow: revert
priority: high
---

# Workflow: Revert

> **Purpose:** Safely rollback changes using git revert
> **Phases:** Identify → Assess → Revert → Validate
> **Command:** `/revert [target] [scope flags]`
> **Scope:** See [scope.md](../scope.md)

## Target Options

| Target | Description |
|--------|-------------|
| `HEAD` | Revert last commit (default) |
| `HEAD~N` | Revert last N commits |
| `<sha>` | Revert specific commit |
| `<sha>..<sha>` | Revert range of commits |
| `--pr=<number>` | Revert all commits from a PR |

## Scope Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview revert without applying |
| `--no-commit` | Stage reverts without committing |
| `--reason=<text>` | Document reason for revert |

**Examples:**
```bash
/revert                            # Revert last commit
/revert HEAD~3                     # Revert last 3 commits
/revert abc123                     # Revert specific commit
/revert --pr=456                   # Revert PR #456
/revert abc123 --reason="broke prod"  # Revert with reason
/revert HEAD --dry-run             # Preview revert
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ IDENTIFY PHASE (Explorer)                                       │
├─────────────────────────────────────────────────────────────────┤
│ revert/parse-target → revert/show-commits → revert/show-changes │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms target
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ASSESS PHASE (Planner)                                          │
├─────────────────────────────────────────────────────────────────┤
│ revert/check-dependencies → revert/assess-impact                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves revert plan
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ REVERT PHASE (Developer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ revert/apply-revert → revert/resolve-conflicts                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATE PHASE (Tester)                                         │
├─────────────────────────────────────────────────────────────────┤
│ verify/run-typecheck → verify/run-lint → test/run-tests         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms commit
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ COMMIT PHASE (Committer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ commit/finalize-revert                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Identify (Explorer)

**Chatmode:** 🔍 Explorer
**Tasks:** `revert/parse-target`, `revert/show-commits`, `revert/show-changes`

### Step 1.1: Parse Target

```bash
# Get current state
git branch --show-current
git log --oneline -10
```

**Parse target from input:**

```markdown
## Revert Target

| Parameter | Value |
|-----------|-------|
| Target | `[HEAD / sha / range]` |
| Commits | N commit(s) |
| Reason | [if provided] |
| Mode | [normal / dry-run / no-commit] |
```

### Step 1.2: Show Commits to Revert

```bash
# For single commit
git show --stat [sha]

# For range
git log --oneline [range]

# For PR
gh pr view [number] --json commits
```

**Display commits:**

```markdown
## Commits to Revert

| # | SHA | Author | Date | Message |
|---|-----|--------|------|---------|
| 1 | abc123 | @user | 2024-01-15 | feat: add feature |
| 2 | def456 | @user | 2024-01-15 | fix: related fix |

**Total:** 2 commits
```

### Step 1.3: Show What Will Change

```bash
# Show combined diff of commits being reverted
git diff [sha]^..[sha]
```

**Display changes:**

```markdown
## Changes That Will Be Reverted

**Files affected:** N files

| File | Changes |
|------|---------|
| `src/feature.ts` | +50 / -10 (will be removed) |
| `src/utils.ts` | +5 / -2 (will be removed) |
| `tests/feature.spec.ts` | +30 / -0 (will be removed) |

**Summary:**
- Lines added that will be removed: X
- Lines removed that will be restored: Y
```

### Step 1.4: Confirm Target

```markdown
## Confirm Revert Target

**You are about to revert:**
- Commit(s): `[sha(s)]`
- Message(s): "[commit message(s)]"
- Files: N files affected

**This will:**
- Remove changes introduced by these commit(s)
- Create new revert commit(s)
- NOT delete history (commits remain in log)

**Proceed with revert?** (yes / show diff / change target / abort)
```

**⛔ GATE: User must confirm target.**

---

## Phase 2: Assess (Planner)

**Chatmode:** 📋 Planner
**Tasks:** `revert/check-dependencies`, `revert/assess-impact`

### Step 2.1: Check for Dependent Changes

```bash
# Check if any commits after target depend on it
git log --oneline [sha]..HEAD

# Check for merge commits that include target
git log --oneline --merges [sha]..HEAD
```

**If dependent commits found:**

```markdown
> **WARNING:**
> Found commits that may depend on the target:
>
> | SHA | Message | Risk |
> |-----|---------|------|
> | xyz789 | feat: uses reverted code | High |
>
> **Reverting may cause:**
> - Type errors in dependent code
> - Runtime errors
> - Test failures
>
> **Options:**
> 1. Revert all dependent commits too
> 2. Proceed anyway (will need manual fixes)
> 3. Abort and investigate
>
> **How to proceed?**
```

**⏸️ Wait for decision.**

### Step 2.2: Assess Conflict Risk

```bash
# Check if files were modified since target
git diff --name-only [sha] HEAD
```

**If conflicts likely:**

```markdown
> **INFO:**
> Files modified since target commit:
>
> | File | Status | Conflict Risk |
> |------|--------|---------------|
> | `src/feature.ts` | Modified | High |
> | `src/utils.ts` | Unchanged | Low |
>
> **Conflicts may require manual resolution.**
```

### Step 2.3: Present Revert Plan

```markdown
## Revert Plan

**Target:** `[sha]` - "[message]"

**Approach:**
- Revert method: `git revert [sha]`
- Conflict risk: [Low / Medium / High]
- Dependent commits: [None / List]

**Expected outcome:**
- Changes from `[sha]` will be undone
- New commit will be created: "Revert [message]"
- History preserved (original commit visible)

**Approve revert?** (yes / modify / abort)
```

**⛔ GATE: User must approve plan.**

---

## Phase 3: Revert (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `revert/apply-revert`, `revert/resolve-conflicts`

### Step 3.1: Apply Revert

**If dry-run mode:**

```bash
git revert --no-commit [sha]
git diff --staged
git reset HEAD  # Undo the staged revert
```

```markdown
## Dry Run Results

**Would revert:**
- Commit: `[sha]`
- Files changed: N

**Changes preview:**
[diff output]

**No changes made.** Run without `--dry-run` to apply.
```

**Otherwise:**

```bash
# For single commit
git revert [sha] --no-commit

# For multiple commits (reverse order)
git revert [sha1] [sha2] [sha3] --no-commit

# For range
git revert [older]..[newer] --no-commit
```

### Step 3.2: Handle Conflicts

**If conflicts occur:**

```markdown
> **ACTION REQUIRED:**
> Merge conflicts detected in:
>
> | File | Conflict Type |
> |------|---------------|
> | `src/feature.ts` | Content conflict |
>
> **Options:**
> 1. Let me resolve the conflicts
> 2. Show conflict details
> 3. Abort revert
>
> **How to proceed?**
```

**⏸️ Wait for decision.**

**If resolving:**

```bash
# Show conflict markers
git diff --name-only --diff-filter=U
```

**For each conflicted file:**

```markdown
## Conflict in `src/feature.ts`

**Conflict:**
```diff
<<<<<<< HEAD
// Current code (will be kept if we choose "ours")
const newFeature = true;
=======
// Original code (will be restored if we choose "theirs")
>>>>>>> parent of abc123
```

**Resolution options:**
1. Keep current (abort this file's revert)
2. Restore original (apply revert)
3. Manual merge (edit file)

**Choose resolution:**
```

**After resolution:**

```bash
git add [resolved-files]
```

### Step 3.3: Review Staged Revert

```markdown
## Staged Revert

**Files to be reverted:**
| File | Status |
|------|--------|
| `src/feature.ts` | Reverted |
| `tests/feature.spec.ts` | Reverted |

**Conflicts resolved:** [Yes/No/N/A]

Ready to validate?
```

---

## Phase 4: Validate (Tester)

**Chatmode:** 🧪 Tester
**Tasks:** `verify/run-typecheck`, `verify/run-lint`, `test/run-tests`

### Step 4.1: Run Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests (scoped to affected areas)
npm run test -- [affected-patterns]
```

### Step 4.2: Validation Report

```markdown
## Validation After Revert

| Check | Status | Details |
|-------|--------|---------|
| Type check | ✓ Pass / ✗ Fail | [details] |
| Lint | ✓ Pass / ✗ Fail | [details] |
| Tests | ✓ Pass / ✗ Fail | X passed, Y failed |

**Validation passed?** [Yes/No]
```

**If failures:**

```markdown
> **WARNING:**
> Validation failed after revert.
>
> **Issues:**
> - [list issues]
>
> **This likely means:**
> - Later code depends on the reverted changes
> - Additional fixes needed after revert
>
> **Options:**
> 1. Fix issues and continue with revert
> 2. Abort revert (reset staged changes)
> 3. Create todo for fixes and proceed
>
> **How to proceed?**
```

**⏸️ Wait for decision.**

---

## Phase 5: Commit (Committer)

**Chatmode:** 💾 Committer
**Tasks:** `commit/finalize-revert`

### Step 5.1: Prepare Commit Message

```markdown
## Revert Commit

**Default message:**
```
Revert "[original commit message]"

This reverts commit [sha].

[Reason if provided]
```

**Customize message?** (yes / use default)
```

### Step 5.2: Confirm Commit

```markdown
## Ready to Commit Revert

**Reverting:** `[sha]` - "[message]"
**Files changed:** N
**Reason:** [reason if provided]

**Commit message:**
```
Revert "feat: add feature"

This reverts commit abc123.

Reason: Feature caused production issues.
```

**Create revert commit?** (yes / edit message / abort)
```

**⛔ GATE: Never commit without explicit "yes".**

```bash
git commit -m "Revert \"[original message]\"

This reverts commit [sha].

[Reason]"
```

### Step 5.3: Completion

```markdown
## Revert Complete

| Item | Value |
|------|-------|
| Reverted commit | `[sha]` |
| Revert commit | `[new-sha]` |
| Files changed | N |

**Next steps:**
- Push to remote: `git push origin [branch]`
- Create PR if needed: `/pr`
- Deploy if urgent

**Note:** Original commit `[sha]` remains in history.
To undo this revert: `git revert [new-sha]`
```

---

## Special Cases

### Revert a Merge Commit

```bash
# Revert merge commit (specify parent)
git revert -m 1 [merge-sha]  # Keep main branch changes
git revert -m 2 [merge-sha]  # Keep feature branch changes
```

```markdown
> **ACTION REQUIRED:**
> This is a merge commit. Which parent should be the mainline?
>
> - `1` - Keep changes from main branch (revert feature)
> - `2` - Keep changes from feature branch (revert main)
>
> **Usually you want option 1 to revert a merged feature.**
```

### Revert PR Commits

```bash
# Get PR commits
gh pr view [number] --json commits -q '.commits[].oid'

# Revert in reverse chronological order
git revert [newest-sha] [older-sha] [oldest-sha] --no-commit
```

### Partial Revert (Specific Files)

```bash
# Revert specific files from a commit
git checkout [sha]^ -- path/to/file.ts
git add path/to/file.ts
```

---

## Quick Reference

| Phase | Chatmode | Tasks | Gate |
|-------|----------|-------|------|
| Identify | 🔍 Explorer | parse-target, show-commits | User confirms target |
| Assess | 📋 Planner | check-dependencies, assess-impact | **User approves** |
| Revert | 👨‍💻 Developer | apply-revert, resolve-conflicts | Conflicts resolved |
| Validate | 🧪 Tester | typecheck, lint, test | **All pass** |
| Commit | 💾 Committer | finalize-revert | **User confirms** |

---

## Rules

### Prohibited
- ❌ Force pushing after revert without approval
- ❌ Reverting without user confirmation
- ❌ Leaving unresolved conflicts
- ❌ Using `git reset --hard` (use `git revert` instead)
- ❌ Reverting shared history without team coordination

### Required
- ✓ Show what will be reverted before applying
- ✓ User confirmation of target
- ✓ User approval of plan
- ✓ Validation after revert
- ✓ User confirmation before commit

### Recommended
- 💡 Document reason for revert
- 💡 Create follow-up todo if revert is temporary
- 💡 Notify team of significant reverts
- 💡 Consider PR for reverts on shared branches

---

## Recovery Options

### Undo a Revert

```bash
# Revert the revert (restores original changes)
git revert [revert-commit-sha]
```

### Abort In-Progress Revert

```bash
# If revert not committed yet
git reset --hard HEAD
```

### View Reverted Content

```bash
# The original commit is still in history
git show [original-sha]

# Cherry-pick to restore specific commits
git cherry-pick [original-sha]
```

---

**See Also:**
- [Workflow: Hotfix](./hotfix.prompt.md) - For emergency fixes
- [Workflow: Debug](./debug.prompt.md) - For investigating issues
- [Workflow: Commit](./commit.prompt.md)
