---
workflow: implement
priority: high
---

# Workflow: Implement

> **Purpose:** Full feature implementation workflow
> **Phases:** Explore → Plan → Code → Cover → Commit
> **Command:** `/implement [scope flags] <task description>`
> **Scope:** See [scope.md](../scope.md)

## Gate Enforcement

**CRITICAL:** This workflow has mandatory approval gates. You MUST NOT proceed past a gate without receiving an explicit approval response.

**Valid approval responses:**
- `yes`, `y`, `approved`, `proceed`, `lgtm`, `looks good`, `go ahead`

**Invalid (do NOT treat as approval):**
- Silence or no response
- Questions or clarifications
- Partial acknowledgment ("I see", "okay", "hmm")
- Requests for more information

**When in doubt:** Ask explicitly: "I need your approval to continue. Please respond with 'yes' to proceed."

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Specific files/directories to work on |
| `--uncommitted` | Build on current uncommitted changes |
| `--branch=<name>` | Branch context (default: current) |
| `--project=<path>` | Project root for monorepos |

**Examples:**
```bash
/implement --files=src/auth/ add password validation
/implement --uncommitted finish the login feature
/implement --project=packages/api add rate limiting
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ EXPLORE PHASE (Explorer)                                         │
├─────────────────────────────────────────────────────────────────┤
│ explore/gather-context → plan/clarify-requirements               │
│                     ↓                                            │
│ explore/analyze-code → plan/surface-risks                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms understanding
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PLAN PHASE (Planner)                                             │
├─────────────────────────────────────────────────────────────────┤
│ plan/create-plan                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves plan
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CODE PHASE (Developer)                                           │
├─────────────────────────────────────────────────────────────────┤
│ implement/edit-file (repeat) → verify/run-typecheck              │
│                              → verify/run-lint                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms implementation
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ COVER PHASE (Tester)                                             │
├─────────────────────────────────────────────────────────────────┤
│ test/write-tests → test/write-stories → test/run-tests (scoped)  │
│                 (unit tests, component tests, stories, etc.)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: All tests pass
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DOCS PHASE (Developer) - OPTIONAL                                │
├─────────────────────────────────────────────────────────────────┤
│ docs/update-docs                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⏸️ OPTIONAL: User chooses to document
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ COMMIT PHASE (Committer)                                         │
├─────────────────────────────────────────────────────────────────┤
│ commit/show-status → commit/stage-changes → commit/create-commit │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Explore (Explorer)

**Chatmode:** 🔍 Explorer
**Tasks:** `explore/gather-context`, `plan/clarify-requirements`

### Step 1.0: Parse Scope

Extract scope from command input:

```bash
# Get current context
git branch --show-current
git status --porcelain
MAIN=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
```

**Display scope context:**

```markdown
## Scope Context

| Scope | Value |
|-------|-------|
| Files | [from --files or inferred] |
| Uncommitted | [yes/no - list if yes] |
| Branch | [current branch name] |
| Project | [from --project or root] |

**Task:** [natural language from user input]
```

**If scope is ambiguous, ask:**

```markdown
> **ACTION REQUIRED:**
> Please clarify the scope for this task:
> - Which files/directories should I focus on?
> - Should I build on uncommitted changes?
```

**⏸️ Wait if clarification needed.**

### Step 1.1: Understand Request

Use `plan/clarify-requirements`:

```markdown
## Understanding the Task

Before exploring the code:

1. **What's the goal?** [What should this accomplish?]
2. **Who is affected?** [Users, components, systems?]
3. **Constraints?** [Performance, compatibility, patterns?]
4. **Success criteria?** [How do we know it works?]
```

**⏸️ Wait for user response.**

### Step 1.2: Explore Code

Use `explore/gather-context` and `explore/analyze-code`:

```markdown
## Codebase Analysis

**Relevant Files:**
- `path/to/file.ts` - [purpose]

**Current Behavior:**
[How it works now]

**Patterns Found:**
[Conventions to follow]
```

### Step 1.3: Verify Understanding

```markdown
## Verification

