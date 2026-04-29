# Context Economy Policy

Use this policy to reduce repeated context loading in Tanchiki harness campaigns
without weakening Level 5 validation, safety boundaries, PR metadata, review
cadence, or human gates.

Context economy is an input-shaping aid. It is not authority to skip required
docs, ignore changed-file risk, bypass validation, shorten PR metadata, remove
human gates, or override the current Linear issue.

`ops/context-manifest.md` is the short-prompt context-loading source of truth.
Context packs should point agents to the manifest and the narrow role-specific
docs they need; they must not replace the manifest, safety-critical docs,
current Linear state, PR state, or current user instructions.

## Campaign Context Pack

A campaign context pack is a compact, durable summary for one multi-issue
campaign. Store it in the campaign project, the first Architect issue, or a
clearly linked grooming comment. It should prevent every role from rereading the
same broad repo process while preserving access to the authoritative docs.

Template:

```markdown
## Campaign Context Pack

Campaign:
Goal:
Non-goals:
Review cadence:
Cadence reason:

## Queue
- Order:
- Blocked-by dependencies:
- Human gates:
- Paired-review points:
- Release condition:

## Level 5 Metadata
- Role labels:
- Type labels:
- Risk labels:
- Validation profiles:

## Required Safety Context
- Mandatory docs:
- Safety boundaries:
- Human gates:
- Protected files:

## File Scope
- Relevant files:
- Forbidden files:
- Central-file conflict risk:
- Visible UI expectation:

## Validation
- Required commands:
- Manual QA:
- PR metadata requirements:

## Known Decisions
- Approved decisions:
- Open questions:
- Follow-up work:

## Model Hint
- Suggested lane:
- Reason:
- Restrictions:

## Context Refresh
- Refresh when:
- Broad scans allowed when:
- Stop and ask when:
```

## Issue Context Pack

An issue context pack is the smallest safe slice needed to run one role. Put it
in the Linear issue body or a linked Linear comment. It should reference the
campaign context pack instead of repeating it.

Template:

```markdown
## Issue Context Pack

Issue:
Role authority:
Goal:
Current state:
Upstream decisions:

## Required Reads
- Issue body and labels:
- Campaign context pack:
- Safety docs required for this risk/type:
- Direct blocker or paired-review notes:

## File Scope
- Likely files:
- Forbidden files:
- Protected files:
- Central-file conflict risk:
- Visible UI expectation:

## Validation
- Validation profile:
- Commands:
- Manual QA:
- PR metadata:

## Review And Sequence
- Review cadence:
- PR posture:
- Next blocker:
- Release impact:

## Model Hint
- Suggested lane:
- Advisory only:
- Must escalate when:

## Stop Conditions
- Missing context:
- Conflicting rules:
- Human gates:
- Unexpected file changes:
```

## Required Safety Context

Context packs must keep these sources visible and mandatory when relevant:

- `AGENTS.md` and current user instructions.
- `TASK_PROTOCOL.md` for Linear selection, branches, PRs, CI, review, merge, and
  Done rules.
- `VALIDATION_MATRIX.md` for Level 5 role/type/risk/validation rules.
- `SAFETY_BOUNDARIES.md` for protected files, human gates, gameplay safety, and
  repository safety.
- `ARCHITECTURE.md` when ownership, protected movement, gameplay, rendering,
  progression, or central-file risk matters.
- `ops/policies/model-routing.md` when `model_hint` affects routing, model
  suitability, or downgrade decisions.
- `ops/policies/pr-acceptance.md` and
  `ops/checklists/pr-acceptance-checklist.md` for PR review or acceptance work.
- `ops/policies/campaign-conductor.md` and
  `ops/checklists/campaign-conductor-checklist.md` for queue promotion.
- The Linear issue body, labels, blockers, comments, and linked PR state.

Safety-critical docs cannot be skipped. Token saving never overrides
validation, PR metadata, safety boundaries, review cadence, changed-file risk,
stop labels, or human gates. Missing, stale, ambiguous, or contradictory
required context is a stop condition.

## Context To Avoid Unless Needed

Avoid loading or pasting these by default:

- Full repo file listings for narrow docs, harness, or test issues.
- Full historical issue chains beyond direct blockers, paired reviewers, and
  release inputs.
- Complete policy or README text when a precise section reference is enough.
- Unrelated gameplay architecture for docs-only or harness-only work.
- Full test logs when command names and pass/fail evidence are enough.
- All prior campaign notes when known decisions can be summarized.

This is a default, not a ban. Broader context is allowed when justified.

## Broad Repo Scans

Broad repo scans require a recorded reason in the Linear comment, PR body,
review note, or final summary.

Allowed reasons include:

- The context pack is missing, stale, contradictory, or incomplete.
- Safety-critical docs may have changed.
- The issue touches or risks central or protected files.
- Labels, blockers, review cadence, or PR readiness are ambiguous.
- A PR diff contains unexpected files.
- Validation fails and the root cause is unclear.
- A Reviewer must assess changed-file risk.
- A Conductor must verify promotion safety.
- A Release issue lacks merged PR or Linear comment inputs.

## Role-Specific Context Budgets

Planner:

- Read the campaign brief, required safety docs, and campaign execution rules.
- Create the campaign context pack, issue context pack skeletons, dependency
  order, review cadence, and advisory `model_hint` values.
