# Campaign Execution Policy

Use this policy for multi-issue campaigns and Level 2 command-center runs.

## Active Linear Project

Campaign execution must name one active Linear project before Planner,
Auto-Groomer, Campaign Conductor, Dispatcher, or Release work starts.

Valid modes:

- `main-project`: use `Tanchiki — Playable Tank RPG Prototype` for ordinary
  work, single issues, small fixes, and maintenance.
- `campaign-project`: use a dedicated campaign project for multi-issue harness,
  product, release, or research campaigns, especially when human gates and
  paired reviews are involved.

Dedicated campaign projects must follow a Tanchiki naming convention:

- `Tanchiki / Harness — <Campaign Name>`
- `Tanchiki / Game — <Campaign Name>`
- `Tanchiki / Release — <Campaign Name>`
- `Tanchiki / Research — <Campaign Name>`

Planner, Auto-Groomer, Campaign Conductor, Dispatcher, and Release agents must
operate only in the declared active project. If the active project is missing
and multiple Tanchiki projects contain eligible `automation-ready` issues, the
agent must stop and ask for human triage. Agents must not move issues across
projects unless explicitly instructed.

## Sequential Execution

Campaigns with dependency chains must expose only the next automation issue as `Todo` + `automation-ready` with exactly one `role:*`, one `type:*`, one `risk:*`, and one `validation:*` label.

- Parent, epic, and campaign umbrella issues must not have `automation-ready`.
- Issues with unresolved blocked-by relations must not be selected.
- Issues labeled `needs-human-approval` must not be automated until a human removes the gate and applies `automation-ready`.
- Issues labeled `human-only` must not be automated.
- Issues labeled `risk:human-only` must not be automated.
- Planners must groom the queue after creating campaign issues. During grooming, they may apply `automation-ready` only to the single first runnable issue allowed by this policy.
- The single exposed issue must be inside the declared active Linear project.

If the Linear queue violates these rules, stop and report the queue problem before implementing.

## Label Taxonomy

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Issue type labels:

- `type:docs`
- `type:harness`
- `type:ui`
- `type:test`
- `type:gameplay`
- `type:progression`
- `type:architecture`
- `type:movement`

Risk labels:

- `risk:low`
- `risk:medium`
- `risk:high`
- `risk:human-only`

Validation profile labels:

- `validation:docs`
- `validation:harness`
- `validation:ui`
- `validation:test`
- `validation:gameplay`
- `validation:progression`
- `validation:movement`

Gate labels:

- `needs-human-approval`
- `human-only`
- `risk:human-only`

Review cadence modes:

- `final-audit`: a campaign-level Reviewer issue audits the complete campaign
  near the end. Expected inputs are merged or explicitly abandoned campaign PRs.
  Merged PRs are normal and not a blocker. The Reviewer does not approve merge
  retroactively and uses `AUDIT PASSED`, `AUDIT PASSED WITH NOTES`,
  `HUMAN FOLLOW-UP REQUIRED`, or `BLOCKING FINDING`.
- `paired-review`: each PR-producing Coder/Test issue is followed by its own
  Reviewer issue. The Reviewer inspects an open PR before merge. The PR must be
  open, non-draft, unmerged, and have required checks/metadata according to
  policy. Coder/Test producers may create Draft PRs while work is incomplete,
  but after validation passes they must mark paired-review PRs ready for review
  before stopping. The Reviewer uses `APPROVED FOR AUTO-MERGE AFTER HUMAN
  APPLIES merge:auto-eligible`, `APPROVED FOR MERGE`, `CHANGES REQUESTED`,
  `HUMAN REVIEW REQUIRED`, or `BLOCKED`.
- `let-architect-decide`: Planner may use this when the campaign request is
  unclear. Architect must choose `final-audit` or `paired-review`, record the
  decision in Linear with the reason, and adjust downstream issues before
  implementation issues are promoted.

If a campaign starts with `review_cadence: let-architect-decide` and Architect
later records `review_cadence: paired-review`, the paired-review queue must be
materialized before implementation promotion. Paired Reviewer issues must be
created, activated, or confirmed for every PR-producing Coder/Test issue before
any PR-producing Coder/Test issue is promoted.

Dependency source of truth:

- Use Linear blocked-by / blocks relations for ordinary campaign sequencing.
- Keep downstream campaign issues in `Backlog` without `automation-ready` until promoted.
- Do not use the `blocked` label for normal campaign dependencies.

Deprecated ambiguous usage:

- Do not use `agent-ready` for new campaign execution routing.
- Do not use `human-review` to mean reviewer-agent work.
- Do not use `blocked` for ordinary campaign dependency sequencing; treat it as a legacy label only.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.
- Do not create ambiguous Reviewer issues. Titles and issue bodies must state
  whether the Reviewer is `paired-review` or `final-audit`.

## Campaign Grooming

After a planner creates campaign issues, the Planner must run the Campaign Groomer workflow before stopping. The groomer normalizes the queue before automation starts:

- verify all campaign issues are in the declared active Linear project
- ensure each issue has exactly one applied `role:*` label where applicable
- ensure each issue has exactly one applied `type:*`, `risk:*`, and `validation:*` label where applicable
- ensure human gates use `needs-human-approval`
- ensure dependency-blocked issues use Linear blocked-by / blocks relations
- ensure never-automated human work uses `human-only`
- fix classification mismatches before automation starts
- ensure exactly one issue is `Todo` + `automation-ready` in each dependency chain
- ensure only one first issue is `Todo` + `automation-ready` in the active project
- ensure no unexpected `automation-ready` issue exists in another visible
  Tanchiki campaign project