1. **My understanding:** [Restate the task]
2. **Assumption:** [Something you're assuming]
3. **Unclear area:** [What needs clarification]

Is this correct?
```

**⏸️ Wait for confirmation.**

### Step 1.4: Surface Edge Cases (Scoped)

Use `plan/surface-risks`:

```markdown
## Edge Cases

| Case | Question |
|------|----------|
| Empty input | What happens? |
| Error state | How to handle? |
| Boundaries | What are the limits? |

Which matter? How to handle?
```

**⏸️ Wait for guidance.**

---

### Scope Handoff → Plan Phase

```markdown
---
**Scope carried forward:**
- Files: [confirmed scope]
- Branch: [branch name]
- Task: [refined task description]
---
```

---

## Phase 2: Plan (Planner)

**Chatmode:** 📋 Planner
**Tasks:** `plan/create-plan`

### Step 2.1: Create Plan (Within Scope)

```markdown
## Implementation Plan

### Scope
| Scope | Value |
|-------|-------|
| Files | [inherited from explore] |
| Branch | [branch name] |
| Task | [task description] |

### Summary
[1-2 sentences]

### Files to Modify (within scope)
- `path/to/file.ts` - [change]

### Steps
1. [Specific action]
2. [Specific action]

### Edge Cases
- [Case] - [handling]

### Test Strategy
- [How to verify - scoped tests only]

---
**Approve this plan?**

Reply with:
- `yes` or `approved` - Proceed with implementation
- `no` - Cancel and discuss alternatives
- `modify: [your changes]` - Request specific changes
```

**⛔ GATE: STOP HERE. Do NOT proceed to Code Phase until user responds with explicit approval.**

**Waiting for:** `yes`, `approved`, `proceed`, `lgtm`, or `go ahead`

---

### Scope Handoff → Code Phase

```markdown
---
**Scope carried forward:**
- Files: [files from approved plan]
- Branch: [branch name]
- Task: [task description]
- Plan: [approved]
---
```

---

## Phase 3: Code (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `implement/edit-file`, `verify/run-typecheck`, `verify/run-lint`

### Step 3.1: Implement

For each file in plan:
1. Use `implement/edit-file`
2. Use `verify/run-typecheck` after changes
3. Report progress

```markdown
## Progress

**Completed:**
- [x] `file1.ts` - [change made]

**Next:**
- [ ] `file2.ts` - [planned change]

Any concerns?
```

### Step 3.2: Handle Surprises

If unexpected issues arise:

```markdown
## Found Something Unexpected

**Issue:** [what was found]
**Impact:** [how it affects plan]

**Options:**
1. [Option A]
2. [Option B]

Which approach?
```

**⏸️ Wait for decision.**

### Step 3.3: Validate Code (Pre-Tests)

Run type check and lint before writing tests:

```bash
# Type check (full - fast)
npm run typecheck

# Lint (full - fast)
npm run lint
```

```markdown
## Code Validation

| Check | Scope | Status |
|-------|-------|--------|
| Type check | Full | ✓ Pass |
| Lint | Full | ✓ Pass |

Ready to add test coverage?
```

---

### Scope Handoff → Cover Phase

```markdown
---
**Scope carried forward:**
- Files changed: [list of modified files]
- Branch: [branch name]
- Task: [task description]
- Code validation: [passed]
---
```

---

## Phase 4: Cover (Tester)

**Chatmode:** 🧪 Tester
**Tasks:** `test/write-tests`, `test/write-stories`, `test/run-tests`

> **Purpose:** Ensure new code has appropriate test coverage before committing.

### TDD Preference

**When possible, prefer Test-Driven Development (TDD):**

If the project has testing infrastructure in place and the feature scope is clear:
1. Write tests first (during Plan phase, before Code phase)
2. Run tests to see them fail
3. Implement code to make tests pass
4. Refactor while keeping tests green

**Enabling TDD:**

If TDD is desired but infrastructure is missing, identify blockers:

```markdown
## TDD Readiness Check

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Test runner configured | ✓/✗ | [action if missing] |
| Test utilities available | ✓/✗ | [e.g., add testing-library] |
| Mocking setup | ✓/✗ | [e.g., configure jest mocks] |
| Component test support | ✓/✗ | [e.g., add jsdom environment] |
| Storybook configured | ✓/✗ | [e.g., initialize Storybook] |

**Missing infrastructure:**
- [List what needs to be set up]

**Want to set up TDD infrastructure first?** (yes / skip for now)
```

> **Note:** If TDD infrastructure setup is non-trivial, create a separate task or todo for it.

### Step 4.1: Analyze Coverage Needs

Categorize changed files by verification type needed:

```markdown
## Coverage Analysis

**Files requiring verification:**

| File | Type | Verification Method |
|------|------|---------------------|
| `src/utils/helper.ts` | Utility | Unit tests (`.spec.ts`) |
| `src/components/Button.tsx` | Component | Component tests + Storybook story |
| `src/services/api.ts` | Service | Unit tests with mocks |
| `src/types/user.ts` | Types | No tests needed |

**Test files to create/update:**
- [ ] `src/utils/helper.spec.ts` - [scenarios to test]
- [ ] `src/components/Button.spec.tsx` - [component behavior]
- [ ] `src/components/Button.stories.tsx` - [visual states]
```

### Step 4.2: Write Tests

For each file requiring tests, create appropriate verification:

**Unit Tests (utilities, services):**
```typescript
/**
 * Test Plan:
 * - [Scenario 1]: [Expected behavior]
 * - [Scenario 2]: [Expected behavior]
 * - Edge case: [What happens when...]
 */

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Component Tests:**
- Test user interactions
- Test different states (loading, error, empty, populated)
- Test accessibility where relevant

**Storybook Stories (UI components):**
- Create stories for each visual state
- Include edge cases (long text, empty states)
- Follow project story conventions

### Step 4.3: Run All Tests in Scope

```bash
# Run tests for changed and new test files
npm run test -- [changed-files-pattern]

# Run specific test file
npm run test -- path/to/file.spec.ts

# Run Storybook build check (if stories added)
npm run storybook:build --dry-run 2>/dev/null || true
```

### Step 4.4: Verification Report

```markdown
## Test Coverage Report

**Tests Written:**
| File | Tests | Status |
|------|-------|--------|
| `helper.spec.ts` | 5 tests | ✓ All passing |
| `Button.spec.tsx` | 3 tests | ✓ All passing |
| `Button.stories.tsx` | 4 stories | ✓ Created |

**Tests Run (Scoped):**
| Check | Scope | Status |
|-------|-------|--------|
| Unit tests | Changed files | ✓ Pass (X tests) |
| Component tests | Changed components | ✓ Pass (Y tests) |
| Type check | Full | ✓ Pass |
| Lint | Full | ✓ Pass |

**Coverage Notes:**
- [Any edge cases not covered and why]
- [Any tests skipped with justification]
```

**⛔ GATE: All tests must pass before proceeding.**

If tests fail:
```markdown
> **Tests Failing:**
> [List of failing tests with reasons]
>
> **Options:**
> 1. Fix the implementation
> 2. Fix the test expectations
> 3. Skip specific test with justification (requires approval)
>
> **How to proceed?**
```

---

### Scope Handoff → Docs Phase

```markdown
---
**Scope carried forward:**
- Files changed: [implementation files]
- Tests added: [test files]
- Branch: [branch name]
- Task: [task description]
- All tests: [passing]
---
```

---

## Phase 5: Docs (Developer) - Optional

**Chatmode:** 👨‍💻 Developer
**Tasks:** `docs/update-docs`

Before committing, prompt for documentation:

```markdown
## Documentation (Optional)

**What was implemented:** [brief summary]

**Consider documenting:**

| Type | When Relevant | Action |
|------|---------------|--------|
| AI context | New patterns, decisions, gotchas | Update `.ai-project/` |
| User docs | User-facing features, API changes | Add to `docs/` |
| README | Getting started, feature overview | Update `README.md` |

**What would you like to document?**
- `ai` - Update AI assistant context
- `user` - Add/update user documentation
- `readme` - Update README
- `all` - All of the above
- `skip` - No documentation needed
```

**⏸️ Wait for user response. If `skip`, proceed to commit.**

See [docs/update-docs.task.md](../tasks/docs/update-docs.task.md) for templates.

---

## Phase 6: Commit (Committer)

**Chatmode:** 💾 Committer
**Tasks:** `commit/show-status`, `commit/stage-changes`, `commit/create-commit`

### Step 5.1: Review Changes (Within Scope)

Show only files within the inherited scope:

```markdown
## Changes Summary (Scoped)

**Scope:** `[inherited scope]`
**Files changed:** 3

| File | Change |
|------|--------|
| `file1.ts` | Added feature |
| `file2.ts` | Updated handler |
| `file1.spec.ts` | Added tests |

**Note:** Only showing changes within scope. Use `git status` to see all changes.
```

### Step 5.2: Confirm Commit

```markdown
## Ready to Commit

**Scope:** [files to be committed]
**Branch:** [current branch]

**Message:**
```
feat: add user authentication

Implements login/logout with session management.
```

**Commit?**

Reply with:
- `yes` or `commit` - Create the commit
- `no` - Cancel commit
- `edit: [new message]` - Change commit message
```

**⛔ GATE: STOP HERE. Do NOT run `git commit` until user responds with `yes` or `commit`.**

**Waiting for explicit confirmation before committing.**

---

## Quick Reference

| Phase | Chatmode | Tasks | Gate |
|-------|----------|-------|------|
| Explore | 🔍 Explorer | gather-context, analyze-code | User confirms |
| Plan | 📋 Planner | create-plan | **User approves** |
| Code | 👨‍💻 Developer | edit-file, typecheck, lint | User confirms |
| Cover | 🧪 Tester | write-tests, write-stories, run-tests | **All tests pass** |
| Docs | 👨‍💻 Developer | update-docs | *Optional* |
| Commit | 💾 Committer | create-commit | **User confirms** |

---

**See Also:**
- [Tasks: explore/](../tasks/explore/)
- [Tasks: plan/](../tasks/plan/)
- [Tasks: implement/](../tasks/implement/)
- [Tasks: test/](../tasks/test/)
- [Tasks: commit/](../tasks/commit/)
- [Tasks: docs/](../tasks/docs/)
- [Workflow: Cover](./cover.prompt.md)
