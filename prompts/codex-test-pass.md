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

Open a draft PR against `main` for repository-owned test changes. Do not merge.
