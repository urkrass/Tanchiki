# Campaign Execution Policy

Use this policy for multi-issue campaigns and Level 2 command-center runs.

## Sequential Execution

Campaigns with dependency chains must expose only the next implementation issue as `Todo` + `agent-ready`.

- Parent, epic, and campaign umbrella issues must not have `agent-ready`.
- Blocked issues must not be selected.
- Issues labeled `human-review` must not be implemented until a human explicitly moves them to `Todo` and applies `agent-ready`.
- Planners may recommend `agent-ready candidate` issues but must not apply `agent-ready` unless explicitly instructed.

If the Linear queue violates these rules, stop and report the queue problem before implementing.

## Branch Freshness

Before creating a task branch, run:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Create the task branch from updated `main`. Target PRs at `main` unless a human explicitly gives another base.

## Conflict-Risk Review

Before editing, inspect recent merged PRs or git history. A simple local check is:

```powershell
gh pr list --state merged --limit 5 --json number,title,mergedAt,headRefName,url
git show --name-only --format="%h %s" --stat HEAD~5..HEAD
```

If the issue touches files changed by the previous one to three merged PRs, report the conflict risk in the working update and PR body.

## Central Integration Files

`src/game.js` and `test/game.test.js` are integration points. Repeatedly adding feature logic there creates avoidable merge churn.

When several sequential issues need the same central files, prefer a seam-extraction issue before more feature work. Candidate seams include:

- progression-specific helpers
- campaign progression helpers
- player stats helpers
- reward helpers
- focused test files

The seam issue should preserve behavior and reduce future central-file edits.

## Internal-Only Visibility

For internal-only issues, state clearly that no visible UI change is expected. If visible UI is expected by the user, identify the later UI issue that will expose the internal work.

## PR Conflict Resolution

Resolve PR conflicts on the PR branch. Never resolve them by editing `main` directly.

Preserve both sides of behavior, validate with `npm test`, `npm run build`, and `npm run lint`, then push the PR branch. Do not merge automatically.

## Dev Server Port

If `npm run dev` reports that port `5173` is occupied, first check whether the existing server works. If it does not, provide a clear command to stop the process and retry. Do not report occupied port alone as app failure.
