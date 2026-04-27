# Plan a Tanchiki Campaign Brief

Use Linear MCP.

Read the campaign brief supplied by the user and create 5-8 small Linear issues for Tanchiki. This is Level 3 planning only.

## Required Reading

1. `CODEX_HANDOFF.md`
2. `AGENTS.md`
3. `README.md`
4. `ops/prompts/planner-agent.md`
5. `ops/policies/planner-boundaries.md`
6. `ops/checklists/planner-output-checklist.md`
7. the supplied campaign brief

## Workflow

1. Restate the campaign goal, current state, constraints, and obvious dependencies.
2. Break the brief into 5-8 issues.
3. Preserve dependency order between issues.
4. Keep each issue small enough for one Level 2 implementation pass.
5. Classify every issue as:
   - `agent-ready candidate`
   - `human-review required`
   - `human-only`
   - `blocked/dependency`
6. Create the issues in Linear.
7. Stop after creating issues and a summary.

## Issue Body Requirements

Each issue must include:

- Goal
- Current state
- Files likely involved
- Scope
- Do-not-touch list
- Acceptance criteria
- Tests required
- Validation commands
- Manual QA
- Risk level
- Suggested labels
- Planner classification
- Dependencies or blockers

## Guardrails

- Do not implement gameplay code.
- Do not edit source files.
- Do not open a gameplay implementation PR.
- Do not mark issues `agent-ready` unless the user explicitly instructs you to.
- Do not move issues to `In Progress`, `In Review`, or `Done`.
- Do not create broad vague issues like "improve AI", "polish game", or "add campaign".

## Final Response

Report:

- created issue identifiers and titles
- each classification
- recommended implementation order
- dependency notes
- which issues need human review before Level 2 can pick them up
