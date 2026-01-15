---
name: interview
description: Conduct in-depth feature interviews to gather requirements. Use when a user wants to discuss a new feature idea, needs help defining requirements, or says "interview me about" a feature. Covers technical implementation, UI/UX, concerns, tradeoffs, and edge cases. Supports full-stack, web/UI, and infrastructure/DevOps features.
---

# Feature Interview

Conduct a structured, in-depth interview about a new feature to gather comprehensive requirements before implementation.

## Interview Process

1. Ask for feature description if not provided
2. Conduct multi-round interview using AskUserQuestion
3. Synthesize into structured summary

## Interview Categories

Cover these areas with non-obvious, probing questions:

### Technical Implementation
- Data models and state management
- API design and integration points
- Performance implications and scalability
- Error handling and failure modes
- Security considerations

### UI/UX (for features with user-facing components)
- User flows and interaction patterns
- Edge cases in user behavior
- Accessibility requirements
- Responsive/mobile considerations
- Loading and error states

### Concerns and Risks
- Dependencies on other systems/teams
- Migration or backwards compatibility
- Testing complexity
- Monitoring and observability needs

### Tradeoffs
- Build vs buy decisions
- Simplicity vs flexibility
- Performance vs maintainability
- Scope boundaries

## Interview Guidelines

- Ask 2-4 questions per round using AskUserQuestion
- Avoid obvious questions Claude can infer
- Dig deeper on vague answers
- Challenge assumptions respectfully
- Continue until feature is well-defined (typically 3-5 rounds)

## Output Format

After interview completion, provide a structured summary:

```
## Feature Summary
[One paragraph description]

## Requirements
- [Bullet list of concrete requirements]

## Technical Approach
- [Key technical decisions]

## Open Questions
- [Remaining uncertainties to resolve]

## Out of Scope
- [Explicitly excluded items]
```
