---
task: debug-test
chatmode: tester
tools: [read, write, edit, bash, glob, grep]
---

# Task: Debug Test

> **Purpose:** Investigate and fix failing tests
> **Chatmode:** Tester (test-focused access)
> **Goal:** Determine if it's a test bug or code bug

## Steps

1. **Read the failing test** - Understand what it checks
2. **Read the error message** - Identify failure point
3. **Read the source code** - Understand expected behavior
4. **Determine cause** - Test bug vs code bug
5. **Apply fix** - To test or source as appropriate

## Diagnosis Questions

### Is it a Test Bug?
- Test expectations incorrect?
- Test setup missing something?
- Mocks not configured properly?
- Async timing issue?

### Is it a Code Bug?
- Code not behaving as expected?
- Edge case not handled?
- Recent change broke behavior?
- Dependency changed?

## Debugging Techniques

### Add Verbose Logging
```typescript
console.log('State at failure:', state);
console.log('Input was:', input);
console.log('Expected:', expected);
console.log('Actual:', actual);
```

### Run Single Test
```bash
{{TEST_COMMAND}} --grep "specific test name"
```

### Run with Verbose Output
```bash
{{TEST_VERBOSE_COMMAND}}
```

### Check Recent Changes
```bash
git diff HEAD~3 path/to/file.ts
git log --oneline -5 path/to/file.ts
```

## Common Failure Patterns

### Async/Timing Issues
```typescript
// Problem: Test doesn't wait for async
// Fix: Use async/await or waitFor
await waitFor(() => expect(result).toBe(expected));
```

### Mock Issues
```typescript
// Problem: Mock not returning expected value
// Fix: Check mock setup
jest.mock('./dependency', () => ({
  function: jest.fn().mockReturnValue(expected)
}));
```

### State Pollution
```typescript
// Problem: Previous test affects this one
// Fix: Proper cleanup in beforeEach/afterEach
beforeEach(() => {
  cleanup();
});
```

## Tips

- Isolate the problem to smallest reproduction
- Check if test passes in isolation vs full suite
- Look for timing-related keywords (setTimeout, async, await)
- Check git blame for recent changes

## Output Format

```markdown
**Failing Test:** `test name`

**Error:** [error message]

**Diagnosis:** [Test bug / Code bug]

**Root Cause:** [explanation]

**Fix Applied:** [what was changed]

**Verification:** `{{TEST_COMMAND}} path/to/test.spec.ts`
```

## Transition

After debugging:
- Test fixed → `test/run-tests` to verify
- Code bug found → `implement/edit-file` to fix source
- Unclear cause → `explore/analyze-code` for deeper investigation
