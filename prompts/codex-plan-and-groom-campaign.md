# Plan And Groom A Tanchiki Campaign

Use Linear MCP and GitHub.

Act as the Tanchiki Planner agent, then immediately act as Campaign Groomer for the issues you created. This is planning and queue grooming only.

## Task

Turn the supplied campaign brief into 5-7 small Linear issues, then groom the campaign queue so the Level 4 Dispatcher can safely run exactly one issue next.

## Required Reading

1. `CODEX_HANDOFF.md`
2. `AGENTS.md`
3. `README.md`
4. `ops/prompts/planner-agent.md`
5. `ops/prompts/campaign-groomer.md`
6. `ops/policies/planner-boundaries.md`
7. `ops/policies/campaign-execution.md`
8. `ops/policies/role-router.md`
9. `ops/checklists/planner-output-checklist.md`
10. `ops/checklists/campaign-grooming-checklist.md`
11. `ops/checklists/conflict-risk-checklist.md`
12. the supplied campaign brief

## Planner Work

- Create 5-7 small Linear issues.
- Keep issues small enough for one Level 4 role pass.
- Include dependency order, blocked-by relationships where possible, visible UI expectation, central-file conflict risk, suggested role labels, and the first issue that should run.
- Do not implement gameplay.
- Do not edit source files.
- Do not open a gameplay PR.

## Auto-Grooming Work

Immediately after issue creation, groom the same campaign queue:

- Apply exactly one role label where applicable:
  - `role:architect`
  - `role:coder`
  - `role:test`
  - `role:reviewer`
  - `role:release`
- Use `automation-ready` only for the one issue that may run next.
- Use `needs-human-approval` for human gates.
- Use `blocked` for dependency-blocked issues.
- Use `human-only` for issues that must never be automated.
- Fix classification mismatches. For example, a human review issue must not be classified or labeled as Coder work.
- If the campaign requires architecture review first, make only the first Architect issue:
  - `Todo`
  - `role:architect`
  - `automation-ready`
- Leave implementation issues Backlog/blocked unless the user explicitly requested a Coder issue to be runnable immediately.
- Leave Test issues blocked until implementation PRs are merged or ready.
- Leave Reviewer issues blocked until implementation/test PRs exist.
- Leave Release issues blocked until review is done.
- Add a grooming comment summarizing queue order and required human actions.

## Final Report

Report:

- created issue identifiers and titles
- final status and applied labels for each issue
- recommended sequence
- the only dispatcher-eligible issue
- blocked issues and blockers
- human-only or `needs-human-approval` issues
- central-file conflict risks
- next human action required

Do not merge anything. Do not mark issues Done.
