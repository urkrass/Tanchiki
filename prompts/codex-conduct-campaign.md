# Codex Conduct Campaign

Use Linear MCP and GitHub.

Run the Tanchiki Campaign Conductor for the active campaign.
Inspect campaign state.
Inspect the campaign review cadence before promoting Reviewer issues.
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

- `paired-review`: promote a Reviewer issue only when the linked PR is open, non-draft, unmerged, and checks/metadata are ready according to policy. Do not promote the next Coder/Test issue until the previous PR-producing issue and its paired Reviewer issue are Done.
- `final-audit`: do not require open PRs. Promote the final-audit Reviewer issue only after campaign implementation/test PRs are merged or explicitly abandoned. Treat merged PRs as expected audit inputs and do not use pre-merge approval language.

Follow:

- `ops/prompts/campaign-conductor.md`
- `ops/policies/campaign-conductor.md`
- `ops/checklists/campaign-conductor-checklist.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`

