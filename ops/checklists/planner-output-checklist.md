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
- The first issue that should become `Todo` + `agent-ready` is identified.

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
- First issue that should become `Todo` + `agent-ready`

## Boundary Check

- No gameplay code was edited.
- No branch or implementation PR was created for gameplay work.
- No issue was marked `agent-ready` unless explicitly instructed.
- No parent, epic, blocked, or human-review issue was marked `agent-ready`.
- For dependency chains, only one issue is recommended as the first `Todo` + `agent-ready` candidate.
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
- which issue should become `Todo` + `agent-ready` first
- items requiring human review before Level 2 work
