# Validation Matrix

Level 6 keeps validation machine-readable by requiring every automated Linear issue to declare one role, one type, one risk, and one validation profile.

## Role Matrix

| Role label | Agent | Allowed work | Required output |
| --- | --- | --- | --- |
| `role:architect` | Architect | Review issue shape, architecture risk, dependencies, file ownership, and conflict risk. No implementation. | Linear comment or architecture notes. |
| `role:coder` | Coder | Implement exactly one eligible issue. | PR against `main`; Draft is allowed for incomplete or non-paired work, but paired-review producer PRs with passing validation must be ready for review. |
| `role:test` | Test | Add or improve tests without changing gameplay behavior unless explicitly justified. | PR against `main` or test-gap report; Draft is allowed for incomplete or non-paired work, but paired-review producer PRs with passing validation must be ready for review. |
| `role:reviewer` | Reviewer | Review PRs, validation, CI, and boundaries. Do not merge. | Review comment or Linear findings. |
| `role:release` | Release | Summarize completed work and campaign status. No gameplay changes. | Release or campaign summary. |

## Type Matrix

| Type label | Use for | Default risk | Typical validation |
| --- | --- | --- | --- |
| `type:docs` | Documentation-only changes. | `risk:low` | `validation:docs` |
| `type:harness` | Prompts, policies, checklists, workflows, templates, AGENTS, README. | `risk:low` | `validation:harness` |
| `type:ui` | Visual/UI-only or UI-copy work. | `risk:low` or `risk:medium` | `validation:ui` |
| `type:test` | Test-only passes. | `risk:low` | `validation:test` |
| `type:gameplay` | Enemy behavior, combat, pickups, level rules, win/loss behavior. | `risk:medium` or `risk:high` | `validation:gameplay` |
| `type:progression` | XP, upgrades, rewards, carried state, upgrade UI flow. | `risk:medium` or `risk:high` | `validation:progression` |
| `type:architecture` | Architecture review or boundary work. | `risk:low` to `risk:high` | `validation:docs` or `validation:harness` |
| `type:movement` | Movement, grid logic, collision, interpolation, spawning, control feel. | `risk:human-only` | `validation:movement` |

## Risk Matrix

| Risk label | Meaning | Automation allowed | Human approval |
| --- | --- | --- | --- |
| `risk:low` | Docs, harness, narrow UI copy, test-only, isolated helpers. | Yes, with complete Level 5 metadata. | Not normally required. |
| `risk:medium` | Normal gameplay, progression, level layout, UI behavior. | Yes, when acceptance criteria and validation are clear. | Sometimes required. |
| `risk:high` | Broad gameplay, central orchestration, campaign progression, AI, significant UI flow. | Only with strong tests and manual QA notes. | Often required. |
| `risk:human-only` | Movement rewrites, persistence, destructive repo work, broad architecture rewrites. | No. Dispatcher must not automate. | Required. |

`risk:high` and `risk:human-only` PRs are never auto-merge eligible. Use
`ops/policies/pr-acceptance.md` for PR acceptance tiers, forbidden categories,
reviewer independence, active auto-merge shakedown sequencing, and merge-label
gates.

## Validation Profiles

| Validation profile | Required automated checks | Manual QA | Human approval |
| --- | --- | --- | --- |
| `validation:docs` | `npm test`, `npm run build`, `npm run lint`, `git diff --check` | Read changed docs for clarity. | No, unless gated. |
| `validation:harness` | `npm test`, `npm run build`, `npm run lint`, `git diff --check` | Confirm workflows/prompts are unambiguous. | No, unless gated. |
| `validation:ui` | `npm test`, `npm run build`, `npm run lint` | Browser smoke test or documented manual QA; mobile/narrow viewport check if visible layout changes. | No, unless high-risk UI flow. |
| `validation:test` | Targeted test command if relevant, `npm test`, `npm run build`, `npm run lint` | Confirm tests did not alter gameplay behavior. | No, unless gated. |
| `validation:gameplay` | Focused behavior tests, `npm test`, `npm run build`, `npm run lint` | Documented manual gameplay QA. | Required when risk is high or gate labels exist. |
| `validation:progression` | Focused progression/campaign tests, `npm test`, `npm run build`, `npm run lint` | Victory -> reward/upgrade -> next level flow. | Required for persistence or broad carried-state changes. |
| `validation:movement` | Full movement regression tests, `npm test`, `npm run build`, `npm run lint` | Manual movement QA checklist. | Required by default. |

## Dispatcher Eligibility

An issue is eligible only when all are true:

- active Linear project is declared, or there is exactly one unambiguous
  eligible issue across visible Tanchiki projects
- issue is inside the declared active Linear project when one was supplied
- status is `Todo`
- has `automation-ready`
- has exactly one `role:*`, `type:*`, `risk:*`, and `validation:*` label
- does not have `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`
- is not blocked by another issue
- is not a parent, epic, campaign umbrella, or safety-critical item

Dispatcher eligibility does not imply merge eligibility. PR acceptance and any
future auto-merge path must also satisfy `ops/policies/pr-acceptance.md` and
`ops/checklists/pr-acceptance-checklist.md`.

