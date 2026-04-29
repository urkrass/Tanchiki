# Planner Output Checklist

Use this checklist before creating, grooming, or reporting Level 3 planner issues.

## Brief Understanding

- The campaign goal is named.
- The player-facing outcome is clear.
- The current prototype state is acknowledged.
- Missing decisions, assets, or dependencies are called out.

## Issue Quality

- Each issue has one primary job.
- Each issue is small enough for one Level 2 implementation pass.
- No issue is a broad umbrella task.
- Dependencies are preserved and named.
- Dependency order is explicit.
- Blocked-by relationships are added or written in the issue body.
- Review cadence is recommended for every campaign.
- Review cadence appears in the campaign summary, relevant issue descriptions, dependency order, and grooming notes.
- A campaign context pack is created or clearly referenced.
- Every issue has a minimal issue context pack or clear reference to one.
- Issue context packs include required safety context, relevant files, forbidden files, validation profile, review cadence, known decisions, PR/issue sequence, context refresh triggers, stop-and-ask conditions, and advisory `model_hint`.
- `model_hint` recommendations are advisory and do not override risk gates, validation profiles, PR metadata, human gates, review cadence, or safety docs.
- Broad repo scans require a recorded reason.
- Risk level is stated.
- Suggested labels are included.
- Suggested role, type, risk, and validation labels are included.
- Planner classification is included.
- Visible UI expectation is stated.
- Central-file conflict risk is stated.
- Suggested role label is included.
- The first issue that should become `Todo` + `automation-ready` is identified.

## Required Sections

Each issue includes:

- Goal
- Current state
- Files likely involved
- Scope
- Do-not-touch list
- Acceptance criteria
- Tests required
- Validation commands
- Manual QA
- Risk level
- Suggested labels
- Suggested role label
- Suggested type label
- Suggested risk label
- Suggested validation label
- Review cadence
- Campaign context pack reference
- Issue context pack
- `model_hint`
- Planner classification
- Dependencies or blockers
- Dependency order
- Blocked-by relationships
- Visible UI change expected
- Central-file conflict risk
- First issue that should become `Todo` + `automation-ready`

## Boundary Check

- No gameplay code was edited.
- No branch or implementation PR was created for gameplay work.
- No issue was marked `automation-ready` except the single first runnable issue exposed by the required grooming pass.
- If review cadence is `let-architect-decide`, an Architect issue must choose `final-audit` or `paired-review` before implementation issues are promoted.
- If review cadence is `let-architect-decide` and the campaign contains medium-risk UI/gameplay/trust-boundary PR-producing Coder/Test issues, placeholder paired Reviewer issues are created in Backlog or a queue-repair requirement is documented.
- If Architect later chooses `review_cadence: paired-review`, paired Reviewer issues must be created, activated, or confirmed before any PR-producing Coder/Test issue is promoted.
- No parent, epic, unresolved dependency, or `needs-human-approval` issue was marked `automation-ready`.
- For dependency chains, only one issue is recommended as the first `Todo` + `automation-ready` candidate.
- No issue was moved into implementation status.
- The planner ran the campaign grooming checklist after creating issues.
- The planner ran or satisfied the context pack checklist.
- Safety-critical docs remain mandatory and are not hidden by context packs.
- Token saving is not used to skip validation, PR metadata, review cadence, changed-file scrutiny, or human gates.
- The planner stopped after creating issues, grooming the queue, and reporting the final queue.

## Grooming Check

- Each issue has exactly one applied `role:*` label where applicable.
- Each issue has exactly one applied `type:*`, `risk:*`, and `validation:*` label where applicable.
- Human gates use `needs-human-approval`.
- Human-only issues use `human-only`.
- Dependency-blocked issues use blocked-by / blocks relations.
- Dependencies are shaped for the selected review cadence.
- For `paired-review`, each PR-producing Coder/Test issue blocks its paired Reviewer issue, and the paired Reviewer blocks the next Coder/Test issue.
- For paired-review selected after deferred cadence, the queue has the materialized dependency chain `Producer issue -> paired Reviewer issue -> next Producer issue`.
- For `final-audit`, a single final-audit Reviewer runs after implementation/test PRs are merged or explicitly abandoned.
- Classification mismatches are corrected before automation starts.
- Only the first runnable issue has `automation-ready`.
- If architecture review is required first, only the first Architect issue is `Todo` + `role:architect` + `automation-ready`.
- Coder issues remain Backlog with blocked-by relations immediately after planning unless the user explicitly requested Coder to run first.
- No issue has `automation-ready` with `blocked`, `needs-human-approval`, or `human-only`.
- No issue has `automation-ready` with `risk:human-only`.
- A grooming comment summarizes queue order and required human actions.
- The grooming comment attaches or references the campaign context pack.
- Grooming confirms issue context packs are concise and role-specific.
- Grooming confirms `model_hint` values are advisory and compatible with issue risk/type/validation.

## Final Summary

The final planner response includes:

- created issue identifiers and titles
- classification for each issue
- recommended implementation order
- selected or deferred review cadence
- campaign context pack location
- `model_hint` recommendations
- dependency notes
- blocked-by relationships
- visible UI expectation for each issue
- central-file conflict risk for each issue
- suggested role label for each issue
- suggested type label, risk label, and validation label for each issue
- which issue should become `Todo` + `automation-ready` first
- items requiring human review before Level 2 work
- final status and applied labels for each issue after grooming
- whether the queue is safe for the Level 5 Dispatcher
