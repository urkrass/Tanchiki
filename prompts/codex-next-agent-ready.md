# Next agent-ready issue prompt

Use Linear MCP and GitHub.

Find the highest-priority Tanchiki issue that is eligible for autonomous Codex work.

Eligibility:

- status is `Todo`
- label includes `agent-ready`
- issue is not blocked
- label does not include `blocked`
- label does not include `human-only`
- issue is not safety-critical

Do not pick Backlog issues.
Do not work more than one issue.
Do not implement unrelated cleanup.

Workflow:

1. Query Linear for Tanchiki issues in `Todo` with label `agent-ready`.
2. Pick the highest-priority eligible issue.
3. Restate the issue goal, constraints, and acceptance criteria.
4. Move the Linear issue to `In Progress`.
5. Create a branch from `main`.
6. Implement only the selected issue.
7. Run:

```powershell
npm test
npm run build
npm run lint
```

8. Commit the scoped change.
9. Push the branch.
10. Open a draft PR against `main`.
11. Move the Linear issue to `In Review`.
12. Stop and report the issue ID, branch, PR, and validation results.

Do not move the issue to `Done` until the PR is merged or a human explicitly approves closing it.
