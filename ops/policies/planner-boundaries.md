# Level 3 Planner Boundaries

Level 3 is a planning workflow. It exists to convert campaign-scale ideas into small Linear issues without changing gameplay code.

## Allowed

- Read repository documentation and existing source to understand current state.
- Read the campaign brief supplied by the user.
- Create Linear issues.
- Suggest labels, risk levels, dependencies, and review gates.
- Call out missing decisions or assets that block implementation.

## Prohibited

- Do not edit source code.
- Do not implement gameplay.
- Do not create branches or pull requests for gameplay work.
- Do not apply `automation-ready` unless explicitly instructed by a human.
- Do not move implementation issues to `In Progress`, `In Review`, or `Done`.
- Do not create broad catch-all issues.
- Do not add dependencies or tooling.
- Do not rewrite the campaign brief into a large design document unless explicitly asked.

## Issue Size Standard

Each issue should fit one Level 2 implementation pass:

- one primary gameplay or documentation objective
- a clear file area
- explicit acceptance criteria
- focused tests
- no broad refactors
- no unrelated cleanup

If an item touches several systems, split it into dependency-ordered issues.

## Required Classification

Every issue must be classified as one of:

- `automation-ready candidate`: likely suitable for automation after human approval and labeling.
- `needs-human-approval`: needs product, design, tuning, or architecture review before automation.
- `human-only`: requires creative direction, credentials, external assets, business judgment, or safety-critical review.
- `blocked/dependency`: cannot be implemented until another issue or decision is completed.

## Label Rules

The planner may suggest role labels in the issue body. The planner must not apply `automation-ready` automatically unless explicitly instructed.

For dependency chains, the planner may recommend which issue should become `Todo` + `automation-ready` first, but only one issue in the chain should hold that combination at a time.

Parent, epic, blocked, and `needs-human-approval` issues must not receive `automation-ready`. A gated issue may become automation-ready only after a human explicitly removes the gate and applies `automation-ready`.

Recommended labels include:

- `gameplay`
- `testing`
- `level-design`
- `ai`
- `assets`
- `polish`
- `harness`
- `needs-human-approval`
- `human-only`
- `blocked`
- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

## Dependency Rules

Use dependency notes when one issue must land before another. Prefer explicit wording:

```text
Depends on: TAN-123 Add campaign mission schema.
Blocks: Follow-up level content issues.
```

Do not hide blocked work behind an `automation-ready candidate` classification.

Where possible, create or preserve blocked-by relationships in Linear. If the tool cannot express the relationship, write explicit `Depends on:` and `Blocks:` lines in the issue body.

## Visibility Rules

Every planned issue must say whether a visible UI change is expected.

For internal-only issues such as state, XP reward calculation, catalog definitions, harness rules, or pure validation, state: `Visible UI change expected: no`.

If visible UI depends on a later issue, name that later issue or describe the follow-up.

## Conflict-Risk Rules

Before finalizing issues, consider recent merged PRs or git history when available. Flag central-file conflict risk when likely files include `src/game.js`, `test/game.test.js`, or files modified by the previous one to three merged PRs.

If several planned issues would touch the same central files, add a seam-extraction issue before continued feature work.

## Anti-Patterns

Do not create issues titled like:

- Improve AI
- Polish the game
- Add campaign
- Make levels better
- Add RPG systems

Rewrite them into small tasks with concrete files, scope, acceptance criteria, and tests.
