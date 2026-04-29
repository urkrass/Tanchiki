# Campaign Conductor Checklist

Use this checklist for one Campaign Conductor run.

- [ ] Confirm the operator or campaign context declares `Active Linear project: <Tanchiki project name>`.
- [ ] Stop if the active Linear project is missing or ambiguous.
- [ ] Inspect only the declared active Linear project.
- [ ] Promote issues only in the declared active Linear project.
- [ ] Stop if multiple Tanchiki projects contain eligible `automation-ready` issues and the active project is not declared.
- [ ] Do not move issues across projects unless explicitly instructed.
- [ ] Report the active Linear project in the output.
- [ ] Read the active campaign issues in Linear.
- [ ] Read dependency order, blocked-by relations, current statuses, labels, and issue bodies.
- [ ] Use the campaign context pack and issue context packs when present, but
      verify labels, state, blockers, cadence, stop labels, and PR readiness
      directly.
- [ ] Do not infer missing Level 5 metadata from context packs unless the exact
      label appears in the issue body.
- [ ] Record the reason for any broad repo scan in the promotion or refusal
      comment.
- [ ] Inspect linked GitHub PRs when PR readiness affects promotion.
- [ ] Identify review cadence before any promotion by inspecting campaign notes, issue descriptions, grooming notes, and Architect comments.
- [ ] Confirm the cadence is exactly one of `review_cadence: paired-review`, `review_cadence: final-audit`, or `review_cadence: let-architect-decide`.
- [ ] If review cadence is missing or ambiguous, stop and add a Linear comment asking for cadence triage.
- [ ] If review cadence is `let-architect-decide`, promote only Architect cadence-decision work until Architect chooses `final-audit` or `paired-review` and records the reason in Linear.
- [ ] If Architect already recorded `review_cadence: final-audit` or `review_cadence: paired-review` in an issue body or comment, use that decision.
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
- [ ] Confirm the candidate has no unresolved blocker that still matters for the role.
- [ ] Inspect blocked-by relations directly and treat `Done` blockers as satisfied.
- [ ] Stop if blocked-by state is ambiguous or exposes more than one possible next issue.
- [ ] If a legacy `blocked` label is present, remove it only when the policy's strict legacy-label conditions are met.
- [ ] If removing a legacy `blocked` label, add a Linear comment explaining satisfied blockers and why only one next issue is exposed.
- [ ] Confirm no human gate labels or PR stop labels are present.
- [ ] Do not remove `needs-human-approval`, `human-only`, `risk:human-only`, or PR stop labels.
- [ ] For Architect, confirm it is the first safe issue exposed by Planner or Groomer.
- [ ] For human gate work, do not promote; report the required human action.
- [ ] For Coder, confirm required Architect and human gates are Done.
- [ ] For Coder, confirm unresolved prior work does not still block promotion.
- [ ] For Test, confirm the implementation PR is merged or the issue explicitly tests an already-merged artifact.
- [ ] For Test, confirm the issue remains test-only and not product-changing.
- [ ] For paired-review Reviewer, confirm the linked PR exists.
- [ ] For paired-review Reviewer, confirm the linked PR is open.
- [ ] For paired-review Reviewer, confirm the linked PR is not Draft.
- [ ] For paired-review Reviewer, confirm the linked PR is unmerged.
- [ ] For paired-review Reviewer, confirm required PR metadata checks and CI are passing before promotion.
- [ ] For paired-review Reviewer, confirm the upstream Coder/Test issue is `In Review`, not prematurely `Done`.
- [ ] For paired-review Reviewer, confirm metadata is complete and no human gate or stop label blocks review.
- [ ] For paired-review Reviewer promotion, comment: "Promoted as paired-review Reviewer for open PR #X."
- [ ] For paired-review sequencing, do not promote the next Coder/Test issue until the previous PR-producing issue is Done, the paired Reviewer issue is Done, and the PR was merged or explicitly abandoned with a recorded outcome.
- [ ] For final-audit Reviewer, do not require open PRs.
- [ ] For final-audit Reviewer, confirm upstream PR-producing issues are Done or explicitly abandoned before promotion.
- [ ] For final-audit Reviewer, confirm implementation/test PRs are merged or explicitly abandoned before promotion.
- [ ] For final-audit Reviewer, confirm implementation/test PRs are available for audit before promotion.
- [ ] For final-audit Reviewer, treat merged PRs as expected audit inputs.
- [ ] For final-audit Reviewer, do not use paired-review pre-merge approval language.
- [ ] For final-audit Reviewer promotion, comment: "Promoted as final-audit Reviewer. Merged PRs are expected audit inputs."
- [ ] If the linked PR is Draft, do not promote and comment: "PR #X is still Draft. In paired-review mode, the producer must mark the PR ready for review before the Reviewer issue can run."
- [ ] For Release, confirm implementation, test, the appropriate review cadence, and human gate steps are Done or explicitly stopped.
- [ ] Promote at most one issue.
- [ ] Confirm the promoted issue is inside the active Linear project.
- [ ] Do not run Dispatcher.
- [ ] Do not implement code.
- [ ] Do not review PRs.
- [ ] Do not merge PRs.
- [ ] Do not apply `merge:auto-eligible`.
- [ ] Do not create a looping campaign runner.
- [ ] For low-risk auto-merge burn-in, stop at the human merge-label gate and report: "Human must apply `merge:auto-eligible` using normal GitHub identity."
- [ ] If a prior burn-in result was inconclusive but the campaign continues,
      cite the explicit operator continuation record in the promotion comment.
- [ ] Keep Coder/Test issues `In Review` while their PR is open.
- [ ] Recommend PR-producing Coder/Test issues `Done` only after the PR is confirmed merged or the recorded outcome allows it.
- [ ] Recommend paired Reviewer issues `Done` only after the review decision is posted and acted on.
- [ ] Recommend final-audit Reviewer issues `Done` only after audit findings are posted and accepted or acted on.
- [ ] Add a Linear comment for every promotion, metadata repair, or legacy `blocked` label removal with changed fields, eligibility reason, satisfied blockers, PR/check evidence, and next expected Dispatcher role.
- [ ] Add a Linear comment for every refusal with missing labels, blockers, ambiguity, and human action required.
