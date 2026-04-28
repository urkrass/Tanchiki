# Plan A Tanchiki Campaign Request

Use Linear MCP and GitHub.

Run the Tanchiki self-service campaign factory for the supplied campaign request. Treat the request as intake for planning and grooming only. Do not let a request directly trigger Coder work.

## Input

Use either:

- a completed `.github/ISSUE_TEMPLATE/campaign-request.yml` submission, or
- a pasted campaign request that provides the same fields.

If required request fields are missing, create or report a human-gated clarification issue instead of guessing.

## Required Reading

Before creating or grooming Linear issues, read:

1. `AGENTS.md`
2. `README.md`
3. `CODEX_HANDOFF.md`
4. `.github/ISSUE_TEMPLATE/campaign-request.yml`
5. `ops/prompts/planner-agent.md`
6. `ops/prompts/campaign-groomer.md`
7. `ops/policies/planner-boundaries.md`
8. `ops/policies/campaign-execution.md`
9. `ops/policies/role-router.md`
10. `ops/policies/risk-gated-validation.md`
11. `ops/checklists/planner-output-checklist.md`
12. `ops/checklists/campaign-grooming-checklist.md`
13. `ops/checklists/conflict-risk-checklist.md`
14. the supplied campaign request

## Factory Rules

- This is planning and queue grooming only.
- Do not edit source files.
- Do not open a PR.
- Do not merge anything.
- Do not mark issues `Done`.
- Do not modify `src/game/movement.js`.
- Do not change gameplay, progression, level tuning, enemy AI, shooting, collision, movement, upgrade behavior, or persistence.
- Do not add dependencies.
- Do not create broad catch-all issues.
- Do not apply `automation-ready` to Coder, Test, Reviewer, Release, blocked, human-only, or needs-human-approval issues during intake.
- Do not apply `automation-ready` to any issue labeled `risk:human-only`.
- If the request includes unsafe categories, create a human approval gate before implementation work.

## Request Review

First classify the request:

- `safe planning request`: docs, prompts, templates, harness policy, checklists, static validation, or low-risk UI copy.
- `needs-human-approval`: gameplay behavior, progression, level tuning, dependencies, CI browser checks, screenshots as pass/fail, public-demo release gates, broad architecture, or ambiguous product choices.
- `human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations, broad rewrites, or any category requiring human judgment before automation.

If any part is unsafe or ambiguous, split the campaign so the unsafe decision is a human gate issue and downstream implementation stays blocked.

## Planner Work

Create 6-8 small Linear issues when appropriate. Every issue must include:

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
- Role label
- Type label
- Risk label
- Validation profile
- Dependency order
- Visible UI expectation
- Central-file conflict risk

Use Level 5 metadata on every issue:

- one `role:*` label: `role:architect`, `role:coder`, `role:test`, `role:reviewer`, or `role:release`
- one `type:*` label from the repo taxonomy
- one `risk:*` label from the repo taxonomy
- one `validation:*` label from the repo taxonomy

Preserve dependencies from the request. Keep issues small enough for one role pass. Prefer an Architect review issue first unless the request is already an approved continuation with a clear safe next issue.

## Auto-Groomer Work

After issue creation, groom the same Linear campaign:

1. Normalize every issue to exactly one role label.
2. Normalize every issue to exactly one type label.
3. Normalize every issue to exactly one risk label.
4. Normalize every issue to exactly one validation label.
5. Add `needs-human-approval` to human gate issues.
6. Add `human-only` and `risk:human-only` where automation must never run.
7. Add `blocked` to dependency-blocked issues.
8. Preserve blocked-by relationships where Linear supports them.
9. Ensure no parent, umbrella, blocked, human-only, or gated issue has `automation-ready`.
10. Ensure no issue has `automation-ready` with `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`.
11. Make only the first safe Architect issue `Todo` + `automation-ready`.
12. Keep all Coder/Test/Reviewer/Release issues Backlog or blocked until Architect and human gates are complete.
13. Add a grooming comment with queue order, blocked issues, and human gates.

## Validation Expectations

For planning-only work, do not run code validation unless repository files were changed by an explicitly scoped docs/harness issue.

For future implementation issues, include the appropriate commands in each issue body. Default docs and harness validation:

```powershell
npm test
npm run build
npm run lint
git diff --check
```

## Final Report

After creating and grooming the campaign, report:

- issue identifiers and titles
- role/type/risk/validation for each issue
- dependency order
- first eligible issue
- blocked issues
- human approval gates
- central-file conflict risks
- visible UI expectations
- next human action

Stop after reporting the groomed queue. Do not implement anything.
