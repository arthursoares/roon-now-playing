---
workflow: debug
priority: high
---

# Workflow: Debug

> **Purpose:** Systematic bug investigation and fixing
> **Phases:** Understand → Investigate → Fix → Verify
> **Command:** `/debug [scope flags] <bug description>`
> **Scope:** See [scope.md](../scope.md)

## Gate Enforcement

**CRITICAL:** This workflow requires confirmation before applying fixes.

**Valid approval responses:**
- `yes`, `y`, `approved`, `proceed`, `lgtm`, `looks good`, `go ahead`

**Invalid (do NOT treat as approval):**
- Silence or no response
- Questions or clarifications
- Partial acknowledgment ("I see", "okay", "hmm")

**Key gates:**
1. Confirm root cause understanding before proposing fix
2. Approve fix plan before implementation
3. Confirm before committing

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Limit investigation to specific files |
| `--branch=<name>` | Compare against specific branch |

**Examples:**
```bash
/debug --files=src/api/client.ts network timeout errors
/debug --files=src/auth/ login fails with special characters
/debug users can't save their profile
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ UNDERSTAND PHASE (Debugger)                                      │
├─────────────────────────────────────────────────────────────────┤
│ plan/clarify-requirements (gather symptoms)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms symptoms
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ INVESTIGATE PHASE (Debugger)                                     │
├─────────────────────────────────────────────────────────────────┤
│ explore/analyze-code → form hypothesis → verify                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms root cause
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FIX PHASE (Developer)                                            │
├─────────────────────────────────────────────────────────────────┤
│ plan/create-plan (fix) → implement/edit-file → test/write-tests  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves fix
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VERIFY PHASE (Tester + Committer)                                │
├─────────────────────────────────────────────────────────────────┤
│ test/run-tests → verify/run-checks → commit/create-commit        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Understand (Debugger)

**Chatmode:** 🐛 Debugger
**Tasks:** `plan/clarify-requirements`

### Step 1.0: Parse Scope

```bash
# Get current context
git branch --show-current
git status --porcelain
```

**Display scope context:**

```markdown
## Debug Scope

| Scope | Value |
|-------|-------|
| Files | [from --files or "to be determined"] |
| Branch | [current branch] |

**Bug Description:** [from user input]
```

### Step 1.1: Gather Symptoms

```markdown
## Bug Investigation

To diagnose this issue:

1. **What's happening?**
   - Expected: [what should happen]
   - Actual: [what does happen]

2. **When does it occur?**
   - Always / Sometimes / Specific conditions

3. **Reproduction steps?**
   1. [Step 1]
   2. [Step 2]

4. **Recent changes?**
   - New code / dependencies / config
```

**⏸️ Wait for response.**

### Step 1.2: Technical Context

```markdown
## Technical Details

- **Error message:** [exact error]
- **Environment:** [dev/staging/prod]
- **Stack trace:** [if available]
- **Relevant logs:** [any output]
```

**⏸️ Wait for details.**

### Step 1.3: Confirm Understanding

```markdown
## Summary

**Issue:** [restate problem]
**Conditions:** [when it happens]
**Impact:** [who/what affected]

Is this correct?
```

**⛔ GATE: Wait for confirmation.**

---

## Phase 2: Investigate (Debugger)

**Chatmode:** 🐛 Debugger
**Tasks:** `explore/analyze-code`

### Step 2.1: Form Hypothesis

```markdown
## Hypothesis

Possible causes:

1. **[Hypothesis A]**
   - Why: [reasoning]
   - Check: [how to verify]

2. **[Hypothesis B]**
   - Why: [reasoning]
   - Check: [how to verify]

Investigating Hypothesis A...
```

### Step 2.2: Trace the Bug

```bash
# Search for related code
grep -rn "functionName" src/

# Recent changes
git log --oneline -10 path/to/file.ts

# Who changed what
git blame path/to/file.ts | head -50
```

### Step 2.3: Confirm Root Cause

```markdown
## Root Cause Found

**Location:** `path/to/file.ts:42`

