---
workflow: deps
priority: medium
---

# Workflow: Dependencies

> **Purpose:** Audit, update, and manage project dependencies safely
> **Phases:** Audit → Plan → Update → Validate
> **Command:** `/deps [action] [scope flags]`
> **Scope:** See [scope.md](../scope.md)

## Actions

| Action | Description |
|--------|-------------|
| `audit` | Check for vulnerabilities and outdated packages |
| `update` | Update dependencies (default: patch/minor only) |
| `update --major` | Include major version updates |
| `update --security` | Security patches only |
| `check` | Quick outdated check without updates |

## Scope Flags

| Flag | Description |
|------|-------------|
| `--package=<name>` | Specific package(s) to update |
| `--dev` | Include devDependencies |
| `--prod` | Production dependencies only |
| `--dry-run` | Preview changes without applying |

**Examples:**
```bash
/deps audit                        # Full security audit
/deps update                       # Safe updates (patch/minor)
/deps update --major               # Include breaking updates
/deps update --security            # Security patches only
/deps update --package=lodash      # Update specific package
/deps check                        # Quick outdated check
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ AUDIT PHASE (Explorer)                                          │
├─────────────────────────────────────────────────────────────────┤
│ deps/check-outdated → deps/security-audit → deps/analyze-risk   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms update scope
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PLAN PHASE (Planner)                                            │
├─────────────────────────────────────────────────────────────────┤
│ deps/categorize-updates → deps/create-update-plan               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves update plan
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ UPDATE PHASE (Developer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ deps/apply-updates (batched) → verify/run-typecheck             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATE PHASE (Tester)                                         │
├─────────────────────────────────────────────────────────────────┤
│ verify/run-typecheck → verify/run-lint → test/run-tests         │
│                      → verify/run-build                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: All validations pass
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ COMMIT PHASE (Committer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ commit/create-commit                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Audit (Explorer)

**Chatmode:** 🔍 Explorer
**Tasks:** `deps/check-outdated`, `deps/security-audit`, `deps/analyze-risk`

### Step 1.1: Check Current State

```bash
# Get package manager
if [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
elif [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
else
  PKG_MGR="npm"
fi

# Check outdated packages
$PKG_MGR outdated 2>/dev/null || true
```

### Step 1.2: Security Audit

```bash
# Run security audit
npm audit 2>/dev/null || true

# Or for other package managers
# pnpm audit
# yarn audit
```

### Step 1.3: Present Audit Results

```markdown
## Dependency Audit

### Security Vulnerabilities

| Severity | Count | Packages |
|----------|-------|----------|
| Critical | N | package1, package2 |
| High | N | package3 |
| Moderate | N | package4, package5 |
| Low | N | package6 |

### Outdated Packages

| Package | Current | Wanted | Latest | Type |
|---------|---------|--------|--------|------|
| lodash | 4.17.20 | 4.17.21 | 4.17.21 | patch |
| react | 18.2.0 | 18.2.0 | 18.3.0 | minor |
| typescript | 4.9.5 | 4.9.5 | 5.3.0 | **major** |

### Summary
- **X** packages with security issues
- **Y** packages outdated (Z major, W minor, V patch)
```

### Step 1.4: Confirm Scope

```markdown
> **ACTION REQUIRED:**
> What would you like to update?
>
> - `security` - Security patches only (X packages)
> - `safe` - Patch + minor updates (Y packages)
> - `all` - Include major updates (Z packages)
> - `select` - Choose specific packages
> - `skip` - No updates, just audit
```

**⛔ GATE: User must confirm update scope.**

---

## Phase 2: Plan (Planner)

**Chatmode:** 📋 Planner
**Tasks:** `deps/categorize-updates`, `deps/create-update-plan`

### Step 2.1: Categorize Updates

**Group by risk level:**

```markdown
## Update Plan

### Batch 1: Security Patches (Low Risk)
| Package | From | To | Risk |
|---------|------|----|----- |
| package1 | 1.0.0 | 1.0.1 | Low - security fix |

### Batch 2: Patch Updates (Low Risk)
| Package | From | To | Risk |
|---------|------|----|----- |
| package2 | 2.1.0 | 2.1.5 | Low - bug fixes |

### Batch 3: Minor Updates (Medium Risk)
| Package | From | To | Risk |
|---------|------|----|------|
| package3 | 3.0.0 | 3.2.0 | Medium - new features |

### Batch 4: Major Updates (High Risk)
| Package | From | To | Risk | Breaking Changes |
|---------|------|----|----- |------------------|
| typescript | 4.9.5 | 5.3.0 | High | Yes - see notes |

**Breaking Change Notes:**
- **typescript 5.x**: New strict checks, decorator changes
```

### Step 2.2: Risk Assessment

```markdown
## Risk Assessment

| Risk Level | Packages | Recommendation |
|------------|----------|----------------|
| Low | X | Update together |
| Medium | Y | Update and test carefully |
| High | Z | Update one at a time |

**Estimated impact:**
- Type changes: [likely/unlikely]
- API changes: [likely/unlikely]
- Test failures: [likely/unlikely]
```

### Step 2.3: Approve Plan

```markdown
## Update Strategy

**Proposed approach:**
1. Apply Batch 1 (security) → validate
2. Apply Batch 2 (patches) → validate
3. Apply Batch 3 (minor) → validate
4. [If approved] Apply Batch 4 (major) → validate thoroughly

**Approve this plan?** (yes / modify / skip batch N)
```

**⛔ GATE: User must approve update plan.**

---

## Phase 3: Update (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `deps/apply-updates`

### Step 3.1: Apply Updates in Batches

**For each approved batch:**

```markdown
## Applying Batch N: [Description]

**Packages:**
- package1: X.Y.Z → X.Y.W
- package2: A.B.C → A.B.D
```

```bash
# Install updates
npm install package1@X.Y.W package2@A.B.D

# Or for specific package manager
# pnpm update package1 package2
# yarn upgrade package1 package2
```

### Step 3.2: Quick Validation After Each Batch

```bash
# Type check after each batch
npm run typecheck
```

**If type errors occur:**

```markdown
> **WARNING:**
> Type errors after updating Batch N:
>
> ```
> [error output]
> ```
>
> **Options:**
> 1. Fix type errors and continue
> 2. Revert batch and skip these packages
> 3. Pin to previous version
>
> **How to proceed?**
```

**⏸️ Wait for decision.**

### Step 3.3: Progress Report

```markdown
## Update Progress

| Batch | Status | Notes |
|-------|--------|-------|
| 1. Security | ✓ Complete | |
| 2. Patches | ✓ Complete | |
| 3. Minor | ✓ Complete | |
| 4. Major | ⏳ In progress | Type fixes needed |
```

---

## Phase 4: Validate (Tester)

**Chatmode:** 🧪 Tester
**Tasks:** `verify/run-typecheck`, `verify/run-lint`, `test/run-tests`, `verify/run-build`

### Step 4.1: Full Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Full test suite (dependency changes need full coverage)
npm run test

# Build
npm run build
```

### Step 4.2: Validation Report

```markdown
## Validation Results

| Check | Status | Details |
|-------|--------|---------|
| Type check | ✓ Pass / ✗ Fail | [details] |
| Lint | ✓ Pass / ✗ Fail | [details] |
| Tests | ✓ Pass / ✗ Fail | X passed, Y failed |
| Build | ✓ Pass / ✗ Fail | [details] |

**All validations passed?** [Yes/No]
```

**If failures:**

```markdown
> **ACTION REQUIRED:**
> Validation failed after dependency updates.
>
> **Failed checks:**
> - [list failures]
>
> **Options:**
> 1. Fix issues and re-validate
> 2. Revert problematic packages
> 3. Create todo for manual resolution
>
> **How to proceed?**
```

**⛔ GATE: All validations must pass before commit.**

---

## Phase 5: Commit (Committer)

**Chatmode:** 💾 Committer
**Tasks:** `commit/create-commit`

### Step 5.1: Review Changes

```markdown
## Dependency Update Summary

**Files changed:**
- `package.json`
- `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`

**Packages updated:**
| Package | From | To | Type |
|---------|------|----|----- |
| [list all updated packages] |

**Security fixes:** X vulnerabilities resolved
```

### Step 5.2: Create Commit

```markdown
## Commit

**Message:**
```
chore(deps): update dependencies

Security:
- Fix X vulnerabilities

Updates:
- package1: 1.0.0 → 1.0.1
- package2: 2.0.0 → 2.1.0
```

**Create commit?** (yes / edit message / abort)
```

**⛔ GATE: User confirmation required.**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): update dependencies

Security:
- Fix X vulnerabilities

Updates:
- package1: 1.0.0 → 1.0.1
- package2: 2.0.0 → 2.1.0"
```

---

## Audit-Only Mode

When using `/deps audit`:

```markdown
## Dependency Audit Report

### Security Summary
| Severity | Count | Action Needed |
|----------|-------|---------------|
| Critical | 0 | ✓ None |
| High | 2 | Update recommended |
| Moderate | 5 | Review when convenient |
| Low | 3 | Optional |

### Outdated Summary
| Type | Count |
|------|-------|
| Major | 3 |
| Minor | 8 |
| Patch | 12 |

### Recommendations
1. **Immediate:** Update packages with high/critical vulnerabilities
2. **Soon:** Apply patch and minor updates
3. **Plan:** Review major updates for breaking changes

**Run `/deps update` to apply updates.**
```

---

## Quick Reference

| Phase | Chatmode | Tasks | Gate |
|-------|----------|-------|------|
| Audit | 🔍 Explorer | check-outdated, security-audit | User confirms scope |
| Plan | 📋 Planner | categorize, create-plan | **User approves** |
| Update | 👨‍💻 Developer | apply-updates | Type check passes |
| Validate | 🧪 Tester | typecheck, lint, test, build | **All pass** |
| Commit | 💾 Committer | create-commit | User confirms |

---

## Rules

### Prohibited
- ❌ Updating without user approval
- ❌ Skipping validation after updates
- ❌ Committing with failing tests
- ❌ Major updates without explicit approval
- ❌ Ignoring security vulnerabilities without acknowledgment

### Required
- ✓ Security audit before updates
- ✓ Batch updates by risk level
- ✓ Type check after each batch
- ✓ Full validation before commit
- ✓ User approval for update plan

### Recommended
- 💡 Update security patches immediately
- 💡 Regular dependency audits (weekly/monthly)
- 💡 Document breaking changes from major updates
- 💡 Create todos for deferred major updates
- 💡 Lock file always committed with package.json

---

## Handling Common Issues

### Type Errors After Update

```bash
# Check what changed in the package
npm info package-name changelog

# Or check the repo
gh repo view package-name/package-name --web
```

### Peer Dependency Conflicts

```markdown
> **WARNING:**
> Peer dependency conflict detected:
>
> ```
> [conflict details]
> ```
>
> **Options:**
> 1. Use `--legacy-peer-deps` (npm)
> 2. Update conflicting packages together
> 3. Skip this update
```

### Lock File Conflicts

```bash
# Regenerate lock file
rm package-lock.json && npm install

# Or for other managers
# rm pnpm-lock.yaml && pnpm install
# rm yarn.lock && yarn install
```

---

**See Also:**
- [Workflow: Validate](./validate.prompt.md)
- [Workflow: Commit](./commit.prompt.md)
