# Campaign Conductor Policy

Use this policy for single-step campaign auto-promotion after Planner and
Campaign Groomer work has created a campaign queue.

The Campaign Conductor is not a campaign runner. It is a queue safety layer that
may expose exactly one next issue to the Dispatcher after checking metadata,
dependency state, human gates, and PR readiness.

## Single-Step Authority

Per run, the Conductor may promote at most one next issue.

The Conductor must not:

- loop through multiple issues
- run Dispatcher itself
- implement code
- review PRs
- merge PRs
- apply `merge:auto-eligible`
- remove human gate labels or PR stop labels
- create a looping autonomous campaign runner

## Promotion Eligibility

The Conductor may promote an issue only when all are true:

- campaign order is unambiguous
- exactly one next candidate exists
- exactly one `role:*` label is present or safely repairable
- exactly one `type:*` label is present or safely repairable
- exactly one `risk:*` label is present or safely repairable
- exactly one `validation:*` label is present or safely repairable
- the issue has no `needs-human-approval`
- the issue has no `human-only`
- the issue has no `risk:human-only`
- the issue has no unresolved blocker that still matters for that role
- the issue has no non-removable stop labels

If more than one possible next issue exists, stop and ask for human triage.

Stop labels include:

- `merge:do-not-merge`
- `merge:human-required`
- `needs-human-approval`
- `human-only`
- `risk:human-only`

Human gate labels and PR stop labels are hard vetoes. Agents may recommend
removal in a Linear or PR comment, but must not remove them.

## Dependency Source Of Truth

Ordinary campaign sequencing uses Linear blocked-by / blocks relations. Planner
and Groomer workflows must not add the `blocked` label for normal downstream
campaign dependencies.

The Conductor inspects blocked-by relations directly:

- blockers in `Done` are satisfied;
- blockers explicitly recorded as satisfied in the issue or campaign comments
  may be treated as satisfied;
- unresolved blockers stop promotion;
- ambiguous dependency state stops promotion.

## Review Cadence

The Conductor must inspect review cadence before any promotion. It must check
the active campaign, issue descriptions, grooming notes, and Architect comments
for one explicit cadence field:

- `review_cadence: paired-review`
- `review_cadence: final-audit`
- `review_cadence: let-architect-decide`

Allowed modes are `paired-review`, `final-audit`, and
`let-architect-decide`.

- `paired-review`: Each PR-producing Coder/Test issue is followed by its own
  Reviewer issue. The Reviewer inspects an open PR before merge.
- `final-audit`: A campaign-level Reviewer issue audits the complete campaign
  near the end. Expected inputs are merged or explicitly abandoned campaign PRs.
  Merged PRs are normal and not a blocker.
- `let-architect-decide`: Architect must choose `final-audit` or
  `paired-review`, record the decision in Linear with the reason, and adjust
  downstream issues before implementation issues are promoted.

If review cadence is missing or ambiguous, the Conductor must stop and add a
Linear comment asking for cadence triage.

If the recorded cadence is `let-architect-decide`, the Conductor may promote
only the Architect cadence-decision issue when it is the next safe issue. It
must not promote implementation, test, reviewer, or release issues until
Architect records `review_cadence: final-audit` or
`review_cadence: paired-review` in an issue body or Linear comment. Once that
decision exists, the Conductor may use it as the campaign cadence.

## Legacy `blocked` Label Handling

The `blocked` label is deprecated for ordinary campaign dependencies. For old
or already-created campaign issues, the Conductor may remove a legacy `blocked`
label only when all are true:

- all blocked-by issues are `Done` or explicitly satisfied;
- no `needs-human-approval` label is present;
- no `human-only` label is present;
- no `risk:human-only` label is present;
- exactly one `role:*` label exists;
- exactly one `type:*` label exists;
- exactly one `risk:*` label exists;
- exactly one `validation:*` label exists;
- campaign order is unambiguous;
- cadence rules allow promotion;
- promoting the issue would expose only one next issue.

When the Conductor removes a legacy `blocked` label, it must add a Linear
comment explaining why the label was removed, which blockers were satisfied,
and why promotion still exposes only one next issue. This exception does not
allow removing `needs-human-approval`, `human-only`, `risk:human-only`, or any
PR stop label.

## Safe Metadata Repair

The Conductor may add missing Level 5 labels only when the exact value is
explicitly stated in the issue body.

Allowed example:

```text
## Risk label
risk:low
```

If the Linear issue is missing `risk:low` and the issue body explicitly states
that exact label, the Conductor may add `risk:low`.

