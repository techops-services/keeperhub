---
name: feature-dev
description: Implement GitHub issues with TDD workflow and multi-agent collaboration. Use when user provides a GitHub issue number (e.g., "Implement #123", "Work on issue 45", "Build #789"). Orchestrates planner, designer, developer, tester, reviewer, and writer agents in sequence.
---

# Feature Development Workflow

Implement GitHub issues using test-driven development with specialized agents. Execute phases in strict sequential order.

## Phase 1: Context Gathering

**Step 1.1: Fetch GitHub Issue**
```
Use Bash with: gh issue view <issue-number> --json title,body,labels,assignees,milestone
Extract: title, body (description/acceptance criteria), labels, linked references.
```

**Step 1.2: Interview for Missing Context**
```
Use Skill tool with skill="interview" to gather additional requirements.
Skip if acceptance criteria are comprehensive.
```

**Step 1.3: Update Issue Status**
```
Use Bash with: gh issue edit <issue-number> --add-label "in-progress"
Optionally remove "todo" or "ready" labels if present.
```

## Phase 2: Planning

**Step 2.1: Create Implementation Plan**
```
Use Task tool with subagent_type="planner".
Prompt: "Create implementation plan for [issue summary]. Requirements: [acceptance criteria]"
```

**Step 2.2: Save Plan to Memory**
```
Use mcp__memory__create_entities to store the plan.
Entity type: "FeaturePlan", name: "issue-#<number>-plan"
```

**Step 2.3: User Confirmation**
```
Present the plan summary to user.
Use AskUserQuestion: "Ready to proceed with implementation?"
STOP if user wants changes.
```

## Phase 3: Implementation (TDD)

**Step 3.1: Write Tests First**
```
Use Task tool with subagent_type="tester".
Prompt: "Write test cases for [feature]. Requirements: [from plan]. Write failing tests first."
```

**Step 3.2: UI Design (if frontend work)**
```
Use Task tool with subagent_type="designer".
Prompt: "Design UI for [feature]. Use Chrome DevTools MCP for reference."
Only run if feature has UI components.
```

**Step 3.3: Implement Code**
```
Use Task tool with subagent_type="developer".
Prompt: "Implement [feature] to pass the tests. Follow plan from Phase 2."
```

**Step 3.4: Verify Tests Pass**
```
Run test suite via Bash.
If tests fail, return to Step 3.3 with failure context.
```

## Phase 4: Review

**Step 4.1: Code Review**
```
Use Task tool with subagent_type="reviewer".
Prompt: "Review implementation for issue #<number>. Check for P1/P2/P3 issues."
```

**Step 4.2: Address Review Feedback**
```
If reviewer found issues:
  Use Task tool with subagent_type="developer".
  Prompt: "Fix review issues: [list from reviewer]"
Repeat Step 4.1 until no P1/P2 issues remain.
```

## Phase 5: Validation

**Step 5.1: Run Full Validation**
```
Execute in sequence:
1. Run all tests
2. Run linter
3. Run type checker
4. Run build
All must pass before proceeding.
```

**Step 5.2: User Confirmation**
```
Use AskUserQuestion: "Validation passed. Ready to document and commit?"
Options: "Yes, continue" / "Let me review first" / "Make changes"
```

## Phase 6: Documentation

**Step 6.1: Update Documentation**
```
Use Task tool with subagent_type="writer".
Prompt: "Document [feature] implementation. Update relevant docs."
```

## Phase 7: Git Operations

**Step 7.1: Confirm Git Actions**
```
Use AskUserQuestion: "Ready for git operations?"
Options:
- "Create commits only"
- "Create commits and PR"
- "Skip git operations"
```

**Step 7.2: Create Commits**
```
If user approved:
1. Stage relevant files
2. Create logical commits referencing the issue
Example: "feat: add user authentication (#123)"
```

**Step 7.3: Create PR**
```
If user selected PR creation:
Use gh pr create with:
- Title: "[Summary] (#<issue-number>)"
- Body: "Closes #<issue-number>\n\n## Summary\n[changes]\n\n## Test Plan\n[test details]"
The "Closes #X" syntax auto-links and closes the issue on merge.
```

## Enforcement Rules

- Execute phases 1-7 in order. Never skip phases.
- Wait for each Task agent to complete before starting the next.
- Stop and ask user if any phase fails.
- Always run validation (Phase 5) before documentation (Phase 6).
- Never auto-commit or auto-push without user confirmation.
