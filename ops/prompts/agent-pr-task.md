# Agent PR Task Prompt

Use this prompt when assigning a Level 1 Tanchiki implementation task to Codex.

## Task

Work on exactly one linked issue and produce one small, reviewable pull request.

## Required Start

1. Read the linked issue.
2. Read `CODEX_HANDOFF.md`, `AGENTS.md`, and `ops/policies/level-1-agent-boundaries.md`.
3. Restate the goal, constraints, acceptance criteria, and files likely to change.
4. Inspect relevant files before editing.

## Boundaries

- Do not rewrite `src/game/movement.js` unless the issue explicitly requires it or a failing test proves it is necessary.
- Do not start broad refactors.
- Do not make unrelated cleanup changes.
- Do not add dependencies unless the issue explicitly asks for them.
- Do not push to `main`.
- Do not force push unless explicitly approved.

## Validation

Before committing, run:

```bash
npm test
npm run build
npm run lint
```

Commit only after local validation passes.
