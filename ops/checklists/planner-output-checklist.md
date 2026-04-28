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
- Blocked-by relationships are added where possible or written in the issue body.
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
- Planner classification
- Dependencies or blockers
- Dependency order
- Blocked-by relationships where possible
- Visible UI change expected
- Central-file conflict risk
- First issue that should become `Todo` + `automation-ready`

## Boundary Check

- No gameplay code was edited.
- No branch or implementation PR was created for gameplay work.
- No issue was marked `automation-ready` except the single first runnable issue exposed by the required grooming pass.
- No parent, epic, blocked, or `needs-human-approval` issue was marked `automation-ready`.
- For dependency chains, only one issue is recommended as the first `Todo` + `automation-ready` candidate.
- No issue was moved into implementation status.
- The planner ran the campaign grooming checklist after creating issues.
- The planner stopped after creating issues, grooming the queue, and reporting the final queue.

## Grooming Check

- Each issue has exactly one applied `role:*` label where applicable.
- Each issue has exactly one applied `type:*`, `risk:*`, and `validation:*` label where applicable.
- Human gates use `needs-human-approval`.
- Human-only issues use `human-only`.
- Dependency-blocked issues use `blocked`.
- Classification mismatches are corrected before automation starts.
- Only the first runnable issue has `automation-ready`.
- If architecture review is required first, only the first Architect issue is `Todo` + `role:architect` + `automation-ready`.
- Coder issues remain Backlog/blocked immediately after planning unless the user explicitly requested Coder to run first.
- No issue has `automation-ready` with `blocked`, `needs-human-approval`, or `human-only`.
- No issue has `automation-ready` with `risk:human-only`.
- A grooming comment summarizes queue order and required human actions.

## Final Summary

The final planner response includes:

- created issue identifiers and titles
- classification for each issue
- recommended implementation order
- dependency notes
- blocked-by relationships where possible
- visible UI expectation for each issue
- central-file conflict risk for each issue
- suggested role label for each issue
- suggested type label, risk label, and validation label for each issue
- which issue should become `Todo` + `automation-ready` first
- items requiring human review before Level 2 work
- final status and applied labels for each issue after grooming
- whether the queue is safe for the Level 5 Dispatcher
