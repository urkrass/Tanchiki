# Codex Conduct Campaign

Use Linear MCP and GitHub.

Run the Tanchiki Campaign Conductor for the active campaign.
Inspect campaign state.
Inspect the campaign review cadence before any promotion by checking campaign notes, issue descriptions, grooming notes, and Architect comments for `review_cadence: final-audit`, `review_cadence: paired-review`, or `review_cadence: let-architect-decide`.
Use the campaign context pack and issue context packs when present, but do not use them to skip campaign order, blockers, PR readiness, safety docs, or Level 5 metadata checks.
Record a reason before broad repo scans.
Promote exactly one next safe issue if eligible.
Repair only explicit metadata omissions from issue body.
Stop at human gates or ambiguity.
If review cadence is missing or ambiguous, stop and add a Linear comment asking for cadence triage.
Do not edit repo files.
Do not run Dispatcher.
Do not merge.
Do not mark Done unless the protocol explicitly allows it.
Report the promoted issue or the blocker.

Review cadence rules:

- `paired-review`: promote a Reviewer issue only when the linked PR exists, is open, non-draft, unmerged, checks/metadata are ready according to policy, the upstream issue is `In Review` rather than prematurely `Done`, and no human gate or stop label blocks review. Comment: "Promoted as paired-review Reviewer for open PR #X." If the linked PR is Draft, block with: "PR #X is still Draft. In paired-review mode, the producer must mark the PR ready for review before the Reviewer issue can run." Do not promote the next Coder/Test issue until the previous PR-producing issue is Done, its paired Reviewer issue is Done, and the PR was merged or explicitly abandoned with a recorded outcome.
- `final-audit`: do not require open PRs. Promote the final-audit Reviewer issue only after campaign implementation/test PRs are merged or explicitly abandoned. Treat merged PRs as expected audit inputs and do not use pre-merge approval language. Comment: "Promoted as final-audit Reviewer. Merged PRs are expected audit inputs."
- `let-architect-decide`: promote only the Architect cadence-decision issue unless Architect already recorded `review_cadence: final-audit` or `review_cadence: paired-review` in the issue body or comments. Do not promote implementation, test, reviewer, or release issues while the cadence remains undecided.

Follow:

- `ops/prompts/campaign-conductor.md`
- `ops/policies/campaign-conductor.md`
- `ops/policies/context-economy.md`
- `ops/checklists/campaign-conductor-checklist.md`
- `ops/checklists/context-pack-checklist.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`

