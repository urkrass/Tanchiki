# Campaign Factory Policy

Use this policy when a human submits a self-service campaign request through `.github/ISSUE_TEMPLATE/campaign-request.yml` or an equivalent pasted brief.

The campaign factory is an intake, planning, and grooming workflow. It does not authorize implementation, source edits, dependency additions, pull requests, merges, or Done-state changes.

## Inputs

A valid request should provide:

- campaign name
- Linear project mode: `main-project` or `campaign-project`
- active Linear project name
- goal
- current state
- requested campaign shape
- constraints and do-not-touch list
- primary request category
- review cadence
- human approval gates
- validation expectations
- visible UI expectation
- non-goals
- expected Planner + Auto-Groomer output

If required fields are missing, the factory must not guess. Create or report a human-gated clarification item before planning implementation work.

## Linear Project Strategy

Campaign planning supports two valid Linear project modes:

- `main-project`: use the existing main project,
  `Tanchiki — Playable Tank RPG Prototype`. This is best for ordinary product
  issues, small fixes, maintenance, and simple one-off tasks.
- `campaign-project`: create or use a dedicated Linear project for a major
  campaign. This is best for multi-issue campaigns with an Architect / Human
  gate / Coder-Test / Reviewer / Release sequence.

Dedicated campaign projects must use a clear Tanchiki prefix. Recommended
patterns:

- `Tanchiki / Harness — <Campaign Name>`
- `Tanchiki / Game — <Campaign Name>`
- `Tanchiki / Release — <Campaign Name>`
- `Tanchiki / Research — <Campaign Name>`

Examples:

- `Tanchiki / Harness — Token Economy`
- `Tanchiki / Harness — Reviewer App Routine`
- `Tanchiki / Game — Visual Identity`
- `Tanchiki / Release — Public Demo`

If a campaign is created inside the main project, the campaign name must be
clearly stated in every issue body.

Planner must not casually create a new Linear project. A new campaign project
is allowed only when all are true:

- the campaign is multi-issue;
- the user requested or accepted `campaign-project` mode;
- the project name follows the Tanchiki naming convention;
- the Planner reports the active Linear project name.

Planner output must include:

- Linear project mode: `main-project` or `campaign-project`;
- Active Linear project: exact project name;
- campaign name;
- issue IDs created;
- first eligible issue;
- whether any automation-ready issues exist outside the active project.

Planner must add the active project name to the campaign grooming comment, the
campaign context pack when present, and release summary expectations.

## Intake Classification

Classify the request before creating Linear issues:

- `safe planning request`: docs, prompts, templates, harness policy, checklists, static validation, or low-risk UI copy.
- `needs-human-approval`: gameplay behavior, progression, level tuning, dependency additions, CI browser checks, screenshot pass/fail gates, public-demo release flow, broad architecture, or ambiguous product decisions.
- `human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations, broad rewrites, or anything that requires human judgment before automation.

Mixed requests must be split so unsafe or ambiguous decisions become human gate
issues. Downstream implementation stays in Backlog with blocked-by relations
until the gate is resolved.

## Review Cadence Modes

Campaign creation must choose or defer a review cadence explicitly. Downstream
agents must not infer what a Reviewer issue means from title shape alone.

Allowed modes:

- `final-audit`: A campaign-level Reviewer issue audits the complete campaign
  near the end. Expected inputs are merged or explicitly abandoned campaign PRs.
  Merged PRs are normal and not a blocker. Reviewer does not approve merge
  retroactively. Allowed audit decisions are `AUDIT PASSED`,
  `AUDIT PASSED WITH NOTES`, `HUMAN FOLLOW-UP REQUIRED`, and
  `BLOCKING FINDING`.
- `paired-review`: Each PR-producing Coder/Test issue is followed by its own
  Reviewer issue. Reviewer inspects an open PR before merge. The PR must be
  open, non-draft, unmerged, and have required checks/metadata according to
  policy. Allowed pre-merge decisions are `APPROVED FOR AUTO-MERGE AFTER HUMAN
  APPLIES merge:auto-eligible`, `APPROVED FOR MERGE`, `CHANGES REQUESTED`,
  `HUMAN REVIEW REQUIRED`, and `BLOCKED`.
- `let-architect-decide`: Planner may use this when the campaign request is
  unclear. Architect must choose `final-audit` or `paired-review` and record the decision in Linear with the reason before implementation issues are promoted. Architect must adjust downstream issues before implementation issues are promoted.

## Cadence Materialization

If a campaign starts with `review_cadence: let-architect-decide` and the
Architect later chooses `review_cadence: paired-review`, paired Reviewer issues
must be created, activated, or confirmed before any PR-producing Coder/Test
issue is promoted. The campaign must not proceed to implementation until the
paired-review queue is structurally complete.

Architect output for a deferred cadence must include exactly one final decision:

- `review_cadence: final-audit`
- `review_cadence: paired-review`

If Architect chooses `review_cadence: paired-review`, the Architect must list
every PR-producing Coder/Test issue that needs a paired Reviewer issue and
state:

- paired Reviewer issue title;
- which Coder/Test issue it reviews;
- expected role/type/risk/validation;
- whether Reviewer App identity is required;
- dependency order;
- whether the issue already exists or must be created.

Planner and Auto-Groomer must handle conditional paired-review issues in one of
two safe ways:

- Option A - create placeholder paired Reviewer issues during initial planning.
  If cadence is `let-architect-decide` and the campaign contains medium-risk
  UI/gameplay/trust-boundary Coder/Test issues, create placeholder paired
  Reviewer issues in Backlog. Keep them non-automation-ready until Architect
  confirms paired-review. If Architect later chooses final-audit, mark or
  comment on placeholders as skipped/not-needed through a human or Architect
  comment.
- Option B - require queue expansion after Architect decision. If Architect
  chooses paired-review and paired Reviewer issues do not exist, the Conductor
  must stop and request queue materialization. A Planner/Groomer repair pass must create the missing paired Reviewer issues before implementation proceeds.

Prefer Option A when feasible because placeholder Reviewer issues avoid missing
gates.

Require or strongly recommend `paired-review` for PR acceptance / auto-merge
policy, Reviewer App / identity / token workflow, GitHub permissions, secrets
or credentials handling, CI/workflows, deployment, dependencies,
security-sensitive or trust-boundary work, movement/collision, `risk:medium` or
higher unless Architect justifies `final-audit`, anything touching
`src/game.js`, anything touching `src/render.js`, anything touching
`src/game/movement.js`, and broad architecture changes.

`final-audit` is acceptable for low-risk docs campaigns, low-risk harness
docs/checklist campaigns, low-risk test-only campaigns, routine release notes,
campaigns where individual PRs are manually reviewed and merged normally, and
retrospective campaign summaries.

## Planning Rules

Planner output must create small Linear issues rather than broad campaign umbrellas. Use 6-8 issues when the request is campaign-sized.

Every issue must include:

- Goal
- Current state
- Files likely involved
- Scope
- Do-not-touch list
- Acceptance criteria
- Tests required
- Validation commands
- Manual QA
- Risk level
- Suggested labels
- Role label
- Type label
- Risk label
- Validation profile
- Review cadence
- Dependency order
- Visible UI expectation
- Central-file conflict risk

Issues must stay small enough for one Level 4 role pass. Do not create vague tasks such as "improve gameplay", "add campaign", or "polish systems".

Planner must recommend a review cadence for every campaign and include it in
the campaign summary, relevant issue descriptions, dependency order, and
grooming notes. Reviewer issue titles must make the cadence clear. Use titles
like `Reviewer: paired-review PR for <issue id/title>` for a pre-merge review
and `Reviewer: final audit for <campaign name>` for a campaign-level audit.

## Level 5 Metadata

Every automated issue must have exactly one label from each group:

- role: `role:architect`, `role:coder`, `role:test`, `role:reviewer`, or `role:release`
- type: one `type:*` label from `VALIDATION_MATRIX.md`
- risk: one `risk:*` label from `VALIDATION_MATRIX.md`
- validation: one `validation:*` label from `VALIDATION_MATRIX.md`

Use:

- `needs-human-approval` for decision gates
- `human-only` and `risk:human-only` where automation must never run
- Linear blocked-by / blocks relations for dependency-blocked issues
- `automation-ready` only for the single issue the dispatcher may run next

Do not use deprecated `agent-ready` routing for new campaign factory work. Do
not use `human-review` to mean reviewer-agent work. Do not use the `blocked`
label for ordinary campaign dependency sequencing.

## Grooming Rules

After issue creation, the Planner must run the Campaign Groomer before stopping.

The groomed queue must satisfy:

- all campaign issues are in the declared active Linear project
- exactly one issue in the dependency chain is `Todo` + `automation-ready`
- the first exposed issue is the first safe Architect issue unless a human explicitly approved another safe first issue
- Coder issues remain Backlog with blocked-by relations until Architect and human gates are complete
- Test issues remain Backlog with blocked-by relations until implementation PRs are merged or ready
- Reviewer issues remain Backlog with blocked-by relations until implementation or test PRs exist
- Release issues remain Backlog with blocked-by relations until review is complete
- no unresolved dependency, gated, human-only, parent, umbrella, or `risk:human-only` issue has `automation-ready`
- no unexpected `automation-ready` issue exists in another visible Tanchiki
  campaign project
- cross-project dependencies are avoided unless explicitly documented

Campaign requests must never directly promote Coder work to `automation-ready`.

If campaign issues are split across projects, Auto-Groomer must stop and ask for
human triage. It may move issues between projects only with explicit approval.

Grooming must shape dependencies according to review cadence:

- For `paired-review`, each PR-producing Coder/Test issue blocks its paired
  Reviewer issue, each paired Reviewer issue blocks the next Coder/Test issue,
  and Release waits until all paired reviewers and PR-producing issues are
  Done.
- For `final-audit`, Coder/Test issues may proceed sequentially after their PRs
  are merged, a single final-audit Reviewer issue runs after implementation/test
  PRs are merged or explicitly abandoned, and Release waits for the final-audit
  Reviewer.
- For `let-architect-decide`, implementation issues must remain blocked until
  Architect records `final-audit` or `paired-review` in Linear and the queue is
  updated.

When paired-review is selected after a deferred Architect decision, the updated
queue must use this dependency chain for every PR-producing issue:

```text
Coder/Test issue A
-> paired Reviewer issue A
-> next Coder/Test issue B
```

The next implementation issue must not be unblocked merely because issue A
opened a PR. It must wait until the PR exists, the paired Reviewer issue
exists, the paired Reviewer has run, the PR is merged or explicitly abandoned,
and the producer issue is Done.

Paired Reviewer issues created by planning or repair must include:

- `review_cadence: paired-review`
- linked producer issue;
- expected PR state: open, non-draft, unmerged, checks passing;
- paired-review decision language:
  - `APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`
  - `APPROVED FOR MERGE`
  - `CHANGES REQUESTED`
  - `HUMAN REVIEW REQUIRED`
  - `BLOCKED`
- role/type/risk/validation labels;
- `model_hint`;
- Reviewer App identity requirement if applicable.

## Human Gates

Human approval is required before automation for:

- movement, collision, spawning, or control-feel work
- persistence or save behavior
- dependency additions
- destructive repository operations
- broad architecture rewrites
- broad AI rewrites or campaign-wide enemy behavior changes
- progression balance or carried-state changes
- public-demo release decisions that depend on product judgment
- screenshot or visual checks used as required pass/fail CI gates

When a gate is required, create a dedicated human approval issue with `needs-human-approval`. If automation must never run it, also use `human-only` and `risk:human-only`.

## Safety Boundaries

The factory must not:

- edit gameplay code during planning
- modify `src/game/movement.js`
- change movement, collision, shooting, enemy AI, level difficulty, progression, or upgrade behavior from a docs or harness issue
- add dependencies without a human approval gate
- open a PR during planning
- merge anything
- mark issues `Done`

Implementation remains a separate Dispatcher step after grooming and approval.

## Final Report

After creating and grooming a campaign, report:

- Linear project mode
- active Linear project
- campaign name
- issue identifiers and titles
- role/type/risk/validation for each issue
- selected or deferred review cadence
- dependency order
- first eligible issue
- blocked-by dependencies
- human approval gates
- visible UI expectations
- central-file conflict risks
- whether any automation-ready issues exist outside the active project
- next human action

Stop after the report. Do not implement the campaign during intake.
