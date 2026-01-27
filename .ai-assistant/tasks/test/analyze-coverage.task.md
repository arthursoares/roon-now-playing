---
task: analyze-coverage
chatmode: tester
tools: [read, bash, glob, grep]
---

# Task: Analyze Coverage

> **Purpose:** Identify code that lacks test coverage
> **Chatmode:** Tester (test-focused access)
> **Output:** List of files/functions needing tests

## Steps

1. **Identify changed files** - What was recently modified?
2. **Find corresponding tests** - Do test files exist?
3. **Analyze coverage gaps** - What scenarios are missing?
4. **Prioritize** - Critical code first

## Find Missing Test Files

```bash
# List source files
find {{SOURCE_DIR}} -name "*.ts" -not -name "*.spec.ts" -not -name "*.test.ts"

# List test files
find {{SOURCE_DIR}} -name "*.spec.ts" -o -name "*.test.ts"

# Compare to find gaps
# Source files without corresponding test files
```

## Coverage Commands

```bash
# Run with coverage report
{{TEST_COVERAGE_COMMAND}}

# Generate HTML report
{{TEST_COVERAGE_HTML_COMMAND}}

# Check coverage thresholds
{{TEST_COVERAGE_CHECK_COMMAND}}
```

## Coverage Checklist

For each changed file:

- [ ] Test file exists (`file.spec.ts` or `file.test.ts`)
- [ ] Test plan documented at top
- [ ] Happy path covered
- [ ] Edge cases covered
- [ ] Error cases covered
- [ ] All public functions tested

## Prioritization

### Must Test (Critical)
- Core business logic
- Data transformations
- Security-related code
- Error handling paths

### Should Test (Important)
- Utility functions
- Complex conditionals
- State management

### Nice to Test (Optional)
- Simple getters/setters
- Trivial components
- Third-party wrappers

## Output Format

```markdown
## Coverage Analysis

### Files Needing Tests
| File | Reason | Priority |
|------|--------|----------|
| `path/to/file.ts` | No test file | High |
| `path/to/other.ts` | Missing edge cases | Medium |

### Tests to Add
1. **`path/to/file.spec.ts`** (create)
   - Happy path scenario
   - Error handling
   - Edge case: empty input

2. **`path/to/other.spec.ts`** (update)
   - Add edge case tests
   - Add error scenario

### Coverage Summary
- Changed files: X
- Have tests: Y
- Need tests: Z
```

## Transition

After analysis:
- `test/write-tests` - Create missing tests
- `track/create-todo` - Document test debt if deferring
