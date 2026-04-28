# Task Protocol

This repo uses Linear for task state, GitHub for code review, and this repository as the operations source of truth.

## Linear Issue Selection

The Dispatcher scans Tanchiki `Todo` issues and selects one issue only.

Eligibility requires:

- `automation-ready`
- exactly one `role:*` label
- exactly one `type:*` label
- exactly one `risk:*` label
- exactly one `validation:*` label
- no `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`
- no unresolved blocked-by relation

If metadata is missing or duplicated, the Dispatcher stops and comments on the issue with the exact fields to fix.

## Branch Creation

Agents that do repository work start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Create one branch per issue. Use a descriptive branch name that includes the Linear ID when practical.

## Implementation

- Work one issue only.
- Stay inside the selected role authority.
- Keep patches scoped and reversible.
- Do not include unrelated cleanup.
- Do not edit gameplay code from docs or harness issues.
- Do not modify `src/game/movement.js` unless explicitly approved.

## Validation

Run the validation profile declared by the issue. Baseline validation is:

```powershell
npm test
npm run build
npm run lint
```

Docs and harness changes also require:

```powershell
git diff --check
```

## Pull Requests

Open a draft PR against `main`. Fill the PR template with:

- linked Linear issue
- role, type, risk, validation profile
- summary
- files changed
- tests run
- manual QA
- conflict risk
- visible UI expectation
- known limitations

Do not merge automatically.

## CI And Review

CI must pass before merge. Reviewer agents inspect:

- PR metadata completeness
- declared validation profile compliance
- changed files and role boundaries
- gameplay or movement safety
- manual QA notes
- conflict risk

Reviewer agents do not merge and do not push commits.

## Merge

Merges are human-controlled unless the user explicitly delegates a merge and the repository policy allows it. Never merge while CI is failing or missing.

## Done Rules

Move an implementation issue to `In Review` after its draft PR is open. Do not mark it `Done` until the PR is merged or a human explicitly approves closure.

Reviewer or release issues may move to `In Review` after their notes are posted, but must not be marked `Done` unless a human approves or the role protocol explicitly allows it.

## Campaign Closure

Do not close parent campaign issues until:

- all child issues are `Done`
- required reviewer work is complete
- release summary exists
- any human-only placeholders remain intentionally gated or are explicitly resolved
