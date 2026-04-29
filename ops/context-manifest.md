# Context Manifest

This manifest is the repo-owned entry point for context loading in Tanchiki
agent workflows. Use it to keep operator prompts short while preserving the
full safety, validation, review, and Linear orchestration gates.

The manifest is an index and loading contract. It does not replace
`AGENTS.md`, `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`,
`SAFETY_BOUNDARIES.md`, PR acceptance policy, campaign-conductor policy,
active-project rules, Reviewer App rules, Linear issue metadata, or current
user instructions. If rules conflict, use the stricter rule and stop for
human or operator triage when the safe path is unclear.

## Purpose

Short prompts may point agents here instead of pasting long role protocols.
Agents still load the minimal necessary authoritative context for the current
role, issue, risk, validation profile, and review cadence.

Token saving must never skip safety-critical docs, Level 5 metadata,
validation profiles, PR metadata, changed-file scrutiny, review cadence,
blocked-by relations, stop labels, or human gates.

## Always-Load Context

Every agent starts with:

- current user instructions and `AGENTS.md`;
- declared active Linear project;
- selected Linear issue body, labels, blockers, comments, and linked PR state
  when relevant;
- `TASK_PROTOCOL.md`;
- `VALIDATION_MATRIX.md`;
- `SAFETY_BOUNDARIES.md`;
- this manifest.

Load `ARCHITECTURE.md` when ownership, protected movement, gameplay,
rendering, progression, UI behavior, or central-file conflict risk matters.

Load `ops/policies/pr-acceptance.md` and
`ops/checklists/pr-acceptance-checklist.md` for PR review, acceptance, labels,
auto-merge eligibility, Reviewer App identity, or stop-label questions.
For PR-producing roles, load `.github/PULL_REQUEST_TEMPLATE.md` as the exact
PR body heading source of truth. Agents must preserve exact heading spelling
and capitalization.

## Active-Project Context

Every Planner, Conductor, Dispatcher, Coder, Test, Reviewer, and Release run
requires an active Linear project unless the governing protocol explicitly
allows a single unambiguous fallback.

Agents must inspect, promote, dispatch, implement, review, and summarize only
inside the declared active project. Campaign issues should stay in one project.
If campaign issues are split across projects, stop for human triage unless a
human explicitly authorizes a move.

## Review-Cadence Context

Campaigns must declare exactly one review cadence:

- `review_cadence: paired-review`
- `review_cadence: final-audit`
- `review_cadence: let-architect-decide`

For `paired-review`, each PR-producing Coder or Test issue is followed by a
paired Reviewer issue before the next producer is exposed. The paired Reviewer
requires a linked PR that is open, non-draft, unmerged, and passing required
checks/metadata when policy requires them.

For `final-audit`, the Reviewer audits merged or explicitly abandoned campaign
PRs near the end and does not approve merge retroactively.

For `let-architect-decide`, implementation waits until Architect records
exactly one final cadence in Linear and the queue is materialized.

## Role-Specific Context

### Planner

Load the campaign brief, `ops/policies/campaign-factory.md`,
`ops/checklists/campaign-grooming-checklist.md`,
`ops/policies/context-economy.md`, `ops/policies/model-routing.md`,
`VALIDATION_MATRIX.md`, and `SAFETY_BOUNDARIES.md`.

Planner creates campaign context packs, issue context packs, dependency order,
review cadence, and advisory `model_hint` values. Planner must not expose
Coder, Test, Reviewer, Release, human-gated, blocked, or unresolved dependency
issues as `automation-ready`.

### Campaign Conductor

Load campaign order, grooming notes, context packs, issue states, labels,
blocked-by relations, review cadence, PR readiness evidence,
`ops/policies/campaign-conductor.md`,
`ops/checklists/campaign-conductor-checklist.md`, and
`ops/policies/model-routing.md`.

Conductor promotes at most one issue. It must not run Dispatcher, implement
code, review PRs, merge, apply `merge:auto-eligible`, remove stop labels,
remove human gates, move issues across projects, or infer missing Level 5
metadata unless the exact label is stated in the issue body.

### Dispatcher

Load Todo issues in the active project, `automation-ready`, issue labels,
blocked-by relations, stop labels, issue context pack, `TASK_PROTOCOL.md`, and
`VALIDATION_MATRIX.md`.

Dispatcher works one issue only. It stops if the candidate lacks exactly one
`role:*`, `type:*`, `risk:*`, or `validation:*` label, has unresolved blockers,
or has `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`.

### Coder

Load the selected issue body, issue context pack, direct blockers, campaign
context pack when present, listed files, `VALIDATION_MATRIX.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, `ops/checklists/pr-acceptance-checklist.md`,
required safety docs, relevant role prompts or policies, validation profile,
and PR metadata requirements.

Coder reads narrowly first and broadens only with a recorded reason. Harness
or docs issues must not change gameplay, movement, rendering, progression,
deployment, dependencies, CI workflows, repository settings, Reviewer App
permissions, or auto-merge behavior unless the issue explicitly scopes that
work and the required human gates are satisfied.

### Test Agent

Load the selected issue body, issue context pack, targeted test surface,
campaign context pack when present, `VALIDATION_MATRIX.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, `ops/checklists/pr-acceptance-checklist.md`,
safety docs, validation profile, and relevant files.

