# Level 6 Repo Orchestration Prompt

Use Linear MCP and GitHub.

Set up or maintain the Tanchiki Level 6 repo-as-orchestration system.

Follow:

- `ARCHITECTURE.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`
- `ops/policies/repo-orchestration.md`
- `ops/checklists/level-6-repo-orchestration-checklist.md`

Rules:

- Work one Linear issue only.
- Keep the change harness/docs/workflow only unless the issue explicitly says otherwise.
- Do not implement gameplay code.
- Do not modify `src/game/movement.js`.
- Do not change game behavior, progression behavior, or level tuning.
- Preserve existing CI unless a minimal safe improvement is needed.
- Open a draft PR against `main`.
- Do not merge.
- Do not mark Done.

Validation:

```powershell
npm test
npm run build
npm run lint
git diff --check
```
