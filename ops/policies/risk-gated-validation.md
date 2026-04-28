# Level 5 Risk-Gated Validation Policy

Level 5 adds metadata gates on top of the Level 4 role-separated workflow. The dispatcher may not run an issue until the issue declares what kind of work it is, how risky it is, and which validation profile applies.

## Dispatcher Eligibility

An issue is eligible for automation only when all of these are true:

- status is `Todo`
- has `automation-ready`
- has exactly one `role:*` label
- has exactly one `type:*` label
- has exactly one `risk:*` label
- has exactly one `validation:*` label
- does not have `blocked`
- does not have `needs-human-approval`
- does not have `human-only`
- does not have `risk:human-only`
- is not blocked by another issue
- is not canceled or `Done`
- is not a parent, epic, campaign umbrella, or safety-critical item

If required metadata is missing, the dispatcher must stop and comment on the Linear issue asking for triage. The comment must name the missing or conflicting labels.

Stop conditions:

- more than one `role:*` label
- more than one `type:*` label
- more than one `risk:*` label
- more than one `validation:*` label
- `automation-ready` appears with `blocked`
- `automation-ready` appears with `needs-human-approval`
- `automation-ready` appears with `human-only`
- `risk:human-only` appears on the issue

Blocked or gated issues should be skipped while scanning. Metadata failures on otherwise runnable Todo candidates should be reported so humans can triage the queue.

## Issue Type Labels

- `type:docs`
- `type:harness`
- `type:ui`
- `type:test`
- `type:gameplay`
- `type:progression`
- `type:architecture`
- `type:movement`

## Risk Labels

`risk:low` covers docs, harness, narrow UI copy, test-only work, and isolated helpers. It may be automated when a validation profile is present.

`risk:medium` covers normal gameplay, progression, level layout, and UI behavior. It may be automated when acceptance criteria and validation profile are clear.

`risk:high` covers broad gameplay behavior, campaign progression, AI behavior, central orchestration files, and significant UI flow. It requires stronger tests and explicit manual QA notes. It may require `needs-human-approval` before automation.

`risk:human-only` covers movement/collision rewrites, save or persistence behavior, security-sensitive behavior, destructive repository operations, and broad architecture rewrites. The dispatcher must not automate these issues.

Issues with `type:movement` should normally receive `risk:human-only` unless a human explicitly approves automation.

## Validation Profiles

### `validation:docs`

Use for docs-only changes.

Required:

- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

No gameplay source changes allowed.

### `validation:harness`

Use for prompts, policies, checklists, AGENTS, README, and workflow scripts.

Required:

- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

No gameplay source changes allowed.

### `validation:ui`

Use for visual or UI-only changes.

Required:

- `npm test`
- `npm run build`
- `npm run lint`
- browser smoke test or documented manual QA
- mobile or narrow viewport check if the UI changes visible layout

Movement and gameplay logic must not change.

### `validation:test`

Use for test-only passes.

Required:

- targeted test command if relevant
- `npm test`
- `npm run build`
- `npm run lint`

No gameplay behavior changes unless explicitly justified.

### `validation:gameplay`

Use for enemy behavior, combat, level rules, pickups, win/loss logic, and player-facing game behavior.

Required:

- focused tests for changed behavior
- `npm test`
- `npm run build`
- `npm run lint`
- documented manual gameplay QA

Do not touch `src/game/movement.js` unless the issue explicitly allows it.

### `validation:progression`

Use for XP, upgrades, rewards, campaign progression, carried state, and upgrade UI flow.

Required:

- focused progression or campaign tests
- `npm test`
- `npm run build`
- `npm run lint`
- browser or manual QA for victory -> reward/upgrade -> next level flow

No persistence unless explicitly approved.

### `validation:movement`

Use for movement, grid logic, collision, turn behavior, interpolation, spawning, or player control feel.

Required:

- full movement regression tests
- `npm test`
- `npm run build`
- `npm run lint`
- manual movement QA checklist
- human approval required by default

Issues with `validation:movement` should normally be gated by `risk:human-only` unless a human explicitly approves automation.

## Planner And Groomer Rules

- Planner must propose role, type, risk, and validation labels for every issue.
- Planner must not apply `automation-ready` automatically.
- Campaign Groomer must normalize role, type, risk, and validation labels.
- Campaign Groomer may make only the first safe Architect issue automation-ready unless a human explicitly approves a different first runnable issue.
- Campaign Groomer must keep Coder issues blocked until Architect or human gates are complete.
- Campaign Groomer must ensure only one issue in a campaign is automation-ready unless issues are genuinely independent.
- Campaign Groomer must add a Linear comment explaining queue order and human gates.

## PR Body Requirements

Future PRs must include:

- linked issue
- role
- type
- risk
- validation profile
- summary
- files changed
- tests run
- manual QA
- conflict risk
- visible UI expectation
- known limitations
