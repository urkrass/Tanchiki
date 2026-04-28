# Codex Next

Use Linear MCP and GitHub.

Run the Tanchiki dispatcher for the next eligible issue.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.

Follow:

- `ops/policies/role-router.md`
- `ops/policies/risk-gated-validation.md`
- `ops/policies/role-boundaries.md`
- `ops/checklists/role-routing-checklist.md`
- `ops/checklists/risk-gate-checklist.md`
- the selected role prompt in `ops/prompts/`

Dispatcher rules:

1. Query Linear for all Tanchiki issues in `Todo`.
2. Skip issues with `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`.
3. Select the highest-priority issue that has `automation-ready`, exactly one `role:*`, exactly one `type:*`, exactly one `risk:*`, and exactly one `validation:*` label.
4. Read the full issue before acting.
5. Route by the role label:
   - `role:architect` -> Architect
   - `role:coder` -> Coder
   - `role:test` -> Test
   - `role:reviewer` -> Reviewer
   - `role:release` -> Release
6. Stop and comment if an issue has missing or ambiguous Level 5 metadata.
7. If no eligible issue exists, report all blocked/gated candidates and the required human actions.
8. Use the selected role's existing Level 4 protocol.
9. Start from updated `main` where repo work is needed:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

10. Open PRs only when the selected role allows PRs.
11. Do not bypass validation, merge PRs, or mark issues `Done` unless the selected protocol explicitly allows it.

Validation for repo changes follows the issue's `validation:*` profile. Baseline validation:

```powershell
npm test
npm run build
npm run lint
```
