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

A Reviewer issue may be promoted only when the corresponding PR exists and is
ready for review:

- PR is open
- PR is not Draft
- PR metadata check and CI have passed when Reviewer policy requires passing checks
- pending checks block promotion when the Reviewer policy requires passing checks

The issue's blocked-by relation to the authoring Coder or Test issue may be
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

For legacy `blocked` label removal, the comment must also state that the label
was legacy dependency metadata, not a human gate or PR stop label.

Whenever the Conductor refuses to promote, it must comment with:

- missing labels
- unresolved blockers
- ambiguous candidates
- human action required

