# Level 1 Agent Boundaries

Level 1 keeps every pull request small, reviewable, and tied to one issue.

## Required

- Work from one issue per PR.
- Keep the PR scoped to the issue goal and acceptance criteria.
- Preserve the playable core unless the issue explicitly asks for a change.
- Run local validation before committing:

```bash
npm test
npm run build
npm run lint
```

## Prohibited Without Explicit Approval

- No `src/game/movement.js` rewrites unless the issue explicitly requires it or a failing test proves it is necessary.
- No broad refactors.
- No unrelated cleanup.
- No new dependencies.
- No `git push` to `main`.
- No force push.

## Review Standard

A Level 1 PR should be easy to review in one pass. If the change grows beyond the linked issue, split it into another issue and PR.
