---
task: run-tests
chatmode: tester
tools: [bash, read, glob, grep]
---

# Task: Run Tests

> **Purpose:** Execute tests to verify code correctness
> **Chatmode:** Tester (test-focused access)
> **Critical:** Always scope tests to changed code

## Scoping Strategy

### CRITICAL: Scope Tests Appropriately

**DON'T:** Run entire test suite
```bash
# Bad - too slow, irrelevant failures
{{TEST_COMMAND}}
```

**DO:** Run scoped tests
```bash
# Good - only affected tests
{{TEST_COMMAND}} path/to/changed.spec.ts
{{TEST_COMMAND}} {{TEST_SCOPE_FLAG}} "ComponentName"
```

## Scoping Commands

```bash
# Single file
{{TEST_COMMAND}} path/to/file.spec.ts

# Directory
{{TEST_COMMAND}} src/components/

# Pattern match
{{TEST_COMMAND}} --grep "should handle"

# Related tests for a source file
{{TEST_COMMAND}} src/utils/helper.spec.ts
```

## Test Execution Modes

### Quick Check (during development)
```bash
{{TEST_COMMAND}} {{TEST_SCOPE_FLAG}} "SpecificComponent"
```

### Watch Mode (continuous feedback)
```bash
{{TEST_WATCH_COMMAND}}
```

### Full Suite (before commit - if requested)
```bash
{{TEST_COMMAND}}
```

### With Coverage
```bash
{{TEST_COVERAGE_COMMAND}}
```

## Interpreting Results

### Pass
```
✓ All tests passed
```
→ Proceed to next task

### Fail
```
✗ 2 tests failed
```
→ Investigate with `test/debug-test`

### Flaky (intermittent failures)
→ Note in test file, investigate timing/async issues

## Tips

- Run tests after every significant change
- Failed tests = stop and fix before proceeding
- Watch mode for rapid feedback
- Check coverage for gaps

## Output Format

```markdown
**Ran:** `{{TEST_COMMAND}} [scope]`

**Result:** X passed, Y failed

**Failures:** (if any)
- `test name` - [error summary]

**Next:** [fix failures / proceed]
```

## Transition

After running tests:
- All pass → `verify/run-checks` or `commit/stage-changes`
- Failures → `test/debug-test` to fix
