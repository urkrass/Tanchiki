# Repo Orchestration Policy

Level 6 treats this repository as the source of operational truth for agents.

## Source Order

When instructions conflict, use this order:

1. User request and current Linear issue.
2. `SAFETY_BOUNDARIES.md`.
3. `TASK_PROTOCOL.md`.
4. `VALIDATION_MATRIX.md`.
5. `ARCHITECTURE.md`.
6. `ops/policies/`.
7. `ops/checklists/`.
8. Role prompts in `ops/prompts/` and `prompts/`.

## Machine-Readable Metadata

Every automated task must declare:

- role label
- type label
- risk label
- validation profile
- scope
- do-not-touch list
- acceptance criteria
- tests required
- manual QA
- visible UI expectation
- central-file conflict risk

The Dispatcher must refuse tasks that do not declare the required Level 5 metadata.

## Repo-Owned Workflows

The repo owns:

- GitHub issue templates for task shape.
- PR template for review shape.
- CI for test/build/lint.
- PR metadata check for required PR body sections.
- Ops policies and checklists for role behavior.

Long chat prompts should only launch a workflow. The workflow details should live in the repo.

## Future Work

If metadata checks become too brittle in GitHub Actions, keep the checklist as the review source of truth and introduce a small repository script before expanding workflow logic.
