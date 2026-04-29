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
- remove stop labels
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
- the issue has no `blocked` label
- the issue has no unresolved blocker that still matters for that role
- the issue has no stop labels

If more than one possible next issue exists, stop and ask for human triage.

Stop labels include:

- `merge:do-not-merge`
- `merge:human-required`
- `needs-human-approval`
- `blocked`
- `human-only`
- `risk:human-only`

Stop labels are hard vetoes. Agents may recommend stop-label removal in a
Linear or PR comment, but must not remove stop labels.

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
Done. It must not be promoted if blocked by unresolved prior work, or if its
type, risk, or validation profile requires human approval.

### Test

A Test issue may be promoted when the preceding implementation PR is merged or
when the issue explicitly says it tests an already-merged artifact. Test issues
must remain test-only and must not change product behavior.

### Reviewer

A Reviewer issue may be promoted only when the corresponding PR exists and is
ready for review:

- PR is open
- PR is not Draft
- PR metadata check and CI have passed when Reviewer policy requires passing checks
- pending checks block promotion when the Reviewer policy requires passing checks

The issue's blocked relation to the authoring Coder or Test issue may be
treated as satisfied only when the linked PR is open, non-draft, and checks are
passing or accepted by policy. If the PR is Draft, do not promote; comment that
the Coder or human must mark it ready first.

### Release

A Release issue may be promoted only after implementation, test, reviewer, and
human gate steps are Done or the campaign has been explicitly stopped. If the
campaign ended inconclusively, Release may summarize the inconclusive result.

## Issue Completion Rules

- Coder and Test issues should remain `In Review` while their PR is open.
- Coder and Test issues may be marked `Done` only after the linked PR is merged
  or explicitly abandoned with a recorded outcome.
- Reviewer issues may be marked `Done` only after they post an allowed decision
  and the downstream action is recorded.
- Release issues may be marked `Done` only after the summary is posted and
  accepted by a human or operator.
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
- which blockers were satisfied
- which PR/check evidence was used
- what the next expected Dispatcher role is

Whenever the Conductor refuses to promote, it must comment with:

- missing labels
- unresolved blockers
- ambiguous candidates
- human action required

