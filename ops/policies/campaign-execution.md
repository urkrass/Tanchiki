# Campaign Execution Policy

Use this policy for multi-issue campaigns and Level 2 command-center runs.

## Sequential Execution

Campaigns with dependency chains must expose only the next automation issue as `Todo` + `automation-ready` with exactly one `role:*`, one `type:*`, one `risk:*`, and one `validation:*` label.

- Parent, epic, and campaign umbrella issues must not have `automation-ready`.
- Blocked issues must not be selected.
- Issues labeled `needs-human-approval` must not be automated until a human removes the gate and applies `automation-ready`.
- Issues labeled `human-only` must not be automated.
- Issues labeled `risk:human-only` must not be automated.
- Planners must groom the queue after creating campaign issues. During grooming, they may apply `automation-ready` only to the single first runnable issue allowed by this policy.

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

Issue type labels:

- `type:docs`
- `type:harness`
- `type:ui`
- `type:test`
- `type:gameplay`
- `type:progression`
- `type:architecture`
- `type:movement`

Risk labels:

- `risk:low`
- `risk:medium`
- `risk:high`
- `risk:human-only`

Validation profile labels:

- `validation:docs`
- `validation:harness`
- `validation:ui`
- `validation:test`
- `validation:gameplay`
- `validation:progression`
- `validation:movement`

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

After a planner creates campaign issues, the Planner must run the Campaign Groomer workflow before stopping. The groomer normalizes the queue before automation starts:

- ensure each issue has exactly one applied `role:*` label where applicable
- ensure each issue has exactly one applied `type:*`, `risk:*`, and `validation:*` label where applicable
- ensure human gates use `needs-human-approval`
- ensure dependency-blocked issues use `blocked`
- ensure never-automated human work uses `human-only`
- fix classification mismatches before automation starts
- ensure exactly one issue is `Todo` + `automation-ready` in each dependency chain
- ensure no issue has `automation-ready` together with `blocked`, `needs-human-approval`, or `human-only`
- ensure no issue with `risk:human-only` has `automation-ready`
- ensure parent and umbrella issues remain unready for automation
- add a grooming comment with queue order and human actions

If the campaign needs architecture review first, the groomer may make only the first safe Architect issue `Todo` + `role:architect` + `automation-ready` after assigning exactly one type, risk, and validation label. Coder issues must stay Backlog/blocked immediately after planning unless the user explicitly requested a Coder issue to run first.

Downstream defaults:

- Coder issues stay Backlog/blocked until Architect and human gates are done.
- Test issues stay blocked until implementation PRs are merged or ready.
- Reviewer issues stay blocked until implementation/test PRs exist.
- Release issues stay blocked until review is done.

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

## Level 5 Validation

Use `ops/policies/risk-gated-validation.md` and `ops/checklists/risk-gate-checklist.md` to choose and verify validation profiles. Harness work must use harness-only validation and must not edit gameplay code.

## Dev Server Port

If `npm run dev` reports that port `5173` is occupied, first check whether the existing server works. If it does not, provide a clear command to stop the process and retry. Do not report occupied port alone as app failure.
