# Plan And Groom A Tanchiki Campaign Brief

Use Linear MCP.

Read the campaign brief supplied by the user, create 5-8 small Linear issues for Tanchiki, then immediately groom the campaign queue for Level 4 dispatcher execution. This is Level 3 planning plus campaign grooming only.

## Required Reading

1. `CODEX_HANDOFF.md`
2. `AGENTS.md`
3. `README.md`
4. `ops/prompts/planner-agent.md`
5. `ops/policies/planner-boundaries.md`
6. `ops/checklists/planner-output-checklist.md`
7. `ops/policies/campaign-execution.md`
8. `ops/checklists/conflict-risk-checklist.md`
9. `ops/prompts/campaign-groomer.md`
10. `ops/checklists/campaign-grooming-checklist.md`
11. the supplied campaign brief

## Workflow

1. Restate the campaign goal, current state, constraints, and obvious dependencies.
2. Break the brief into 5-8 issues.
3. Preserve dependency order between issues.
4. Keep each issue small enough for one Level 2 implementation pass.
5. Classify every issue as:
   - `automation-ready candidate`
   - `needs-human-approval`
   - `human-only`
   - `blocked/dependency`
6. Add suggested role labels in the issue description:
   - `role:architect`
   - `role:coder`
   - `role:test`
   - `role:reviewer`
   - `role:release`
7. Add suggested type, risk, and validation labels in the issue description.
8. Identify parent/epic issues and ensure they are not recommended for `automation-ready`.
9. For dependency chains, name exactly one issue that should become `Todo` + `automation-ready` first after human approval.
10. Mark dependency issues as `blocked` or `needs-human-approval` where appropriate.
11. Check whether likely files overlap with the previous 1-3 merged PRs or central integration files.
12. Create the issues in Linear.
13. Run the campaign grooming checklist before stopping:
   - normalize each issue to exactly one applied `role:*`, `type:*`, `risk:*`, and `validation:*` label where applicable
   - mark human gates with `needs-human-approval`
   - mark never-automated human work with `human-only`
   - mark dependency-blocked work with `blocked`
   - apply `automation-ready` only to the one issue that may run next
14. If the campaign requires Architect review first, make only that first Architect issue `Todo` + `role:architect` + `automation-ready`.
15. Keep Coder, Test, Reviewer, and Release issues Backlog/blocked until their dependencies are complete.
16. Stop after reporting the final groomed queue.

## Issue Body Requirements

Each issue must include:

- Goal
- Current state
- Files likely involved
- Scope
- Do-not-touch list
- Acceptance criteria
- Tests required
- Validation commands
- Manual QA
- Risk level
- Suggested labels
- Suggested role label
- Suggested type label
- Suggested risk label
- Suggested validation label
- Planner classification
- Dependencies or blockers
- Dependency order
- Blocked-by relationships where possible
- Whether visible UI change is expected
- Central-file conflict risk
- First issue that should become `Todo` + `automation-ready` after human approval

## Guardrails

- Do not implement gameplay code.
- Do not edit source files.
- Do not open a gameplay implementation PR.
- Do not apply `automation-ready` broadly. The grooming pass may apply it only to the single first runnable issue allowed by `ops/policies/campaign-execution.md`.
- Do not move issues to `In Progress`, `In Review`, or `Done`.
- Do not put `automation-ready` on parent, epic, blocked, `needs-human-approval`, or `human-only` issues.
- Do not make a Coder issue automation-ready immediately after planning unless the user explicitly requested it.
- Do not use `agent-ready` for new campaign planning.
- Do not use `human-review` to mean reviewer-agent work.
- Do not create broad vague issues like "improve AI", "polish game", or "add campaign".

## Final Response

Report:

- created issue identifiers and titles
- each classification
- recommended implementation order
- dependency notes
- blocked-by relationships where possible
- whether visible UI change is expected for each issue
- central-file conflict risk for each issue
- suggested role label for each issue
- which single issue should become `Todo` + `automation-ready` first after human approval
- which issues need `needs-human-approval` before the Dispatcher can pick them up
- final applied labels and statuses after grooming
- whether the queue is safe for the Level 5 Dispatcher
