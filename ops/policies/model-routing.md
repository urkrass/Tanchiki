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
