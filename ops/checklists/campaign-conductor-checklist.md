# Campaign Conductor Checklist

Use this checklist for one Campaign Conductor run.

- [ ] Read the active campaign issues in Linear.
- [ ] Read dependency order, blocked-by relations, current statuses, labels, and issue bodies.
- [ ] Inspect linked GitHub PRs when PR readiness affects promotion.
- [ ] Confirm campaign order is unambiguous.
- [ ] Confirm exactly one next candidate exists.
- [ ] Confirm the candidate has exactly one `role:*` label or an explicitly repairable omission.
- [ ] Confirm the candidate has exactly one `type:*` label or an explicitly repairable omission.
- [ ] Confirm the candidate has exactly one `risk:*` label or an explicitly repairable omission.
- [ ] Confirm the candidate has exactly one `validation:*` label or an explicitly repairable omission.
- [ ] Repair a missing Level 5 label only when the exact label appears in the issue body.
- [ ] Do not guess labels from title, neighboring issues, project defaults, or prior campaigns.
- [ ] Confirm the candidate has no `needs-human-approval`.
- [ ] Confirm the candidate has no `human-only`.
- [ ] Confirm the candidate has no `risk:human-only`.
- [ ] Confirm the candidate has no `blocked` label.
- [ ] Confirm the candidate has no unresolved blocker that still matters for the role.
- [ ] Confirm no stop labels are present.
- [ ] Do not remove stop labels.
- [ ] For Architect, confirm it is the first safe issue exposed by Planner or Groomer.
- [ ] For human gate work, do not promote; report the required human action.
- [ ] For Coder, confirm required Architect and human gates are Done.
- [ ] For Coder, confirm unresolved prior work does not still block promotion.
- [ ] For Test, confirm the implementation PR is merged or the issue explicitly tests an already-merged artifact.
- [ ] For Test, confirm the issue remains test-only and not product-changing.
- [ ] For Reviewer, confirm the linked PR exists.
- [ ] For Reviewer, confirm the linked PR is open.
- [ ] For Reviewer, confirm the linked PR is not Draft.
- [ ] For Reviewer, confirm required PR metadata checks and CI are passing before promotion.
- [ ] If the linked PR is Draft, do not promote and comment that Coder or human must mark it ready first.
- [ ] For Release, confirm implementation, test, reviewer, and human gate steps are Done or explicitly stopped.
- [ ] Promote at most one issue.
- [ ] Do not run Dispatcher.
- [ ] Do not implement code.
- [ ] Do not review PRs.
- [ ] Do not merge PRs.
- [ ] Do not apply `merge:auto-eligible`.
- [ ] Do not create a looping campaign runner.
- [ ] For low-risk auto-merge burn-in, stop at the human merge-label gate and report: "Human must apply `merge:auto-eligible` using normal GitHub identity."
- [ ] Keep Coder/Test issues `In Review` while their PR is open.
- [ ] Recommend Coder/Test and Reviewer `Done` only after the PR is confirmed merged or the recorded outcome allows it.
- [ ] Add a Linear comment for every promotion or repair with changed fields, eligibility reason, satisfied blockers, PR/check evidence, and next expected Dispatcher role.
- [ ] Add a Linear comment for every refusal with missing labels, blockers, ambiguity, and human action required.