- Do not use context economy to apply `automation-ready` broadly.

Architect:

- Read the issue, campaign context, safety docs, and enough repo policy to
  evaluate risk.
- Refine the context pack, confirm cadence, identify protected files and
  conflict risks, and define model-routing boundaries.

Coder:

- Start from the issue context pack, listed files, required safety docs, and
  direct dependencies.
- Read narrowly first and broaden only with a recorded reason.
- Do not implement gameplay, movement, rendering, progression, deployment,
  dependency, CI workflow, repo setting, or auto-merge changes from docs or
  harness issues.

Test:

- Start from the issue context pack and targeted test surface.
- Keep work test-only unless the issue explicitly scopes behavior changes.
- Do not change production behavior to satisfy static tests.

Reviewer:

- Start from PR diff, linked issue, context pack, validation evidence, and PR
  metadata.
- Still inspect changed-file risk, protected files, CI, metadata, independence,
  stop labels, manual QA, and safety boundaries.
- Token saving must never reduce diff scrutiny.

Release:

- Start from merged PR summaries, Linear comments, campaign context pack, and
  recorded review outcomes.
- Do not rediscover the repo unless release inputs are missing or inconsistent.
- Do not summarize unresolved gates as complete.

Conductor:

- Start from campaign order, blockers, cadence, issue labels/state, and PR
  readiness evidence.
- Promote at most one issue.
- Do not infer missing Level 5 metadata from campaign context unless the exact
  label is in the issue body.
- Do not remove human gates or PR stop labels.

Dispatcher:

- Use issue labels, blockers, state, and the issue context pack to route one
  issue.
- Still enforce `Todo`, `automation-ready`, exactly one role/type/risk/validation
  label, no stop or human gate labels, and no unresolved blockers.
- Stop on ambiguity instead of filling gaps from context-pack assumptions.

Dry-run model router:

- Inspect one next eligible issue or a manually supplied metadata fixture and
  print advisory launch instructions only.
- Do not execute agents, run Dispatcher, run Campaign Conductor, edit files,
  open PRs, apply labels, remove labels, mark issues Done, merge, enable
  auto-merge, or call a model-executing runner.
- Refuse incomplete or ambiguous metadata instead of guessing from surrounding
  context.
- Preserve Campaign Conductor and Dispatcher separation; the router may
  recommend a prompt as the next human action but must not invoke it.
- Require Reviewer App identity for Reviewer issues that inspect PRs, normal
  GitHub identity for ordinary repository work, and human-only identity for
  gates or human-only lanes.

## Model Hints

Use one explicit `model_hint` value in campaign and issue context packs:
`model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, or
`model_hint: human-only`.

`model_hint` is advisory for routing and cost, but the agent must stop when
the current model is below the required hint unless a human explicitly approves
a downgrade. It never overrides role/type/risk labels, validation profile,
required safety docs, human approval, PR readiness, reviewer independence,
stop labels, changed-file scrutiny, or PR metadata.

Use a frontier model for:

- new protocol or trust-boundary work;
- medium or higher risk unless a human explicitly approves a cheaper lane;
- Architect issues involving model routing, PR acceptance, security, Reviewer
  App identity, CI/workflows, deployment, dependencies, movement, or protected
  files;
- paired-review Reviewer issues;
- ambiguous Conductor or Dispatcher promotion decisions;
- any issue with conflicting context.

Cheaper or local models may be candidates only when all are true:

- issue is `risk:low`;
- issue type is routine docs, static test, or narrow harness wording;
- context pack is current and approved;
- file list is narrow and excludes protected or central high-risk files unless
  explicitly approved;
- no human gate, trust-boundary change, PR acceptance change, CI/workflow
  change, deployment, dependency, security, movement, rendering, gameplay,
  progression, or repo setting work is involved;
- validation requirements remain unchanged and executable by the agent.

Use `model_hint: human-only` for work that must not be automated, including
movement/collision rewrites, security-sensitive secrets or credentials,
destructive repository operations, repository settings, or any issue with
human-only gate labels.

Good `model_hint: cheap` or `model_hint: local-ok` candidates include
release-summary drafting from merged PR summaries, low-risk static wording
checks, narrow docs copy updates that do not change policy authority, and
mechanical checklist consistency updates after a frontier-reviewed policy
decision.

## Context Refresh

Refresh or broaden context when:

- a blocker is completed or a paired-review PR is merged or abandoned;
- issue labels, scope, or comments change;
- `main` advances across relevant docs, prompts, or tests;
- safety docs or central policy files change;
- validation fails unexpectedly;
- PR diff differs from the issue file list;
- `model_hint` conflicts with risk/type/validation;
- any human gate or stop label appears.

## Stop And Ask Conditions

Stop and ask for human or operator input when:

- context pack conflicts with `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`,
  `SAFETY_BOUNDARIES.md`, or current user instructions;
- safety-critical docs are missing or inaccessible;
- issue lacks exactly one role/type/risk/validation label;
- `model_hint` suggests a cheaper/local model for a medium-risk, high-risk, or
  trust-boundary issue;
- a human gate or stop label blocks work;
- requested files include protected movement, gameplay, deployment,
  dependencies, CI workflows, repo settings, or auto-merge behavior outside the
  explicit issue scope;
- broad scans reveal scope drift;
- Reviewer independence cannot be established.
