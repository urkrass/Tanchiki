# Conflict Risk Checklist

Use this before implementing a Level 2 issue and before creating a campaign plan.

## Recent Main Check

- Ran `git fetch --prune origin`.
- Switched to `main`.
- Ran `git pull --ff-only origin main`.
- Confirmed `git status --short` is clean before branching.

## Recent PR Review

- Inspected the previous one to three merged PRs or recent git history.
- Listed files touched by those PRs.
- Compared the selected issue's likely files against the recent files.

## Risk Flags

Flag conflict risk when the issue touches:

- `src/game.js`
- `test/game.test.js`
- files changed by the previous one to three merged PRs
- files owned by an unmerged PR
- the same central integration files across multiple consecutive campaign issues

## Required Response

If risk is present:

- state the risky files before editing
- explain whether the issue is still safe to continue
- prefer extracting a focused seam if central-file churn is repeated
- include the risk note in the PR body

If risk is not present, state that no recent central-file conflict risk was found.

## PR Conflict Resolution

When a PR conflicts with `main`:

- stay on the PR branch
- merge or rebase latest `main`
- preserve both sides of behavior
- run `npm test`, `npm run build`, and `npm run lint`
- push the PR branch
- do not merge automatically
