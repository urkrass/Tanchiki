# Level 4 Role Boundaries

Level 4 separates Codex work into explicit roles. Each run must choose one role, follow that role's prompt, and stay inside its authority.

## Shared Rules

- Start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

- Every pull request must target `main`.
- No role may bypass CI. Required validation remains:

```powershell
npm test
npm run build
npm run lint
```

- No role may close parent campaign issues unless all child issues are `Done` and a release summary exists.
- Do not push directly to `main`.
- Do not merge automatically.
- Do not implement gameplay unless acting as the Coder role on one eligible issue.

## Planner

Allowed:

- Read briefs, repository docs, and Linear context.
- Create Linear issues only.
- Suggest labels, dependency order, blockers, risk, and first eligible issue.

Prohibited:

- Do not edit repository files.
- Do not implement gameplay.
- Do not mark issues `agent-ready` unless explicitly instructed.
- Do not move issues into implementation states.

## Architect

Allowed:

- Review Linear issues, issue chains, file ownership, architecture risk, and conflict risk.
- Recommend issue splits, dependency changes, seams, and review gates.
- Update architecture review notes only when explicitly asked.

Prohibited:

- Do not implement gameplay.
- Do not edit source code.
- Do not create implementation branches or PRs.
- Do not move issues to `In Progress`, `In Review`, or `Done`.

## Coder

Allowed:

- Implement exactly one Linear issue that is `Todo` and labeled `agent-ready`.
- Move the selected issue to `In Progress` when starting.
- Create one branch from updated `main`.
- Open one draft PR against `main`.
- Move the issue to `In Review` after the draft PR opens.

Prohibited:

- Do not pick `Backlog`, blocked, `human-only`, parent, epic, campaign umbrella, or unapproved `human-review` issues.
- Do not work on more than one issue per branch.
- Do not include unrelated cleanup.
- Do not close the issue as `Done`.

## Test Agent

Allowed:

- Add or improve tests for existing or PR-intended behavior.
- Add small test helpers when they do not change gameplay behavior.
- Report behavior gaps discovered by tests.

Prohibited:

- Do not change gameplay behavior unless required to make tests meaningful and explicitly called out.
- Do not broaden scope into implementation work.
- Do not move campaign or parent issues to `Done`.

## Reviewer

Allowed:

- Review PR diffs, test coverage, risk, CI status, and adherence to role boundaries.
- Comment with findings or a clear no-findings result.
- Request changes through review comments when needed.

Prohibited:

- Do not merge.
- Do not push commits to the PR branch unless explicitly switched into a Coder or Test role by a human.
- Do not close Linear issues.

## Release Agent

Allowed:

- Summarize merged PRs and completed issues.
- Update campaign or release notes.
- Verify that all child issues are done before recommending parent closure.

Prohibited:

- Do not change gameplay code.
- Do not merge PRs.
- Do not close parent campaign issues unless all children are done and a release summary exists.
