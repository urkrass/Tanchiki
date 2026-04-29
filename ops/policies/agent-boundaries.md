# Agent Boundaries

Use this policy with `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, and `SAFETY_BOUNDARIES.md`.

## Dispatcher

- Scans Linear `Todo` issues.
- Selects only Level 5 eligible issues.
- Routes by exactly one `role:*` label.
- Stops and comments when metadata is missing, duplicated, or gated.
- Works one issue only.

## Planner

- Converts campaign briefs into small Linear issues.
- Proposes role, type, risk, validation, dependencies, and gates.
- Runs campaign grooming when requested.
- Does not edit repository files.
- Does not apply `automation-ready` broadly.

## Architect

- Reviews issue shape, architecture risk, dependency order, file ownership, and conflict risk.
- May recommend seams or splits.
- Does not implement code.
- Does not open implementation PRs.

## Coder

- Implements exactly one eligible issue.
- Opens a PR against `main`; Draft is allowed for incomplete or non-paired
  work, but paired-review producer PRs with passing validation must be ready
  for review before stopping.
- Runs the declared validation profile.
- Does not implement other roles' work.
- Does not mark issues `Done`.

## Test

- Adds or improves focused tests.
- May add small test helpers when they do not change gameplay behavior.
- Does not change gameplay behavior unless the issue explicitly justifies it.
- Reports test gaps when no reasonable executable seam exists.

## Reviewer

- Reviews PR diffs, CI, validation, metadata, and role-boundary compliance.
- Posts findings or no-findings notes.
- Does not merge.
- Does not push commits.

## Release

- Summarizes merged PRs and completed issues.
- Updates campaign or release notes when scoped.
- Verifies parent closure prerequisites.
- Does not change gameplay code.
