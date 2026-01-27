---
task: clarify-requirements
chatmode: architect
tools: [read, glob, grep]
---

# Task: Clarify Requirements

> **Purpose:** Ask targeted questions to understand what the user wants
> **Chatmode:** Architect (read-only)
> **Output:** Clear, unambiguous requirements

## Steps

1. **Identify ambiguity** - What's unclear about the request?
2. **Formulate questions** - Specific, actionable questions
3. **Ask user** - Present questions clearly
4. **Confirm understanding** - Summarize what you learned

## Question Categories

### Functional Requirements
- What is the expected input?
- What is the expected output?
- What should happen on error?
- Are there edge cases to handle?

### Scope
- Is this a new feature or modification?
- What existing code should be used?
- What should NOT change?

### Constraints
- Are there performance requirements?
- Are there security concerns?
- Must it be backwards compatible?

### UX (if applicable)
- How should the user interact?
- What feedback should they see?
- What errors should they see?

## Question Format

Ask questions in a structured way:

```markdown
## Clarification Needed

Before proceeding, I need to clarify:

1. **[Topic]:** [Specific question]?
   - Option A: [description]
   - Option B: [description]

2. **[Topic]:** [Specific question]?

3. **[Topic]:** [Specific question]?
```

## Tips

- Ask all questions at once (don't ping-pong)
- Provide options when possible
- Reference existing patterns: "Should this work like X?"
- State assumptions you're making
- Keep questions focused and actionable

## Anti-Patterns

- Asking obvious questions
- Asking questions answered by reading the code
- Asking too many questions at once
- Vague questions like "what do you want?"

## Output Format

```markdown
## Clarification Needed

Before I create a plan, I need to understand:

1. **Behavior:** When [scenario], should the system [option A] or [option B]?

2. **Scope:** Should this change also affect [related area]?

3. **Edge case:** How should we handle [edge case]?

**Current assumption:** [What I'm assuming if you don't answer]
```

## Transition

After clarification, proceed to:
- `plan/create-plan` - Create implementation plan
- `explore/gather-context` - If more exploration needed
