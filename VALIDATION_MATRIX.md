# Validation Matrix

Level 6 keeps validation machine-readable by requiring every automated Linear issue to declare one role, one type, one risk, and one validation profile.

## Role Matrix

| Role label | Agent | Allowed work | Required output |
| --- | --- | --- | --- |
| `role:architect` | Architect | Review issue shape, architecture risk, dependencies, file ownership, and conflict risk. No implementation. | Linear comment or architecture notes. |
| `role:coder` | Coder | Implement exactly one eligible issue. | Draft PR against `main`. |
| `role:test` | Test | Add or improve tests without changing gameplay behavior unless explicitly justified. | Draft PR or test-gap report. |
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

- status is `Todo`
- has `automation-ready`
- has exactly one `role:*`, `type:*`, `risk:*`, and `validation:*` label
- does not have `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`
- is not blocked by another issue
- is not a parent, epic, campaign umbrella, or safety-critical item
