# Task Protocol

This repo uses Linear for task state, GitHub for code review, and this repository as the operations source of truth.

## Linear Issue Selection

The Dispatcher scans Tanchiki `Todo` issues in the declared active Linear
project and selects one issue only.

Every Dispatcher run must provide an active project, for example:

```text
Active Linear project: Tanchiki / Harness — Token Economy
```

If active project is missing and exactly one eligible issue exists across
visible Tanchiki projects, the Dispatcher may report that project and selected
issue before acting. If active project is missing and multiple eligible issues
exist across Tanchiki projects, the Dispatcher stops. It must not run issues
from another campaign project.

Eligibility requires:

- `automation-ready`
- exactly one `role:*` label
- exactly one `type:*` label
- exactly one `risk:*` label
- exactly one `validation:*` label
- no `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`
- no unresolved blocked-by relation

If metadata is missing or duplicated, the Dispatcher stops and comments on the issue with the exact fields to fix.

## Linear Project Strategy

Tanchiki supports two Linear project modes:

- `main-project`: use `Tanchiki — Playable Tank RPG Prototype` for ordinary
  work, single issues, small fixes, and maintenance.
- `campaign-project`: use a dedicated project for multi-issue harness,
  product, release, or research campaigns, especially work with human gates,
  paired reviews, and Release summaries.

Dedicated campaign projects must use a Tanchiki prefix:

- `Tanchiki / Harness — <Campaign Name>`
- `Tanchiki / Game — <Campaign Name>`
- `Tanchiki / Release — <Campaign Name>`
- `Tanchiki / Research — <Campaign Name>`

If a campaign remains inside the main project, every issue body must clearly
state the campaign name. Planner must report Linear project mode, active Linear
project, campaign name, issue IDs created, first eligible issue, and whether
any automation-ready issues exist outside the active project.

Planner and Auto-Groomer operate only inside the declared active project.
Auto-Groomer must verify all campaign issues are in the same active project,
only one first issue is `Todo` + `automation-ready`, and no unexpected
`automation-ready` issue exists in another visible Tanchiki campaign project.
If campaign issues are split across projects, Auto-Groomer must stop for human
triage and must not move issues without explicit approval.

## Campaign Conductor

Use the Campaign Conductor when a campaign queue needs one safe promotion after
dependencies, human gates, or PR readiness change. The Conductor is a
single-step queue safety layer, not a campaign runner.

The Conductor may promote at most one next issue per run. It must not loop,
run Dispatcher, implement code, review PRs, merge PRs, apply
`merge:auto-eligible`, remove stop labels, or mark issues `Done` unless this
protocol explicitly allows it.

The Conductor requires an active Linear project. It inspects only the declared
active project, promotes issues only in that project, stops if active project is
missing or ambiguous, and stops if multiple Tanchiki projects contain eligible
`automation-ready` issues while the active project is not declared. It reports
the active project in its output and must not move issues across projects unless
explicitly instructed.

Promotion requires an unambiguous campaign order, exactly one next candidate,
exactly one `role:*`, `type:*`, `risk:*`, and `validation:*` label, no stop or
human-gate labels, and no unresolved blocker that still matters for the role.
Missing Level 5 labels may be repaired only when the exact label value is
explicitly stated in the issue body. The Conductor must not infer labels from
titles or surrounding campaign context.

Ordinary campaign sequencing uses Linear blocked-by / blocks relations, not the
`blocked` label. Planner and Groomer workflows should keep downstream issues in
`Backlog` with blocked-by relations and without `automation-ready`. For legacy
campaign issues, the Conductor may remove a Linear issue `blocked` label only
under the strict legacy-label rules in `ops/policies/campaign-conductor.md`;
it must never remove `needs-human-approval`, `human-only`, `risk:human-only`,
or PR stop labels.

Campaigns must declare a review cadence before promotion. The Conductor checks
campaign notes, issue descriptions, grooming notes, and Architect comments for
`review_cadence: final-audit`, `review_cadence: paired-review`, or
`review_cadence: let-architect-decide`:

