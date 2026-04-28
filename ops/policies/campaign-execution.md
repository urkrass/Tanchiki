# Campaign Execution Policy

Use this policy for multi-issue campaigns and Level 2 command-center runs.

## Sequential Execution

Campaigns with dependency chains must expose only the next automation issue as `Todo` + `automation-ready` with exactly one `role:*` label.

- Parent, epic, and campaign umbrella issues must not have `automation-ready`.
- Blocked issues must not be selected.
- Issues labeled `needs-human-approval` must not be automated until a human removes the gate and applies `automation-ready`.
- Issues labeled `human-only` must not be automated.
- Planners may recommend role labels in issue bodies but must not apply `automation-ready` unless explicitly instructed.

If the Linear queue violates these rules, stop and report the queue problem before implementing.

## Label Taxonomy

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Gate labels:

- `needs-human-approval`
- `blocked`
- `human-only`

Deprecated ambiguous usage:

- Do not use `agent-ready` for new campaign execution routing.
- Do not use `human-review` to mean reviewer-agent work.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.

## Campaign Grooming

After a planner creates campaign issues, a Campaign Groomer should review the queue before automation starts:

- ensure each issue has exactly one suggested or applied `role:*` label
- ensure blocked/dependency issues are marked with `blocked` or `needs-human-approval`
- ensure exactly one issue is `Todo` + `automation-ready` in each dependency chain
- ensure the first automation issue is explicitly recommended for human approval
- ensure parent and umbrella issues remain unready for automation

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
