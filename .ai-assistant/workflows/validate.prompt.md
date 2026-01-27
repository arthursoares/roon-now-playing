---
workflow: validate
priority: high
---

# Workflow: Validate

> **Purpose:** Run validation checks to ensure code quality, security, and correctness
> **Phases:** Quick (scoped) | Full (CI) | Fix (auto-correct)
> **Command:** `/validate [scope flags]`
> **Scope:** See [scope.md](../scope.md)

## Scope Flags

| Flag | Description |
|------|-------------|
| `--files=<paths>` | Validate specific files/directories |
| `--uncommitted` | Validate uncommitted changes (default) |
| `--staged` | Validate staged changes only |
| `--full` | Run complete CI pipeline |
| `--ci` | Mirror exact CI configuration |
| `--fix` | Auto-fix correctable issues |
| `--security` | Include security checks |
| `--coverage` | Include test coverage report |

**Examples:**
```bash
/validate                           # Quick validation of uncommitted changes
/validate --files=src/components/   # Specific directory
/validate --full                    # Complete CI pipeline
/validate --fix                     # Auto-fix lint/format issues
/validate --ci                      # Mirror exact CI checks
/validate --security                # Include npm audit
/validate --full --coverage         # Full validation with coverage
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ QUICK VALIDATION (Default)                                      │
├─────────────────────────────────────────────────────────────────┤
│ Level 1: verify/format → verify/typecheck → verify/lint         │
│                              ↓                                  │
│ Level 2: test/run-scoped-tests                                  │
│                              ↓                                  │
│ Level 3: (optional) verify/integration                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FULL VALIDATION (--full)                                        │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: verify/format-check                                     │
│ Step 2: verify/typecheck                                        │
│ Step 3: verify/lint                                             │
│ Step 4: verify/security-audit (if --security or configured)     │
│ Step 5: verify/accessibility (if configured)                    │
│ Step 6: verify/performance (if configured)                      │
│ Step 7: test/run-all-tests                                      │
│ Step 8: verify/coverage-report (if --coverage)                  │
│ Step 9: verify/build                                            │
│ Step 10: verify/bundle-size (if configured)                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FIX MODE (--fix)                                                │
├─────────────────────────────────────────────────────────────────┤
│ fix/format → fix/lint → verify/typecheck → test/run-scoped      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Validation (Default)

**Chatmode:** 🧪 Tester
**Purpose:** Fast feedback during development - validate only what changed

### Step 0: Determine Scope

```bash
# Get changed files
git diff --name-only HEAD
git diff --name-only --staged  # if --staged flag
```

```markdown
## Validation Scope

| Scope | Files |
|-------|-------|
| Changed | N files |
| Pattern | `src/components/Button/*` |

**Running quick validation...**
```

### Level 1: Syntax & Style

**Format Check:**
```bash
# Check formatting (don't fix in normal mode)
npm run format:check 2>/dev/null || npx prettier --check [changed-files]
```

**Type Check:**
```bash
npm run typecheck
```

**Lint:**
```bash
npm run lint -- [changed-files]
```

**Secrets Scan (always runs):**
```bash
# Scan changed files for potential secrets
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
  -E "(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[:=]" [changed-files]

# Check for base64-encoded secrets (common pattern)
grep -rn -E "['\"][A-Za-z0-9+/]{40,}={0,2}['\"]" [changed-files]

# Check for hardcoded URLs with credentials
grep -rn -E "https?://[^:]+:[^@]+@" [changed-files]
```

**Report:**
```markdown
### Level 1: Syntax & Style

| Check | Status | Details |
|-------|--------|---------|
| Format | ✓ Pass / ✗ Fail | [N files need formatting] |
| Types | ✓ Pass / ✗ Fail | [N errors] |
| Lint | ✓ Pass / ✗ Fail | [N errors, M warnings] |
| Secrets | ✓ Pass / ⚠️ Review | [N potential secrets found] |
```

**If failures, stop and report before Level 2.**

### Level 2: Scoped Tests

Run tests only for changed components/files.

**Smart test scoping:**
```bash
# Component changes → test that component
npm run test -- ComponentName

# Utility changes → test that utility
npm run test -- utils/formatDate

# Directory changes → test that directory
npm run test -- "src/components/"
```

**Report:**
```markdown
### Level 2: Scoped Tests

| Scope | Tests | Passed | Failed |
|-------|-------|--------|--------|
| `Button` | 12 | 12 | 0 |
| `utils/format` | 8 | 8 | 0 |

**Result:** ✓ All 20 tests passed
```

### Level 3: Integration (Optional)

For UI changes, manual verification may be needed.

```markdown
### Level 3: Integration

