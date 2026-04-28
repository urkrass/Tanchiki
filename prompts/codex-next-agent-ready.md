# Next agent-ready issue prompt

Use Linear MCP and GitHub.

Find the highest-priority Tanchiki issue that is eligible for autonomous Codex work.

Eligibility:

- status is `Todo`
- label includes `agent-ready`
- issue is not blocked
- label does not include `blocked`
- label does not include `human-only`
- label does not include `human-review` unless a human explicitly moved it to `Todo` + `agent-ready`
- issue is not a parent, epic, or campaign umbrella
- issue is not safety-critical

Do not pick Backlog issues.
Do not work more than one issue.
Do not implement unrelated cleanup.
For dependency chains, only one issue may be `Todo` + `agent-ready` at a time. If multiple dependent issues are eligible, stop and report the queue problem.

Workflow:

1. Query Linear for Tanchiki issues in `Todo` with label `agent-ready`.
2. Pick the highest-priority eligible issue.
3. Exclude parent/epic issues, blocked issues, human-review issues not explicitly approved for implementation, and issues blocked by another issue.
4. Restate the issue goal, constraints, acceptance criteria, dependency status, and whether a visible UI change is expected.
5. Move the Linear issue to `In Progress`.
6. Before creating a branch, run:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

7. Inspect recent merged PRs or git history. If the selected issue touches files modified by the previous 1-3 merged PRs, report conflict risk before editing.
8. Create a branch from updated `main`.
9. Implement only the selected issue.
10. If the issue would add significant logic to `src/game.js` or `test/game.test.js`, prefer extracting a focused module or focused test file. If several consecutive issues touch those files, recommend a seam-extraction issue.
11. Run:

```powershell
npm test
npm run build
npm run lint
```

12. Commit the scoped change.
13. Push the branch.
14. Open a draft PR against `main`.
15. Move the Linear issue to `In Review`.
16. Stop and report the issue ID, branch, PR, validation results, and any conflict-risk notes.

Do not move the issue to `Done` until the PR is merged or a human explicitly approves closing it.

If the PR conflicts with `main`, resolve conflicts on the PR branch, preserve both `main` behavior and PR behavior, rerun validation, push the PR branch, and do not merge automatically.

If port `5173` is occupied during dev-server checks, verify whether the existing server is usable before treating it as failure.
