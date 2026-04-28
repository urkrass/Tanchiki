# Planner Output Checklist

Use this checklist before creating or reporting Level 3 planner issues.

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
- Planner classification
- Dependencies or blockers
- Dependency order
- Blocked-by relationships where possible
- Visible UI change expected
- Central-file conflict risk
- Suggested role label
- First issue that should become `Todo` + `automation-ready`

## Boundary Check

- No gameplay code was edited.
- No branch or implementation PR was created for gameplay work.
- No issue was marked `automation-ready` unless explicitly instructed.
- No parent, epic, blocked, or `needs-human-approval` issue was marked `automation-ready`.
- For dependency chains, only one issue is recommended as the first `Todo` + `automation-ready` candidate.
- No issue was moved into implementation status.
- The planner stopped after creating issues and a summary.

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
- which issue should become `Todo` + `automation-ready` first
- items requiring human review before Level 2 work
