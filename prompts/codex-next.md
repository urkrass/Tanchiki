# Codex Next

Use Linear MCP and GitHub.

Run the Level 4 Dispatcher for the next eligible Tanchiki issue.
Choose the correct role automatically.
Work one issue only.
Do not merge.

Follow:

- `ops/policies/role-router.md`
- `ops/policies/role-boundaries.md`
- `ops/checklists/role-routing-checklist.md`
- the selected role prompt in `ops/prompts/`

Dispatcher rules:

1. Query Linear for the highest-priority Tanchiki issue that is `Todo`, has `agent-ready` or a specific role label, is not blocked, is not canceled, and is not `Done`.
2. Read the full issue before acting.
3. Determine the role from labels and issue description classification.
4. Stop if the role is ambiguous, blocked, dependency-gated, or human-review-only.
5. Route exactly one issue to Architect, Coder, Test, Reviewer, or Release.
6. Use the selected role's existing Level 4 protocol.
7. Start from updated `main` where repo work is needed:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

8. Open PRs only when the selected role allows PRs.
9. Do not bypass validation, merge PRs, or mark issues `Done` unless the selected protocol explicitly allows it.

Validation for repo changes:

```powershell
npm test
npm run build
npm run lint
```
