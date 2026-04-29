# Plan And Groom A Tanchiki Campaign

Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Act as the Tanchiki Planner agent, then immediately act as Campaign Groomer for the issues you created. This is planning and queue grooming only.

## Task

Turn the supplied campaign brief into 5-7 small Linear issues, then groom the campaign queue so the Level 5 Dispatcher can safely run exactly one issue next.

## Required Reading

1. `CODEX_HANDOFF.md`
2. `AGENTS.md`
3. `README.md`
4. `ops/prompts/planner-agent.md`
5. `ops/prompts/campaign-groomer.md`
6. `ops/policies/planner-boundaries.md`
7. `ops/policies/campaign-execution.md`
8. `ops/policies/role-router.md`
9. `ops/policies/context-economy.md`
10. `ops/checklists/planner-output-checklist.md`
11. `ops/checklists/campaign-grooming-checklist.md`
12. `ops/checklists/context-pack-checklist.md`
13. `ops/checklists/conflict-risk-checklist.md`
14. the supplied campaign brief

## Planner Work

- Create 5-7 small Linear issues.
- Choose Linear project mode: `main-project` or `campaign-project`.
- Do not create a new Linear project unless the campaign is multi-issue, the user requested or accepted campaign-project mode, the name follows the Tanchiki convention, and you report the active project.
- Operate only inside the declared active Linear project.
- Keep issues small enough for one Level 4 role pass.
- Include dependency order, blocked-by relationships, visible UI expectation, central-file conflict risk, suggested role labels, and the first issue that should run.
- Include suggested type, risk, and validation labels for every issue.
- Recommend a review cadence for every campaign: `final-audit`, `paired-review`, or `let-architect-decide`.
- Include review cadence in the campaign summary, every relevant issue description, dependency order, and grooming notes.
- Create a concise campaign context pack using `ops/policies/context-economy.md`.
- Include the active Linear project in the campaign context pack.
- Add the active Linear project to the campaign grooming comment and release summary expectations.
- Include issue context pack fields in every issue: required safety context, relevant files, forbidden files, validation profile, review cadence, known decisions, PR/issue sequence, context refresh triggers, and stop-and-ask conditions.
- Include advisory `model_hint` recommendations for the campaign and each issue. Model hints must not override role/type/risk labels, validation profiles, PR metadata, human gates, review cadence, or safety docs.
- Require broad repo scans to include a recorded reason. Do not treat token saving as permission to skip safety-critical docs.
- If using `let-architect-decide`, create an Architect issue that must choose `final-audit` or `paired-review`, record the reason in Linear, and adjust downstream issues before implementation is promoted.
- Do not create ambiguous Reviewer issues. Use titles such as `Reviewer: paired-review PR for <issue id/title>` or `Reviewer: final audit for <campaign name>`.
- Do not implement gameplay.
- Do not edit source files.
- Do not open a gameplay PR.

## Review Cadence Modes

- `final-audit`: a campaign-level Reviewer issue audits the complete campaign near the end. Expected inputs are merged or explicitly abandoned campaign PRs. Merged PRs are normal and not a blocker. Reviewer does not approve merge retroactively and uses `AUDIT PASSED`, `AUDIT PASSED WITH NOTES`, `HUMAN FOLLOW-UP REQUIRED`, or `BLOCKING FINDING`.
- `paired-review`: each PR-producing Coder/Test issue is followed by its own Reviewer issue. Reviewer inspects an open PR before merge. The PR must be open, non-draft, unmerged, and have required checks/metadata according to policy. Reviewer uses `APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`, `APPROVED FOR MERGE`, `CHANGES REQUESTED`, `HUMAN REVIEW REQUIRED`, or `BLOCKED`.
- `let-architect-decide`: Planner may use this when the campaign request is unclear. Architect must choose `final-audit` or `paired-review` before implementation issues are promoted.

