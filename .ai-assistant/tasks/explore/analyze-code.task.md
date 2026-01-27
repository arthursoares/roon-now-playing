---
task: analyze-code
chatmode: architect
tools: [read, glob, grep]
---

# Task: Analyze Code

> **Purpose:** Deep analysis of specific code to understand behavior, patterns, or issues
> **Chatmode:** Architect (read-only)
> **Output:** Detailed understanding of how code works

## Steps

1. **Identify the target** - Specific file, function, or component
2. **Read the code** - Understand what it does
3. **Trace dependencies** - What does it import/use?
4. **Trace usages** - Where is it used?
5. **Document findings** - Explain behavior clearly

## Analysis Types

### Function Analysis
- What are the inputs/outputs?
- What are the side effects?
- What can go wrong?
- What are the edge cases?

### Component Analysis
- What props does it accept?
- What state does it manage?
- What events does it emit?
- How does it interact with other components?

### Pattern Analysis
- How is this pattern used elsewhere?
- What are the variations?
- Is there inconsistency?

## Useful Commands

```bash
# Find all usages of a function
grep -rn "functionName(" src/

# Find all imports of a module
grep -rn "from.*moduleName" src/

# Find implementations of an interface
grep -rn "implements InterfaceName" src/

# Find class definitions
grep -rn "class ClassName" src/

# Show file with line numbers
cat -n path/to/file.ts | head -100
```

## Tips

- Follow the data flow from input to output
- Check error handling paths
- Look at tests for expected behavior
- Note any magic numbers or unclear logic
- Identify potential bugs or improvements

## Output Format

```markdown
## Analysis: [Target Name]

**Purpose:** [What this code does]

**Key Logic:**
1. [Step 1 of what happens]
2. [Step 2 of what happens]

**Dependencies:**
- `import X from Y` - [why it's used]

**Used By:**
- `path/to/file.ts:123` - [how it's used]

**Observations:**
- [Notable finding]
- [Potential issue]
```

## Transition

After analysis, proceed to:
- `plan/create-plan` - If changes are needed
- `review/check-quality` - If reviewing for issues