- `paired-review`: each PR-producing Coder/Test issue is followed by a
  Reviewer issue that inspects an open PR before merge. Reviewer issues require
  a linked PR that is open, non-draft, unmerged, and has passing required checks
  when Reviewer policy requires passing checks. Draft PRs block Reviewer
  promotion.
- `final-audit`: a campaign-level Reviewer issue audits merged or explicitly
  abandoned campaign PRs near the end. Merged PRs are normal audit inputs, not
  blockers. The Reviewer does not approve merge retroactively.
- `let-architect-decide`: Architect must choose `final-audit` or
  `paired-review`, record the reason in Linear, and adjust downstream issues
  before implementation issues are promoted.

If the campaign starts with `review_cadence: let-architect-decide` and the
Architect later chooses `review_cadence: paired-review`, paired Reviewer issues
must be created, activated, or confirmed before any PR-producing Coder/Test
issue is promoted. The campaign must not proceed to implementation until the
paired-review queue is structurally complete. The Conductor must stop, rather
than repair the queue itself, when a paired Reviewer issue is missing or
unlinked.

If review cadence is missing or ambiguous, the Conductor stops and comments
asking for cadence triage. For `paired-review`, the Conductor must not promote
the next Coder/Test issue until the previous PR-producing issue and its paired
Reviewer issue are Done and the PR was merged or explicitly abandoned with a
recorded outcome. For `final-audit`, the Conductor must not require open PRs
and must promote the final-audit Reviewer only after upstream PR-producing
issues are Done or explicitly abandoned and implementation/test PRs are merged
or explicitly abandoned. The promotion comment must state: "Promoted as
final-audit Reviewer. Merged PRs are expected audit inputs."

For low-risk auto-merge burn-in campaigns, the Conductor may promote Coder,
Test, and Reviewer issues one at a time, but must stop at the human merge-label
gate and report: "Human must apply `merge:auto-eligible` using normal GitHub
identity."

Use:

- `prompts/codex-conduct-campaign.md`
- `ops/prompts/campaign-conductor.md`
- `ops/policies/campaign-conductor.md`
- `ops/policies/model-routing.md`
- `ops/checklists/campaign-conductor-checklist.md`

## Branch Creation

Agents that do repository work start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Create one branch per issue. Use a descriptive branch name that includes the Linear ID when practical.

## Implementation

- Work one issue only.
- Stay inside the selected role authority.
- Keep patches scoped and reversible.
- Do not include unrelated cleanup.
- Do not edit gameplay code from docs or harness issues.
- Do not modify `src/game/movement.js` unless explicitly approved.

## Validation

Run the validation profile declared by the issue. Baseline validation is:

```powershell
npm test
npm run build
npm run lint
```

Docs and harness changes also require:

```powershell
git diff --check
```

## Context Economy

Campaigns may use context packs to reduce repeated context rebuilding, but
context packs do not replace the authoritative protocol docs. Use
`ops/policies/context-economy.md`, `ops/policies/model-routing.md`,
`ops/checklists/context-pack-checklist.md`, and
`ops/checklists/model-routing-checklist.md` for campaign and issue context pack
templates, role-specific context budgets, context refresh rules, and advisory
`model_hint` guidance.

Token saving must never be used to skip required safety docs, Level 5 metadata,
validation, PR metadata, review cadence, changed-file scrutiny, or human gates.
Broad repo scans are allowed when safety or ambiguity requires them, but the
agent must record the reason in Linear, the PR body, the review note, or the
final summary.

Allowed hints are `model_hint: frontier`, `model_hint: cheap`,
`model_hint: local-ok`, and `model_hint: human-only`. Agents must stop if the
current model is below the required `model_hint` unless a human explicitly
approves a downgrade. Cheaper or local models are limited to bounded low-risk
docs, static test, release-summary, or narrow harness lanes. Validation
requirements, Reviewer gates, and human gates do not change when a cheaper or
local model is used.

## Pull Requests