> **INFO:**
> UI changes detected. Consider manual verification:
>
> ```bash
> npm run dev
> ```
>
> Then test the affected feature in the browser.
```

---

## Full Validation (--full)

**Chatmode:** 🧪 Tester
**Purpose:** Complete CI pipeline verification before push/merge

### Step 1: Format Check

```bash
npm run format:check || npx prettier --check .
```

### Step 2: Type Check

```bash
npm run typecheck
```

### Step 3: Lint

```bash
npm run lint
```

### Step 4: Security Audit (if --security or configured)

```bash
# Check for known vulnerabilities
npm audit --audit-level=high

# Check for secrets (if git-secrets or similar installed)
# git secrets --scan

# Custom security script
npm run security 2>/dev/null || true
```

**Report:**
```markdown
### Security Audit

| Check | Status | Details |
|-------|--------|---------|
| npm audit | ✓ Pass / ⚠️ Warnings | [N vulnerabilities] |
| Secrets scan | ✓ Pass / ✗ Fail | [findings] |
| Custom checks | ✓ Pass / ✗ Fail | [output] |
```

### Step 5: Accessibility (if configured)

Check for accessibility issues if script exists:

```bash
npm run a11y 2>/dev/null || npm run test:a11y 2>/dev/null || true
```

### Step 6: Performance (if configured)

Check for performance regressions if script exists:

```bash
npm run perf 2>/dev/null || npm run lighthouse 2>/dev/null || true
```

### Step 7: Unit Tests

```bash
npm run test
```

### Step 8: Coverage Report (if --coverage)

```bash
npm run test -- --coverage
```

**Report:**
```markdown
### Test Coverage

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Statements | 85% | 80% | ✓ Pass |
| Branches | 78% | 75% | ✓ Pass |
| Functions | 82% | 80% | ✓ Pass |
| Lines | 85% | 80% | ✓ Pass |
```

### Step 9: Build

```bash
npm run build
```

### Step 10: Bundle Size (if configured)

```bash
# If bundlesize or size-limit configured
npm run size 2>/dev/null || true
```

**Report:**
```markdown
### Bundle Size

| Bundle | Size | Limit | Status |
|--------|------|-------|--------|
| main.js | 145kb | 150kb | ✓ Pass |
| vendor.js | 89kb | 100kb | ✓ Pass |
```

### Full Validation Summary

```markdown
## Full Validation Results

| Step | Check | Status | Time |
|------|-------|--------|------|
| 1 | Format | ✓ Pass | 2s |
| 2 | Types | ✓ Pass | 8s |
| 3 | Lint | ✓ Pass | 5s |
| 4 | Security | ✓ Pass | 3s |
| 5 | Accessibility | ✓ Pass | 5s |
| 6 | Performance | ✓ Pass | 10s |
| 7 | Tests | ✓ Pass (156 tests) | 45s |
| 8 | Coverage | ✓ Pass (85%) | - |
| 9 | Build | ✓ Pass | 12s |
| 10 | Bundle | ✓ Pass | 2s |

**Total time:** ~95s

---
✅ **All CI checks passed** - Ready to push
```

---

## Fix Mode (--fix)

**Chatmode:** 👨‍💻 Developer
**Purpose:** Auto-correct formatting and lint issues

### Step 1: Auto-fix Format

```bash
npm run format 2>/dev/null || npx prettier --write [changed-files]
```

### Step 2: Auto-fix Lint

```bash
npm run lint -- --fix [changed-files]
```

### Step 3: Verify Fixes

```bash
# Re-run checks to confirm fixes
npm run typecheck
npm run lint -- [changed-files]
```

### Step 4: Run Scoped Tests

```bash
npm run test -- [affected-tests]
```

**Report:**
```markdown
## Fix Mode Results

### Auto-fixed
| Type | Files Fixed | Issues Resolved |
|------|-------------|-----------------|
| Format | 5 | 23 |
| Lint | 3 | 8 |

### Remaining Issues (manual fix required)
| File | Line | Issue |
|------|------|-------|
| `src/utils.ts` | 45 | Type error: cannot assign... |

