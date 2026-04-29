# Dry-Run Model Router Prompt

Use Linear MCP and GitHub when live inspection is available.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki dry-run model router for the next eligible issue in the
declared active project, or for a manually supplied issue ID or copied JSON
fixture. Follow `ops/context-manifest.md`, `ops/policies/model-routing.md`,
`ops/policies/context-economy.md`, `TASK_PROTOCOL.md`,
`VALIDATION_MATRIX.md`, and `SAFETY_BOUNDARIES.md`.

This is advisory only. Do not run Dispatcher, run Campaign Conductor, execute
agents, call a model-executing runner, edit files, open PRs, apply labels,
remove labels, mark issues Done, merge, enable auto-merge, or change GitHub or
Linear state.

## Required Output

Print:

- `RUN` or `DO NOT RUN`;
- next issue;
- active Linear project;
- role, type, risk, and validation;
- review cadence;
- `model_hint`;
- recommended model class: `frontier`, `cheap`, `local-ok`, or `human-only`;
- required identity: normal GitHub, Reviewer App, or human-only;
- recommended prompt;
- required context pack;
- validation profile;
- stop conditions;
- next human action.

## Routing Rules

Return `DO NOT RUN` when metadata is missing, duplicated, ambiguous, stale, or
contradictory. Required metadata includes active Linear project, issue state,
blockers, gate labels, exactly one `role:*`, `type:*`, `risk:*`, and
`validation:*` label, review cadence, `model_hint`, and a context pack or
copied metadata sufficient to name the required context pack.

Return `DO NOT RUN` for human gates, `human-only`, `risk:human-only`, stop
labels, unresolved blockers, missing cadence, missing context pack, PR
readiness gaps, draft PRs for paired-review Reviewer work, and linked-PR gaps
for Reviewer issues.

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

Reviewer issues that inspect PRs require Reviewer App identity. Human gates
require human-only identity. Ordinary repository work uses normal GitHub
identity.