Test work must remain test-only unless the issue explicitly scopes behavior
changes. Do not change production behavior to satisfy static tests.

### Reviewer

Load the linked PR diff, PR metadata, linked Linear issue, validation evidence,
CI state, campaign context pack, `SAFETY_BOUNDARIES.md`,
`ops/policies/pr-acceptance.md`, and
`ops/checklists/pr-acceptance-checklist.md`.

Reviewer still inspects changed-file risk, protected files, role boundaries,
manual QA notes, stop labels, and reviewer independence. Reviewer must not
merge, push commits, approve its own work, apply `merge:auto-eligible`, remove
stop labels, or use Reviewer App credentials outside review identity.

### Release

Load merged or explicitly abandoned PR summaries, Linear comments, campaign
context pack, recorded review outcomes, human-gate outcomes, and
`ops/checklists/release-summary-checklist.md` when relevant.

Release must not summarize unresolved gates as complete and should not
rediscover the repo unless release inputs are missing, stale, or inconsistent.

## Campaign-Planning Context

Campaign context packs summarize one campaign. They should include goal,
non-goals, active project, review cadence, queue order, blocked-by relations,
human gates, paired-review points, release condition, Level 5 metadata, safety
context, file scope, validation, manual QA, known decisions, model hint, broad
scan rules, and stop conditions.

Issue context packs are smaller. They should include role authority, goal,
current state, upstream decisions, required reads, likely files, forbidden
files, validation profile, PR posture, visible UI expectation, central-file
conflict risk, model hint, and stop conditions.

Context packs are handoffs. They do not override authoritative docs or current
Linear state.

## Gameplay And UI Context

Load `ARCHITECTURE.md` before work that touches game ownership, UI behavior,
rendering, progression, movement, combat, AI, level data, central files, or
manual gameplay QA.

Docs, harness, UI-copy, and test-only issues must not change gameplay behavior,
movement, progression, level tuning, deployment, dependencies, CI workflows, or
source files outside their explicit scope. `src/game/movement.js` is protected
and requires explicit movement scope, movement validation, and a human gate.

Visible UI expectation must be recorded for PR-producing issues, even when the
answer is "No visible UI changes."

## Harness And Policy Context

Load focused files from `ops/policies/`, `ops/checklists/`, `ops/prompts/`,
and `prompts/` according to the current role. Prefer precise sections and
directly relevant files over broad rediscovery.

Broad policy, prompt, or checklist changes that affect role authority, PR
acceptance, model routing, active-project behavior, review cadence, or
Reviewer App identity need conservative review and should usually use
`model_hint: frontier`.

## Reviewer App Context

Reviewer App identity is only for Reviewer-agent PR inspection, comments, and
reviews. Credentials, private keys, local env files, and generated tokens must
stay outside the repository and must not be printed, committed, or written to
repo files.

Reviewer App credentials must not be used for coding, pushing commits, merging,
applying `merge:auto-eligible`, removing stop labels, enabling auto-merge,
changing workflows, changing repository settings, changing branch protection,
or modifying secrets. Human merge-label sessions must use the normal GitHub
identity.

## Model-Routing Context

Allowed hints are:

- `model_hint: frontier`
- `model_hint: cheap`
- `model_hint: local-ok`
- `model_hint: human-only`

`model_hint` is advisory for cost and routing, but it is a hard stop when the
current model is below the required hint unless a human-approved downgrade is
recorded. It cannot override role/type/risk/validation labels, validation
commands, PR metadata, safety docs, human gates, stop labels, review cadence,
reviewer independence, or changed-file scrutiny.

Use frontier models for trust-boundary, ambiguous, medium-risk, high-risk,
PR acceptance, Reviewer App, CI/workflow, deployment, dependency, security,
protected-file, or central policy work. Cheap or local models are candidates
only for bounded low-risk docs, static test, release-summary, or narrow
harness work with current context and unchanged validation.

## Broad-Scan Justification Rule

Avoid broad repo scans when the issue context pack and listed files are enough.
Broad scans are allowed when safety, ambiguity, stale context, unexpected diff
scope, validation failure, protected files, PR readiness, or release inputs
require them.

Record the reason for any broad repo scan in Linear, the PR body, the review
note, or the final summary.

## Missing-Context Stop Rule

Stop and ask for human or operator triage when required context is missing,
inaccessible, stale, ambiguous, or contradictory.

Stop when context packs conflict with current user instructions,
`TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, `SAFETY_BOUNDARIES.md`, review
cadence, active-project rules, human gates, stop labels, or PR readiness.

Stop when the issue lacks exactly one role/type/risk/validation label, when
`model_hint` conflicts with Level 5 metadata, when the current model is below
the required hint without a recorded human downgrade, or when a cheaper/local
lane would hide safety-critical context.

Stop when requested work includes protected movement, gameplay, rendering,
progression, deployment, dependencies, CI workflows, repository settings,
Reviewer App permissions, auto-merge behavior, secrets, or destructive
operations outside explicit issue scope and required gates.
