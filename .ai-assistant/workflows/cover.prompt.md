---
workflow: cover
priority: high
---

# Cover

> **Purpose:** Analyze current branch changes and ensure adequate test coverage
> **Prerequisites:** Changes exist in working tree or recent commits
> **Related:** [testing.instructions.md](../domains/testing.instructions.md)

## Steps

### 1. Analyze Current Changes

Identify what has changed:

```bash
# Get the main branch
MAIN_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')

# Staged and unstaged changes
git status --short

# Recent commits on current branch (vs main branch)
git log --oneline $MAIN_BRANCH..HEAD

# Detailed diff of changes
git diff --name-only $MAIN_BRANCH..HEAD
```

### 2. Categorize Changed Files

Group files by type and test requirements:

| File Type | Test Type Needed | Priority |
|-----------|------------------|----------|
| `*.ts` utilities/services | Unit tests (`.spec.ts`) | High |
| `*.tsx` components | Component tests | High |
| `*.ts` types/interfaces | No tests needed | Low |
| Config/build files | No tests needed | Low |

### 3. Identify Missing Test Coverage

For each changed file, check if corresponding tests exist:

```bash
# Get main branch
MAIN_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')

# For each .ts file (excluding tests), check for .spec.ts
for file in $(git diff --name-only $MAIN_BRANCH..HEAD | grep '\.ts$' | grep -v '\.spec\.' | grep -v '\.test\.'); do
  spec="${file%.ts}.spec.ts"
  if [ ! -f "$spec" ]; then
    echo "Missing spec: $file"
  fi
done
```

### 4. Create Test Coverage Plan

Create a todo list with specific items:

1. **Missing Unit Tests:** List files needing specs
2. **Existing Tests to Verify:** List test files that should be run

### 5. Write Missing Tests

For each missing test:

**For TypeScript Utilities (Unit Tests):**
- Create `.spec.ts` file alongside the source file
- Include test plan describing what's being tested
- Use `describe`/`it` blocks with meaningful descriptions
- Test edge cases and error conditions
- Mock external dependencies

**Test File Structure:**
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

### 6. Run and Verify Tests

```bash
# Run specific test file
npm run test -- path/to/file.spec.ts

# Run tests for a directory
npm run test -- "src/utils/"

# Run all tests (use sparingly)
npm run test
```

### 7. Fix Failures and Re-run

Common issues:
- Missing mocks for dependencies
- Incorrect assertions
- Missing `await` for async operations
- Test isolation issues (shared state)

## Rules

### Prohibited

- **Do not run full test suites** unless necessary - too slow
- **Do not create tests for config/build files**
- **Do not test implementation details** - focus on behavior
- **Do not test type definitions** - they're compile-time only

### Required

- **Test plan** for every test file describing what's tested
- **Run tests and fix failures** before completing
- **Cover all changed utilities** with unit tests
- **Use appropriate test patterns** from testing.instructions.md

### Optional

- Create file list in `.ai-project/file-lists/` if many files need coverage
- Add long-term todo if work cannot be completed in one session

## Output Format

After completing the workflow, report results:

```markdown
## Test Coverage Report

### Changed Files Analyzed
- X TypeScript utilities
- Y existing test files
- Z files not requiring tests

### Tests Created
- ✅ utility.spec.ts - 8 tests, all passing
- ✅ service.spec.ts - 5 tests, all passing

### Tests Verified
- ✅ existingUtil.spec.ts - passing

### Skipped (No Tests Needed)
- types.ts - type definitions only
- config.ts - configuration file

### Issues Found
- ⚠️ Module has circular dependency - documented in todos
```

## Quick Reference

### Test File Locations

| Source File | Test File |
|-------------|-----------|
| `src/utils/foo.ts` | `src/utils/foo.spec.ts` |
| `src/services/bar.ts` | `src/services/bar.spec.ts` |
| `libs/core/src/baz.ts` | `libs/core/src/baz.spec.ts` |

### Test Commands

```bash
# Single test file
npm run test -- foo.spec.ts

# Directory
npm run test -- "src/utils/"

# Watch mode (during development)
npm run test -- --watch

# With coverage
npm run test -- --coverage
```

## References

- [Testing Guidelines](../domains/testing.instructions.md)
- [Validate Workflow](./validate.prompt.md)