**Problem:** [what's wrong]

**Why:** [explanation]

**Evidence:**
- [Finding 1]
- [Finding 2]

Does this make sense?
```

**⛔ GATE: Wait for confirmation.**

---

## Phase 3: Fix (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `plan/create-plan`, `implement/edit-file`, `test/write-tests`

### Step 3.1: Propose Fix

```markdown
## Fix Plan

### Root Cause
[Brief summary]

### Solution
[What will change]

### Files
- `path/to/file.ts` - [fix]

### Regression Test
- Test for [scenario]

### Risks
- [Any concerns]

---
**Approve fix?**

Reply with:
- `yes` or `approved` - Proceed with fix
- `no` - Cancel and investigate further
- `modify: [changes]` - Request changes to the approach
```

**⛔ GATE: STOP HERE. Do NOT implement the fix until user responds with `yes` or `approved`.**

**Waiting for explicit approval before modifying code.**

### Step 3.2: Implement Fix

1. Apply fix with `implement/edit-file`
2. Run type check to verify fix compiles

```markdown
## Fix Applied

**Changed:**
- `path/to/file.ts:42` - [fix description]

Type check: ✓ Pass
```

### Step 3.3: Add Regression Test

> **REQUIRED:** Every bug fix must include a regression test.

1. Add regression test with `test/write-tests`
2. Test should reproduce the bug scenario
3. Assert correct behavior after fix

```markdown
## Regression Test Added

**Test file:** `path/to/file.spec.ts`
**Test case:** [describes the bug scenario]

\`\`\`typescript
it('should [correct behavior] when [bug trigger condition]', () => {
  // Arrange: Set up the conditions that triggered the bug
  // Act: Perform the action that previously failed
  // Assert: Verify the correct behavior
});
\`\`\`

Ready to verify?
```

---

## Phase 4: Verify (Tester + Committer)

**Chatmode:** 🧪 Tester → 💾 Committer
**Tasks:** `test/run-tests`, `verify/run-checks`, `commit/create-commit`

### Step 4.1: Run All Tests

```bash
# Run the regression test first
npm run test -- path/to/file.spec.ts

# Run all related/affected tests
npm run test -- [affected-pattern]

# Type check and lint
npm run typecheck
npm run lint
```

### Step 4.2: Verification Report

```markdown
## Verification

| Check | Status |
|-------|--------|
| Regression test | ✓ Pass |
| Related tests | ✓ Pass ({N} tests) |
| Type check | ✓ Pass |
| Lint | ✓ Pass |

Can you verify the fix works?
```

**⛔ GATE: All tests (especially regression test) must pass before proceeding.**

If tests fail:
```markdown
> **Tests Failing:**
> [List of failing tests]
>
> **Options:**
> 1. Fix the implementation
> 2. Fix the test expectations
> 3. Investigate further - the root cause may be different
>
> **How to proceed?**
```

**⏸️ Wait for user verification.**

### Step 4.3: Commit

```markdown
## Ready to Commit

**Files changed:**
- `path/to/file.ts` - [fix]
- `path/to/file.spec.ts` - [regression test]

**Message:**
```
fix: prevent null pointer in user lookup

Adds null check before accessing user properties.
Includes regression test to prevent recurrence.

Fixes #123
```

**Commit?** (yes / no / edit)
```

**⛔ GATE: Wait for "yes".**

---

## Quick Reference

| Phase | Chatmode | Tasks | Gate |
|-------|----------|-------|------|
| Understand | 🐛 Debugger | clarify-requirements | User confirms |
| Investigate | 🐛 Debugger | analyze-code | **User confirms cause** |
| Fix | 👨‍💻 Developer | create-plan, edit-file, write-regression-test | **User approves** |
| Verify | 🧪 Tester | run-tests (regression + related) | **All tests pass** |
| Commit | 💾 Committer | create-commit | **User confirms** |

---

## Debugging Tips

| Pattern | Check For |
|---------|-----------|
| Null/undefined | Missing null checks |
| Race condition | Async timing issues |
| State mutation | Unintended side effects |
| Type mismatch | Incorrect type assertions |

---

**See Also:**
- [Tasks: explore/](../tasks/explore/)
- [Tasks: test/](../tasks/test/)
- [Chatmode: Debugger](../chatmodes/debugger.chatmode.md)
