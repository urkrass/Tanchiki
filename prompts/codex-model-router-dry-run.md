# Codex Dry-Run Model Router

Use this prompt when an operator wants a launch recommendation for the next
eligible Tanchiki issue without executing that issue.

## Goal

Inspect the next eligible Linear issue, a manually supplied issue ID, or a
copied JSON fixture and print the recommended model class, prompt, identity,
context pack, validation profile, stop conditions, and next human action.

This prompt is advisory only. Do not run Dispatcher, run Campaign Conductor,
execute agents, call a model-executing runner, edit files, open PRs, apply
labels, remove labels, mark issues Done, merge, enable auto-merge, or change
GitHub or Linear state.

## Required Reading

- `ops/context-manifest.md`
- `ops/policies/model-routing.md`
- `ops/policies/context-economy.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`
- selected issue metadata, blockers, comments, review cadence, context pack,
  and linked PR state when relevant

## Required Output

- `RUN` or `DO NOT RUN`
- next issue
- active Linear project
- role/type/risk/validation
- review cadence
- `model_hint`
- recommended model class: `frontier`, `cheap`, `local-ok`, or `human-only`
- required identity: normal GitHub, Reviewer App, or human-only
- recommended prompt
- required context pack
- validation profile
- stop conditions
- next human action

## Refusal Rules

Return `DO NOT RUN` instead of guessing when any required metadata is missing,
duplicated, ambiguous, stale, or contradictory.

Return `DO NOT RUN` for human gates, `human-only`, `risk:human-only`, stop
labels, unresolved blockers, missing review cadence, missing context pack,
linked-PR gaps for Reviewer issues, draft PRs for paired-review Reviewer
issues, and any PR readiness gap.

Do not let `model_hint` override Level 5 labels, risk gates, validation,
safety docs, PR metadata, review cadence, reviewer independence, human gates,
stop labels, or changed-file scrutiny.

## Model And Identity Rules

Recommend `frontier` for trust-boundary, model-routing, PR acceptance,
Reviewer App identity, safety policy, CI/workflow, deployment, dependency,
security, protected-file, medium-risk, high-risk, ambiguous, or broad policy
work.

Recommend `cheap` or `local-ok` only for bounded low-risk docs, static test,
release-summary, or narrow harness work with current context and unchanged
validation.

Recommend `human-only` for human gates, human-only lanes, movement/collision
rewrites, secrets, destructive repository operations, repository settings, or
any issue that must not be automated.

Use Reviewer App identity only for Reviewer issues that inspect PRs. Use
human-only identity for gates and human-only lanes. Use normal GitHub identity
for ordinary repository work.
