# Task Protocol

This repo uses Linear for task state, GitHub for code review, and this repository as the operations source of truth.

## Linear Issue Selection

The Dispatcher scans Tanchiki `Todo` issues and selects one issue only.

Eligibility requires:

- `automation-ready`
- exactly one `role:*` label
- exactly one `type:*` label
- exactly one `risk:*` label
- exactly one `validation:*` label
- no `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`
- no unresolved blocked-by relation

If metadata is missing or duplicated, the Dispatcher stops and comments on the issue with the exact fields to fix.

## Campaign Conductor

Use the Campaign Conductor when a campaign queue needs one safe promotion after
dependencies, human gates, or PR readiness change. The Conductor is a
single-step queue safety layer, not a campaign runner.

The Conductor may promote at most one next issue per run. It must not loop,
run Dispatcher, implement code, review PRs, merge PRs, apply
`merge:auto-eligible`, remove stop labels, or mark issues `Done` unless this
protocol explicitly allows it.

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

Campaigns must declare a review cadence before Reviewer promotion:

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

If review cadence is missing or ambiguous, the Conductor stops and comments
asking for cadence triage. For `paired-review`, the Conductor must not promote
the next Coder/Test issue until the previous PR-producing issue and its paired
Reviewer issue are Done. For `final-audit`, the Conductor must not require open
PRs and must promote the final-audit Reviewer only after implementation/test
PRs are merged or explicitly abandoned.

For low-risk auto-merge burn-in campaigns, the Conductor may promote Coder,
Test, and Reviewer issues one at a time, but must stop at the human merge-label
gate and report: "Human must apply `merge:auto-eligible` using normal GitHub
identity."

Use:

- `prompts/codex-conduct-campaign.md`
- `ops/prompts/campaign-conductor.md`
- `ops/policies/campaign-conductor.md`
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

## Pull Requests

Open a draft PR against `main` by default. Normal feature PRs may remain Draft
when appropriate. If the PR is an explicitly scoped auto-merge candidate or
auto-merge burn-in PR, mark it ready for review before the Coder session stops
because Draft PRs are hard vetoes for auto-merge approval. Fill the PR template
with:

- linked Linear issue
- role, type, risk, validation profile
- summary
- files changed
- tests run
- manual QA
- conflict risk
- visible UI expectation
- known limitations

Do not merge automatically.

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

Human gate issues are `Done` only after the human decision or action is
recorded.

## Campaign Closure

Do not close parent campaign issues until:

- all child issues are `Done`
- required reviewer work is complete
- release summary exists
- any human-only placeholders remain intentionally gated or are explicitly resolved