Use `paired-review` for PR acceptance / auto-merge policy, Reviewer App / identity / token workflow, GitHub permissions, secrets or credentials handling, CI/workflows, deployment, dependencies, security-sensitive or trust-boundary work, movement/collision, `risk:medium` or higher unless Architect justifies `final-audit`, anything touching `src/game.js`, `src/render.js`, or `src/game/movement.js`, and broad architecture changes.

Use `final-audit` for low-risk docs campaigns, low-risk harness docs/checklist campaigns, low-risk test-only campaigns, routine release notes, campaigns where individual PRs are manually reviewed and merged normally, and retrospective campaign summaries.

## Auto-Grooming Work

Immediately after issue creation, groom the same campaign queue:

- Verify all campaign issues are in the declared active Linear project.
- Verify only one first issue is `Todo` + `automation-ready` inside the active project.
- Verify no unexpected `automation-ready` issue exists in another visible Tanchiki campaign project.
- Avoid cross-project dependencies unless explicitly documented.
- If campaign issues are split across projects, stop and ask for human triage. Do not move issues across projects without explicit approval.
- Apply exactly one role label where applicable:
  - `role:architect`
  - `role:coder`
  - `role:test`
  - `role:reviewer`
  - `role:release`
- Apply exactly one type label where applicable:
  - `type:docs`
  - `type:harness`
  - `type:ui`
  - `type:test`
  - `type:gameplay`
  - `type:progression`
  - `type:architecture`
  - `type:movement`
- Apply exactly one risk label where applicable:
  - `risk:low`
  - `risk:medium`
  - `risk:high`
  - `risk:human-only`
- Apply exactly one validation label where applicable:
  - `validation:docs`
  - `validation:harness`
  - `validation:ui`
  - `validation:test`
  - `validation:gameplay`
  - `validation:progression`
  - `validation:movement`
- Use `automation-ready` only for the one issue that may run next.
- Do not expose `risk:human-only` issues to the dispatcher.
- Use `needs-human-approval` for human gates.
- Use Linear blocked-by / blocks relations for ordinary campaign dependency sequencing.
- Do not use the `blocked` label for normal downstream campaign dependencies.
- Use `human-only` for issues that must never be automated.
- Fix classification mismatches. For example, a human review issue must not be classified or labeled as Coder work.
- If the campaign requires architecture review first, make only the first Architect issue:
  - `Todo`
  - `role:architect`
  - `automation-ready`
- Leave implementation issues Backlog with blocked-by relations unless the user explicitly requested a Coder issue to be runnable immediately.
- Leave Test issues Backlog with blocked-by relations until implementation PRs are merged or ready.
- Leave Reviewer issues Backlog with blocked-by relations until implementation/test PRs exist.
- Leave Release issues Backlog with blocked-by relations until review is done.
- Shape dependencies according to review cadence.
- For `paired-review`, each Coder/Test issue blocks its paired Reviewer issue, each paired Reviewer blocks the next Coder/Test issue, and Release waits until all paired reviewers and PR-producing issues are Done.
- For `final-audit`, Coder/Test issues may proceed sequentially after their PRs are merged, a single final-audit Reviewer runs after implementation/test PRs are merged or explicitly abandoned, and Release waits for the final-audit Reviewer.
- Add a grooming comment summarizing review cadence, queue order, blocked-by dependencies, and required human actions.
- Attach or clearly reference the campaign context pack in the grooming comment or first Architect issue.
- Confirm each issue has a minimal issue context pack instead of repeated broad process text.
- Confirm `model_hint` values are advisory and compatible with issue risk/type/validation.
- Confirm required safety docs remain visible and broad scans require justification.

## Final Report

Report:

- Linear project mode: `main-project` or `campaign-project`
- active Linear project
- campaign name
- created issue identifiers and titles
- final status and applied labels for each issue
- recommended sequence
- selected or deferred review cadence
- the only dispatcher-eligible issue
- whether any automation-ready issues exist outside the active project
- blocked-by dependencies and blockers
- human-only or `needs-human-approval` issues
- central-file conflict risks
- campaign context pack location
- model_hint recommendations
- next human action required

Do not merge anything. Do not mark issues Done.
