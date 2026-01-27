---
task: write-tests
chatmode: tester
tools: [read, write, edit, bash, glob, grep]
---

# Task: Write Tests

> **Purpose:** Create test coverage for new or modified code
> **Chatmode:** Tester (test-focused access)
> **Requirement:** All test files must include a test plan

## Steps

1. **Read source code** - Understand what to test
2. **Identify scenarios** - Happy path, edge cases, errors
3. **Write test plan** - Gherkin format at top of file
4. **Implement tests** - Following project patterns
5. **Run and verify** - Ensure tests pass

## Test Plan Template

Every test file MUST start with:

```typescript
/**
 * Test Plan: {{ComponentName}}
 *
 * Scenario: Happy path - basic usage
 *   Given [initial state]
 *   When [action]
 *   Then [expected outcome]
 *
 * Scenario: Edge case - empty input
 *   Given [empty state]
 *   When [action with empty input]
 *   Then [appropriate handling]
 *
 * Scenario: Error handling
 *   Given [state that causes error]
 *   When [action]
 *   Then [error handled gracefully]
 */
```

## Project Test Patterns

```typescript
{{TEST_PATTERN_EXAMPLE}}
```

### Test File Location
- Source: `{{SOURCE_PATH}}`
- Tests: `{{TEST_PATH}}`

### Test Naming Convention
```
{{TEST_FILE_NAMING}}
```

## Test Categories

### Unit Tests
- Test single function/component in isolation
- Mock all dependencies
- Fast, deterministic

### Integration Tests
- Test component interactions
- May use real dependencies
- Test data flow

### Edge Cases to Consider
- Empty/null/undefined inputs
- Boundary values (0, -1, max)
- Invalid types
- Error conditions
- Async race conditions

## Useful Commands

```bash
# Run specific test file
{{TEST_COMMAND}} path/to/file.spec.ts

# Run tests matching pattern
{{TEST_COMMAND}} --grep "pattern"

# Run with coverage
{{TEST_COVERAGE_COMMAND}}

# Watch mode
{{TEST_WATCH_COMMAND}}
```

## Tips

- Test behavior, not implementation
- One assertion per test when possible
- Use descriptive test names
- Group related tests with describe()
- Setup/teardown for shared state

## Output Format

```markdown
**Created:** `path/to/component.spec.ts`

**Coverage:**
- [x] Happy path
- [x] Edge case: empty input
- [x] Edge case: null handling
- [x] Error: network failure

**Run:** `{{TEST_COMMAND}} path/to/component.spec.ts`
```

## Transition

After writing tests:
- `test/run-tests` - Execute the tests
- `test/debug-test` - If tests fail
- `verify/run-checks` - Full validation