### Verification
| Check | Status |
|-------|--------|
| Types | ✓ Pass / ✗ N errors remain |
| Lint | ✓ Pass |
| Tests | ✓ Pass |
```

---

## CI Mirror Mode (--ci)

**Purpose:** Run exact same checks as CI pipeline

### Step 1: Detect CI Configuration

```bash
# Check for CI config files
ls -la .github/workflows/*.yml 2>/dev/null
ls -la .gitlab-ci.yml 2>/dev/null
ls -la Jenkinsfile 2>/dev/null
```

### Step 2: Extract CI Steps

Parse CI configuration and run equivalent local commands.

```markdown
## CI Mirror Mode

**Detected:** GitHub Actions (`.github/workflows/ci.yml`)

**Running CI steps locally:**

| CI Job | Local Command | Status |
|--------|---------------|--------|
| lint | `npm run lint` | ✓ Pass |
| typecheck | `npm run typecheck` | ✓ Pass |
| test | `npm run test -- --ci` | ✓ Pass |
| build | `npm run build` | ✓ Pass |

**Note:** Some CI-specific checks (e.g., PR labels, branch protection) cannot be verified locally.
```

---

## E2E Tests (Optional)

For projects with end-to-end tests:

```bash
# Playwright
npx playwright test [specific-test]

# Cypress
npx cypress run --spec [specific-test]
```

**Include in full validation:**
```markdown
### E2E Tests

| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Auth | 5 | 5 | 0 | 0 |
| Checkout | 8 | 8 | 0 | 0 |

**Result:** ✓ All 13 E2E tests passed
```

---

## Validation Levels Reference

| Level | Checks | When to Use |
|-------|--------|-------------|
| **Quick** | Format, Types, Lint, Scoped Tests | During development |
| **Full** | All checks + Full test suite + Build | Before push/PR |
| **CI** | Mirror exact CI pipeline | Before important merges |
| **Fix** | Auto-correct + Verify | When you have many small issues |

---

## Common Issues & Solutions

### Format Errors

```markdown
**Problem:** Files not formatted
**Solution:** Run `/validate --fix` or `npm run format`
```

### Type Errors

| Error Pattern | Likely Cause | Solution |
|---------------|--------------|----------|
| `Cannot find module` | Missing import | Check path, add dependency |
| `Type X not assignable to Y` | Type mismatch | Fix types or add assertion |
| `Property does not exist` | Missing property | Add to interface or check spelling |
| `Implicit any` | Missing type annotation | Add explicit type |

### Lint Errors

| Error | Auto-fixable | Solution |
|-------|--------------|----------|
| `no-unused-vars` | No | Remove variable or use it |
| `prefer-const` | Yes | `--fix` will correct |
| `quotes` | Yes | `--fix` will correct |
| `@typescript-eslint/no-explicit-any` | No | Add proper type |

### Test Failures

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Timeout | Async not awaited | Add `await` or increase timeout |
| Mock not called | Wrong mock setup | Check mock implementation |
| Snapshot mismatch | Intentional change | Update snapshot with `-u` |
| Cannot find element | Selector changed | Update test selector |

### Build Errors

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| Module not found | Missing dependency | `npm install` |
| Circular dependency | Import cycle | Refactor imports |
| Out of memory | Large build | Increase Node memory |

### Security Audit Issues

| Severity | Action |
|----------|--------|
| Critical | Fix immediately - `/deps update --security` |
| High | Fix before release |
| Moderate | Plan to fix |
| Low | Track in todo |

---

## Output Formats

### Success Output

```markdown
## Validation Results

✅ **All checks passed**

| Check | Status | Time |
|-------|--------|------|
| Format | ✓ | 1s |
| Types | ✓ | 5s |
| Lint | ✓ | 3s |
| Tests | ✓ (24 tests) | 12s |

**Ready to commit/push**
```

### Failure Output

```markdown
## Validation Results

❌ **Validation failed**

| Check | Status | Details |
|-------|--------|---------|
| Format | ✓ | - |
| Types | ✗ | 2 errors |
| Lint | ✓ | - |
| Tests | - | Skipped (types failed) |

### Type Errors

**File:** `src/components/Button.tsx:45`
```
Type 'string' is not assignable to type 'number'.
```

**Suggested fix:** Change `count: string` to `count: number` in ButtonProps

---
**Fix errors and re-run:** `/validate`
**Auto-fix what's possible:** `/validate --fix`
```

---

## Rules

### Prohibited
- ❌ Skipping type check
- ❌ Committing with lint errors
- ❌ Ignoring security vulnerabilities without acknowledgment
- ❌ Running full test suite when scoped tests suffice

### Required
- ✓ Type check must pass before tests
- ✓ Report all failures clearly with solutions
- ✓ Stop at first failing level (don't waste time on later checks)
- ✓ Include file and line numbers for errors

### Recommended
- 💡 Use `--fix` mode for quick cleanup
- 💡 Run `--full` before creating PR
- 💡 Run `--security` periodically
- 💡 Track coverage trends over time

---

---
 
 ## Project Setup for Advanced Validation
 
 To enable advanced checks, add these scripts to your `package.json`:
 
 ```json
 {
   "scripts": {
     "security": "git-secrets --scan && npm audit",
     "a11y": "pa11y-ci",
     "perf": "lighthouse-ci"
   }
 }
 ```
 
 The workflow will automatically detect and run these scripts if they exist.
 
 ---
 
 **See Also:**
- [Workflow: Commit](./commit.prompt.md) - Validate before committing
- [Workflow: Deps](./deps.prompt.md) - Security audit for dependencies
- [Workflow: Wrap](./wrap.prompt.md) - Validation as part of session wrap-up
