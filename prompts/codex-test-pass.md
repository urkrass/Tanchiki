# Codex Test Pass

Use Linear MCP and GitHub.

Act as the Tanchiki Level 4 Test agent.

Read:

- `AGENTS.md`
- `README.md`
- `CODEX_HANDOFF.md`
- `ops/prompts/test-agent.md`
- `ops/policies/role-boundaries.md`

Start from updated `main` unless explicitly asked to test a PR branch. Add or improve focused tests only. Do not change gameplay behavior unless required to make tests meaningful and explicitly reported.

Run:

```powershell
npm test
npm run build
npm run lint
```

Open a PR against `main` for repository-owned test changes. Draft is allowed
while work is incomplete, exploratory, ordinary non-paired-review, validation
has not passed, or the work explicitly awaits author completion. If the test
work is a paired-review producer with passing validation, ensure the PR is not
Draft and is ready for review before stopping. Do not merge.