- avoid cross-project dependencies unless explicitly documented
- ensure no issue has `automation-ready` together with `blocked`, `needs-human-approval`, or `human-only`
- ensure no issue with `risk:human-only` has `automation-ready`
- ensure parent and umbrella issues remain unready for automation
- add a grooming comment with queue order and human actions
- include review cadence in the campaign summary, relevant issue descriptions,
  dependency order, and grooming notes
- include active Linear project in the grooming comment and campaign context
  pack when present

If the campaign needs architecture review first, the groomer may make only the first safe Architect issue `Todo` + `role:architect` + `automation-ready` after assigning exactly one type, risk, and validation label. Coder issues must stay Backlog with blocked-by relations immediately after planning unless the user explicitly requested a Coder issue to run first.

If campaign issues are split across projects, Auto-Groomer must stop and ask for
human triage. It may move issues between projects only with explicit approval.

Downstream defaults:

- Coder issues stay Backlog with blocked-by relations until Architect and human gates are done.
- Test issues stay Backlog with blocked-by relations until implementation PRs are merged or ready.
- Reviewer issues stay Backlog with blocked-by relations until implementation/test PRs exist.
- Release issues stay Backlog with blocked-by relations until review is done.

Review cadence dependency defaults:

- `paired-review`: Coder/Test issue blocks its paired Reviewer issue; paired
  Reviewer issue blocks the next Coder/Test issue; Release waits until all
  paired reviewers and PR-producing issues are Done. Example order: Architect,
  Human gate, Coder A, Reviewer A, Coder B, Reviewer B, Test, Reviewer Test,
  Release.
- `final-audit`: Coder/Test issues may proceed sequentially after their PRs are
  merged; one final-audit Reviewer issue runs after implementation/test PRs are
  merged or explicitly abandoned; Release waits for final-audit Reviewer.
  Example order: Architect, Human gate, Coder A, Coder B, Test, Final-audit
  Reviewer, Release.
- `let-architect-decide`: implementation issues stay blocked until Architect
  chooses `final-audit` or `paired-review`, records the decision in Linear, and
  downstream dependencies are adjusted.

When Architect converts `let-architect-decide` to `paired-review`, Auto-Groomer
must confirm one of these safe states before exposing implementation work:

- placeholder paired Reviewer issues already exist in Backlog and are linked to
  every PR-producing Coder/Test issue; or
- a Planner/Groomer queue repair has created the missing paired Reviewer
  issues.

The paired-review dependency chain is:

```text
Coder/Test issue A
-> paired Reviewer issue A
-> next Coder/Test issue B
```

The next implementation issue waits until issue A's PR exists, the paired
Reviewer issue exists, the paired Reviewer has run, the PR is merged or
explicitly abandoned, and the producer issue is Done.
The next implementation issue must not be unblocked merely because issue A opened a PR.

Use `paired-review` for PR acceptance / auto-merge policy, Reviewer App /
identity / token workflow, GitHub permissions, secrets or credentials handling,
CI/workflows, deployment, dependencies, security-sensitive or trust-boundary
work, movement/collision, `risk:medium` or higher unless Architect justifies
`final-audit`, anything touching `src/game.js`, anything touching
`src/render.js`, anything touching `src/game/movement.js`, and broad
architecture changes.

Use `final-audit` for low-risk docs campaigns, low-risk harness docs/checklist
campaigns, low-risk test-only campaigns, routine release notes, campaigns where
individual PRs are manually reviewed and merged normally, and retrospective
campaign summaries.

## Issue Completion Rules

- PR-producing issues stay `In Review` while their PR is open.
- PR-producing issues become `Done` only after PR merge or recorded
  abandonment.
- Paired Reviewer issues become `Done` after the review decision is posted and
  acted on.
- Final-audit Reviewer issues become `Done` after audit findings are posted and
  accepted or acted on.
- Release issues run only after the appropriate review cadence is complete.

Release summaries must record the active Linear project, campaign name, issue
list, PR list, whether any issue moved between projects, and any remaining
active `automation-ready` issue in the campaign project.

## Branch Freshness

Before creating a task branch, run:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Create the task branch from updated `main`. Target PRs at `main` unless a human explicitly gives another base.

## Conflict-Risk Review

Before editing, inspect recent merged PRs or git history. A simple local check is:

```powershell
gh pr list --state merged --limit 5 --json number,title,mergedAt,headRefName,url
git show --name-only --format="%h %s" --stat HEAD~5..HEAD
```

If the issue touches files changed by the previous one to three merged PRs, report the conflict risk in the working update and PR body.

## Central Integration Files

`src/game.js` and `test/game.test.js` are integration points. Repeatedly adding feature logic there creates avoidable merge churn.

When several sequential issues need the same central files, prefer a seam-extraction issue before more feature work. Candidate seams include:

- progression-specific helpers
- campaign progression helpers
- player stats helpers
- reward helpers
- focused test files

The seam issue should preserve behavior and reduce future central-file edits.

## Internal-Only Visibility

For internal-only issues, state clearly that no visible UI change is expected. If visible UI is expected by the user, identify the later UI issue that will expose the internal work.

## PR Conflict Resolution

Resolve PR conflicts on the PR branch. Never resolve them by editing `main` directly.

Preserve both sides of behavior, validate with `npm test`, `npm run build`, and `npm run lint`, then push the PR branch. Do not merge automatically.

## Level 5 Validation

Use `ops/policies/risk-gated-validation.md` and `ops/checklists/risk-gate-checklist.md` to choose and verify validation profiles. Harness work must use harness-only validation and must not edit gameplay code.

## Dev Server Port

If `npm run dev` reports that port `5173` is occupied, first check whether the existing server works. If it does not, provide a clear command to stop the process and retry. Do not report occupied port alone as app failure.