Context-pack or `model_hint` guidance does not change Dispatcher eligibility.
Use `ops/policies/context-economy.md` and
`ops/policies/model-routing.md` plus
`ops/checklists/context-pack-checklist.md` and
`ops/checklists/model-routing-checklist.md` to shape context, but still enforce
exactly one role, type, risk, and validation profile plus all stop-label,
blocked-by, safety, PR metadata, and human-gate requirements.

## Model Routing

Allowed `model_hint` values are `model_hint: frontier`, `model_hint: cheap`,
`model_hint: local-ok`, and `model_hint: human-only`.

| Role/type/risk lane | Allowed model hints |
| --- | --- |
| Planner or Architect work | Usually `model_hint: frontier`; `model_hint: human-only` when gates require human handling. |
| Low-risk docs/test/harness Coder work | `model_hint: cheap` or `model_hint: local-ok` when bounded and validation is unchanged. |
| Gameplay/progression/rendering/movement Coder work | `model_hint: frontier`; use `model_hint: human-only` for movement/collision or gated safety work. |
| Low-risk docs/test Reviewer work | `model_hint: cheap` or `model_hint: frontier` depending on changed-file risk. |
| Trust-boundary, auto-merge, GitHub App, safety policy, CI/workflow, deployment, dependency, security, or protected-file Reviewer work | `model_hint: frontier`. |
| Release summaries from merged PR summaries and Linear comments | `model_hint: cheap` or `model_hint: local-ok` when low-risk and bounded. |
| Movement, collision, security, secrets, deployment, destructive repo operations, or repository settings | `model_hint: frontier` or `model_hint: human-only`. |

If the current model is below the required `model_hint`, the agent must stop
unless a human explicitly approves a downgrade. Local/cheap models may only be
used for bounded low-risk work. Validation requirements, PR metadata, Reviewer
gates, human gates, and safety docs do not change when using a cheaper or local
model.

## Campaign Conductor Eligibility

The Campaign Conductor may expose only one next campaign issue per run. It uses
the same Level 5 metadata requirements as the Dispatcher, plus campaign-order,
blocker, role-specific readiness, and PR-readiness checks from
`ops/policies/campaign-conductor.md`.

The Campaign Conductor requires an active Linear project, inspects only that
project, promotes issues only in that project, and stops if multiple Tanchiki
projects contain eligible `automation-ready` issues without a declared active
project.

The Conductor may repair a missing `role:*`, `type:*`, `risk:*`, or
`validation:*` label only when the exact label is explicitly stated in the issue
body. It must stop for absent or ambiguous metadata.
It must also inspect campaign notes, issue descriptions, grooming notes, and
Architect comments for one explicit review cadence before promotion.

Ordinary campaign dependencies should be represented by Linear blocked-by /
blocks relations. The `blocked` label is deprecated for normal dependency
sequencing. The Conductor may remove a legacy Linear issue `blocked` label only
when all blocked-by issues are `Done` or explicitly satisfied, no human gate
labels are present, Level 5 metadata is complete, campaign order is
unambiguous, and promotion exposes exactly one next issue. It must never remove
`needs-human-approval`, `human-only`, `risk:human-only`, or PR stop labels.

Role readiness summary:

- `role:architect`: may be promoted as the first safe campaign issue.
- human gate work: must not be auto-promoted as `automation-ready`.
- `role:coder`: requires required Architect and human gates to be Done.
- `role:test`: requires the preceding implementation PR to be merged or an
  explicit already-merged test target.
- `role:reviewer` with `paired-review`: requires an open, non-draft, unmerged
  linked PR with required checks passing when policy requires them.
- `role:reviewer` with `final-audit`: requires campaign implementation/test
  PRs to be merged or explicitly abandoned, upstream PR-producing issues to be
  Done or explicitly abandoned, and audit inputs to be available; merged PRs are
  expected audit inputs and are not blockers.
- `role:release`: requires implementation, test, reviewer, and human gates to
  be Done or the campaign to be explicitly stopped.

Paired-review PRs must be open, non-draft, unmerged, and passing required
checks before the paired Reviewer issue may run. Draft PRs block paired-review
Reviewer promotion. Stop labels are hard vetoes and must not be removed by
agents.

Campaign review cadence must be explicit:

- `final-audit`: a campaign-level Reviewer audits merged or explicitly
  abandoned campaign PRs near the end and uses `AUDIT PASSED`,
  `AUDIT PASSED WITH NOTES`, `HUMAN FOLLOW-UP REQUIRED`, or `BLOCKING FINDING`.
- `paired-review`: each PR-producing Coder/Test issue is followed by a Reviewer
  issue that inspects an open PR before merge and uses `APPROVED FOR
  AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`,
  `APPROVED FOR MERGE`, `CHANGES REQUESTED`, `HUMAN REVIEW REQUIRED`, or
  `BLOCKED`.
- `let-architect-decide`: Architect must choose `final-audit` or
  `paired-review` and record the reason in Linear before implementation issues
  are promoted.