Open a PR against `main`. Draft PRs are allowed while work is incomplete, for
exploratory work, for ordinary non-paired-review work, when validation has not
passed, or when the work is explicitly awaiting author completion. If the PR is
an explicitly scoped auto-merge candidate, auto-merge burn-in PR, or
`review_cadence: paired-review` producer PR with passing validation, mark it
ready for review before the Coder or Test session stops. Paired-review PRs must
be open, non-draft, unmerged, and passing required checks before the paired
Reviewer issue may run. Fill the PR template with:

- linked Linear issue
- active Linear project
- role, type, risk, validation profile
- summary
- files changed
- tests run
- manual QA
- conflict risk
- visible UI expectation
- known limitations

Do not merge automatically.

If a paired-review producer cannot mark the PR ready for review, it must keep
the PR Draft, explain the blocker clearly, and leave the paired Reviewer issue
unexposed. The Conductor must not promote the paired Reviewer issue until the
producer PR is ready for pre-merge review.

## CI And Review

CI must pass before merge. Reviewer agents inspect:

- PR metadata completeness
- declared validation profile compliance
- changed files and role boundaries
- gameplay or movement safety
- manual QA notes
- conflict risk

Reviewer agents do not merge and do not push commits.

Reviewers and humans must also apply `ops/policies/pr-acceptance.md` and
`ops/checklists/pr-acceptance-checklist.md` before adding acceptance labels or
preparing a PR for any auto-merge path. Coder and Test agents must not approve,
label as accepted, or merge their own PRs.
Reviewer agents must not approve PRs authored by the same Codex session or run,
must not approve their own prior work, and must return `HUMAN REVIEW REQUIRED`
when independence cannot be established.
Stop labels are hard vetoes. Agents may recommend stop-label removal in PR or
Linear comments, but only a human operator may remove stop labels unless a
future gate-management automation is explicitly approved.

## Merge

Merges are human-controlled unless the user explicitly delegates a merge and the repository policy allows it. Never merge while CI is failing or missing.

Auto-merge, when explicitly approved by a human and implemented by repository
policy, is limited to the narrow eligible categories in
`ops/policies/pr-acceptance.md`. It must not be available for movement or
collision work, `risk:high`, `risk:human-only`, deployment, dependencies, CI
workflow changes, broad gameplay changes, save or persistence behavior,
security-sensitive changes, or public-demo-impacting changes without explicit
human control. `merge:do-not-merge` always overrides positive acceptance labels.
Auto-merge shakedowns are only conclusive when the PR remains open through
independent Reviewer approval, human-applied `merge:auto-eligible`, and GitHub
auto-merge. A human early merge is valid as a normal merge but inconclusive as
an auto-merge shakedown.

## Done Rules

Move an implementation issue to `In Review` after its PR is open and the
required draft or ready-for-review posture is set. Do not mark it `Done` until
the PR is merged or a human explicitly approves closure.

PR-producing issues stay `In Review` while their PR is open. Coder and Test
issues should remain `In Review` while their PR is open. They may be marked
`Done` only after the linked PR is merged or explicitly abandoned with a
recorded outcome.

Paired Reviewer issues may move to `In Review` after their notes are posted,
but may be marked `Done` only after they post an allowed pre-merge decision and
the downstream action is recorded.

Final-audit Reviewer issues may move to `In Review` after audit findings are
posted, but may be marked `Done` only after audit findings are accepted or acted
on. Final-audit Reviewer decisions are `AUDIT PASSED`, `AUDIT PASSED WITH
NOTES`, `HUMAN FOLLOW-UP REQUIRED`, and `BLOCKING FINDING`.

Release issues may be marked `Done` only after their summary is posted and
accepted by a human or operator. Release issues run only after the appropriate
review cadence is complete.

Release summaries must record active Linear project, campaign name, issue list,
PR list, whether any issue moved between projects, and any remaining active
`automation-ready` issue in the campaign project.

Human gate issues are `Done` only after the human decision or action is
recorded.

## Campaign Closure

Do not close parent campaign issues until:

- all child issues are `Done`
- required reviewer work is complete
- release summary exists
- any human-only placeholders remain intentionally gated or are explicitly resolved