The Conductor must not guess metadata from title alone. It must not infer labels
from campaign neighbors, previous issues, project defaults, or common patterns.
If metadata is absent or ambiguous, stop and comment asking for human triage.

## Role-Specific Readiness

### Architect

An Architect issue may be promoted after Planner or Campaign Groomer exposes it
as the first safe issue. Architect is usually first in a campaign.

### Human Gate

Human gate issues must not be auto-promoted as `automation-ready`. The
Conductor must stop and report the required human action.

### Coder

A Coder issue may be promoted only after required Architect and human gates are
Done. It must not be promoted if blocked by unresolved prior work in Linear
blocked-by relations, or if its type, risk, or validation profile requires
human approval.

### Test

A Test issue may be promoted when the preceding implementation PR is merged or
when the issue explicitly says it tests an already-merged artifact. Test issues
must remain test-only and must not change product behavior.

### Reviewer

For `paired-review`, a Reviewer issue may be promoted only when the
corresponding PR exists and is ready for pre-merge review:

- PR is open
- PR is not Draft
- PR is unmerged
- PR metadata check and CI have passed when Reviewer policy requires passing checks
- pending checks block promotion when the Reviewer policy requires passing checks

The issue's blocked-by relation to the authoring Coder or Test issue may be
treated as satisfied only when the linked PR is open, non-draft, and checks are
passing or accepted by policy. If the PR is Draft, do not promote; comment that
the Coder or human must mark it ready first.
Draft PRs block Reviewer promotion.

For `paired-review`, do not promote the next Coder/Test issue until the previous
PR-producing issue is Done, its paired Reviewer issue is Done, and the PR was
merged or explicitly abandoned with a recorded outcome.

For `final-audit`, do not require open PRs. Promote the final-audit Reviewer
issue only after all are true:

- upstream PR-producing issues are Done or explicitly abandoned;
- campaign implementation/test PRs are merged or explicitly abandoned;
- campaign implementation/test PRs are available for audit;
- no human gates remain unresolved;
- role/type/risk/validation metadata are complete;
- exactly one next issue is eligible.

Treat merged PRs as expected audit inputs. Do not apply paired-review open-PR
rules to final-audit issues and do not use pre-merge approval language.

### Release

A Release issue may be promoted only after implementation, test, the
appropriate review cadence, and human gate steps are Done or the campaign has
been explicitly stopped. If the campaign ended inconclusively, Release may
summarize the inconclusive result.

## Issue Completion Rules

- PR-producing issues stay `In Review` while their PR is open.
- Coder and Test issues should remain `In Review` while their PR is open.
- PR-producing Coder and Test issues become `Done` only after PR merge or
  recorded abandonment.
- Coder and Test issues may be marked `Done` only after the linked PR is merged
  or explicitly abandoned with a recorded outcome.
- Paired Reviewer issues become `Done` after the review decision is posted and
  acted on.
- Final-audit Reviewer issues become `Done` after audit findings are posted and
  accepted or acted on.
- Release issues may be marked `Done` only after the summary is posted and
  accepted by a human or operator.
- Release issues run only after the appropriate review cadence is complete.
- Human gate issues are `Done` only after the human decision or action is
  recorded.

## Low-Risk Auto-Merge Burn-In

For low-risk auto-merge burn-in campaigns:

- The Conductor may promote Coder and Test issues one at a time.
- The Conductor may promote Reviewer issues only when the linked PR is open,
  non-draft, and checks are passing.
- The Conductor must not apply `merge:auto-eligible`.
- The Conductor must stop at the human merge-label gate and report:
  "Human must apply `merge:auto-eligible` using normal GitHub identity."
- After GitHub auto-merge completes, the Conductor may recommend marking the
  Coder/Test and Reviewer issues Done, but only if the PR is confirmed merged.

## Audit Trail

Whenever the Conductor promotes or repairs an issue, it must add a Linear
comment explaining:

- what it changed
- why the issue is now eligible
- which review cadence was used
- which blockers were satisfied
- which PR/check evidence was used
- what the next expected Dispatcher role is

For final-audit Reviewer promotion, the comment must include:
"Promoted as final-audit Reviewer. Merged PRs are expected audit inputs."

For paired-review Reviewer promotion, the comment must include:
"Promoted as paired-review Reviewer for open PR #X."

For legacy `blocked` label removal, the comment must also state that the label
was legacy dependency metadata, not a human gate or PR stop label.

Whenever the Conductor refuses to promote, it must comment with:

- missing labels
- unresolved blockers
- ambiguous candidates
- human action required

