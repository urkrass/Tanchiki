# Agent Index

This repository is a Level 6 repo-as-orchestration system for Tanchiki. Keep this file concise. Use the linked docs as the source of truth instead of repeating the full protocol here.

## Start Here

Read these files before acting:

- `ops/context-manifest.md` - short-prompt context-loading contract and role-specific context rules.
- `ARCHITECTURE.md` - current game architecture, ownership, central files, and extension points.
- `TASK_PROTOCOL.md` - Linear selection, branching, PRs, CI, review, merge, Done rules, and campaign closure.
- `VALIDATION_MATRIX.md` - role/type/risk/validation mappings and required checks.
- `SAFETY_BOUNDARIES.md` - protected files, human gates, CI rules, and destructive-operation limits.

Then use:

- `ops/policies/` for role, risk, movement, and campaign policies.
- `ops/checklists/` for routing, grooming, review, validation, and Level 6 checks.
- `ops/prompts/` and `prompts/` for reusable workflow launch prompts.

## Non-Negotiables

- Work one Linear issue at a time.
- Use Linear MCP and GitHub for automation workflows.
- Do not implement gameplay from docs, harness, UI-copy, or test-only tasks.
- Do not modify `src/game/movement.js` unless the issue explicitly permits movement work and the human gate is clear.
- Do not change game behavior, progression behavior, or level tuning unless the issue explicitly scopes it.
- Do not push directly to `main`.
- Do not merge automatically.
- Do not bypass CI.
- Do not mark issues `Done` unless the task protocol allows it or a human explicitly approves.

## Default Dispatcher Prompt

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki dispatcher for the next eligible issue in the declared active project.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.
```

## Validation

Baseline validation:

```powershell
npm test
npm run build
npm run lint
```

Docs and harness changes also run:

```powershell
git diff --check
```
