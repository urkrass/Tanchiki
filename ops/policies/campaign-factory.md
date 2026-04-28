# Campaign Factory Policy

Use this policy when a human submits a self-service campaign request through `.github/ISSUE_TEMPLATE/campaign-request.yml` or an equivalent pasted brief.

The campaign factory is an intake, planning, and grooming workflow. It does not authorize implementation, source edits, dependency additions, pull requests, merges, or Done-state changes.

## Inputs

A valid request should provide:

- campaign name
- goal
- current state
- requested campaign shape
- constraints and do-not-touch list
- primary request category
- human approval gates
- validation expectations
- visible UI expectation
- non-goals
- expected Planner + Auto-Groomer output

If required fields are missing, the factory must not guess. Create or report a human-gated clarification item before planning implementation work.

## Intake Classification

Classify the request before creating Linear issues:

- `safe planning request`: docs, prompts, templates, harness policy, checklists, static validation, or low-risk UI copy.
- `needs-human-approval`: gameplay behavior, progression, level tuning, dependency additions, CI browser checks, screenshot pass/fail gates, public-demo release flow, broad architecture, or ambiguous product decisions.
- `human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations, broad rewrites, or anything that requires human judgment before automation.

Mixed requests must be split so unsafe or ambiguous decisions become human gate issues. Downstream implementation stays blocked until the gate is resolved.

## Planning Rules

Planner output must create small Linear issues rather than broad campaign umbrellas. Use 6-8 issues when the request is campaign-sized.

Every issue must include:

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

Issues must stay small enough for one Level 4 role pass. Do not create vague tasks such as "improve gameplay", "add campaign", or "polish systems".

## Level 5 Metadata

Every automated issue must have exactly one label from each group:

- role: `role:architect`, `role:coder`, `role:test`, `role:reviewer`, or `role:release`
- type: one `type:*` label from `VALIDATION_MATRIX.md`
- risk: one `risk:*` label from `VALIDATION_MATRIX.md`
- validation: one `validation:*` label from `VALIDATION_MATRIX.md`

Use:

- `needs-human-approval` for decision gates
- `human-only` and `risk:human-only` where automation must never run
- `blocked` for dependency-blocked issues
- `automation-ready` only for the single issue the dispatcher may run next

Do not use deprecated `agent-ready` routing for new campaign factory work. Do not use `human-review` to mean reviewer-agent work.

## Grooming Rules

After issue creation, the Planner must run the Campaign Groomer before stopping.

The groomed queue must satisfy:

- exactly one issue in the dependency chain is `Todo` + `automation-ready`
- the first exposed issue is the first safe Architect issue unless a human explicitly approved another safe first issue
- Coder issues remain Backlog or blocked until Architect and human gates are complete
- Test issues remain blocked until implementation PRs are merged or ready
- Reviewer issues remain blocked until implementation or test PRs exist
- Release issues remain blocked until review is complete
- no blocked, gated, human-only, parent, umbrella, or `risk:human-only` issue has `automation-ready`

Campaign requests must never directly promote Coder work to `automation-ready`.

## Human Gates

Human approval is required before automation for:

- movement, collision, spawning, or control-feel work
- persistence or save behavior
- dependency additions
- destructive repository operations
- broad architecture rewrites
- broad AI rewrites or campaign-wide enemy behavior changes
- progression balance or carried-state changes
- public-demo release decisions that depend on product judgment
- screenshot or visual checks used as required pass/fail CI gates

When a gate is required, create a dedicated human approval issue with `needs-human-approval`. If automation must never run it, also use `human-only` and `risk:human-only`.

## Safety Boundaries

The factory must not:

- edit gameplay code during planning
- modify `src/game/movement.js`
- change movement, collision, shooting, enemy AI, level difficulty, progression, or upgrade behavior from a docs or harness issue
- add dependencies without a human approval gate
- open a PR during planning
- merge anything
- mark issues `Done`

Implementation remains a separate Dispatcher step after grooming and approval.

## Final Report

After creating and grooming a campaign, report:

- issue identifiers and titles
- role/type/risk/validation for each issue
- dependency order
- first eligible issue
- blocked issues
- human approval gates
- visible UI expectations
- central-file conflict risks
- next human action

Stop after the report. Do not implement the campaign during intake.
