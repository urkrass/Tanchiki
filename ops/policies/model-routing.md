# Model Routing Policy

Use this policy when assigning or checking `model_hint` in campaign context
packs, issue context packs, Planner output, Groomer comments, Dispatcher
routing, and Campaign Conductor promotion notes.

Model routing is advisory for cost control, but it is a hard safety signal when
the current model is below the required hint. It never overrides Level 5
metadata, validation profiles, safety docs, PR metadata, review cadence, human
gates, reviewer independence, stop labels, or changed-file scrutiny.
It also does not override `ops/context-manifest.md`; agents must still load the
manifest-required context and stop when required context is missing or
ambiguous.

## Model Hint Values

- `model_hint: frontier` - use a frontier model for trust-boundary, ambiguous,
  medium-risk, high-risk, safety-sensitive, or broad reasoning work.
- `model_hint: cheap` - a cheaper cloud model is acceptable for bounded
  low-risk routine docs, static test, release-summary, or narrow harness work.
- `model_hint: local-ok` - a local model is acceptable only for bounded
  low-risk routine docs, static test, release-summary, or narrow harness work
  where the context pack is current and validation is unchanged.
- `model_hint: human-only` - do not automate. A human must handle or explicitly
  approve a new safe automation route before any agent proceeds.

## Role Defaults

- Planner: usually `model_hint: frontier`.
- Architect: usually `model_hint: frontier`.
- Coder, low-risk docs/test/harness: `model_hint: cheap` or
  `model_hint: local-ok` when scope is bounded and validation is unchanged.
- Coder, gameplay/progression/rendering/movement: `model_hint: frontier`, or
  `model_hint: human-only` when normal safety gates require it.
- Reviewer, low-risk docs/test: `model_hint: cheap` or `model_hint: frontier`
  depending on changed-file risk and reviewer independence requirements.
- Reviewer, trust-boundary, auto-merge, GitHub App, safety policy, CI/workflow,
  deployment, dependencies, security, or protected-file work:
  `model_hint: frontier`.
- Release: `model_hint: cheap` or `model_hint: local-ok` when summarizing
  completed low-risk work from merged PR summaries and Linear comments.
- Movement, collision, security, secrets, deployment, dependencies, CI
  workflows, repository settings, and destructive operations:
  `model_hint: frontier` or `model_hint: human-only`.

## Dry-Run Router

The dry-run model router is advisory only. It may inspect the next eligible
Linear issue, copied issue metadata, or a JSON fixture and print a launch
recommendation. It must not execute agents, run Dispatcher, run Campaign
Conductor, edit files, open PRs, apply labels, remove labels, mark issues Done,
merge, enable auto-merge, or call a model-executing runner.

The recommendation must print these fields:

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

The router must return `DO NOT RUN` when issue metadata is ambiguous,
incomplete, duplicated, stale, or contradictory. Required metadata includes
exactly one `role:*`, `type:*`, `risk:*`, and `validation:*` label, one explicit
review cadence, active Linear project, issue state, blockers, gate labels,
`model_hint`, and the context pack or enough copied metadata to name the
required context pack.

The router must also return `DO NOT RUN` for human gates, `human-only`,
`risk:human-only`, stop labels, unresolved blockers, missing or ambiguous
review cadence, PR readiness gaps for Reviewer issues, missing linked PRs for
paired-review Reviewer issues, draft PRs for paired-review Reviewer issues, or
any request to weaken validation, risk gates, stop-label handling, Reviewer App
identity, Campaign Conductor separation, or Dispatcher separation.

Model choice is derived from the stricter of `model_hint`, Level 5 metadata,
changed-file risk, and safety context:

- recommend `frontier` for trust-boundary, model-routing, PR acceptance,
  Reviewer App identity, safety policy, CI/workflow, deployment, dependency,
  security, protected-file, medium-risk, high-risk, ambiguous, or broad policy
  work;
- recommend `cheap` or `local-ok` only for bounded low-risk docs, static test,
  release-summary, or narrow harness work with current context and unchanged
  validation;
- recommend `human-only` for human gates, `human-only`, `risk:human-only`,
  movement/collision rewrites, secrets, destructive repository operations,
  repository settings, or any issue that must not be automated.

Identity choice is also gated:

- Coder, Test, Architect, Release, and non-PR-inspecting advisory work use the
  normal GitHub identity when repository access is needed.
- Reviewer issues that inspect PRs require Reviewer App identity.
- Human gates and human-only lanes require human-only identity.

The dry-run router may recommend the next prompt to run, such as Dispatcher,
Reviewer App Dispatcher, Campaign Conductor, Release, or a human action. That
recommendation is text only; it must not invoke that workflow.

## Downgrade And Stop Rules

- If the current model is below the required `model_hint`, stop unless a human
  explicitly approves the downgrade in Linear or the current prompt.
- Agents must stop if the current model is below the required `model_hint` unless a human explicitly approves the downgrade in Linear or the current prompt.
- A human-approved downgrade must not change validation commands, PR metadata,
  review cadence, safety docs, human gates, stop labels, or reviewer
  independence.
- Local/cheap models may only be used for bounded low-risk work with current
  context packs and narrow file scope.
- `model_hint: human-only` means automation must stop even if the issue has
  other valid-looking metadata.
- If `model_hint` conflicts with role/type/risk/validation metadata, use the
  stricter path and ask for triage.

## Disallowed Uses

Do not use `model_hint` to:

- bypass `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, or
  `SAFETY_BOUNDARIES.md`;
- bypass `ops/context-manifest.md`;
- infer missing Level 5 labels;
- skip validation or PR metadata;
- skip changed-file scrutiny or protected-file checks;
- skip human gates or stop labels;
- approve reviewer independence;
- justify broad gameplay, movement, deployment, dependency, CI, repository
  setting, security, or auto-merge changes.
