# Plan A Tanchiki Campaign Request

Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki self-service campaign factory for the supplied campaign request. Treat the request as intake for planning and grooming only. Do not let a request directly trigger Coder work.

## Input

Use either:

- a completed `.github/ISSUE_TEMPLATE/campaign-request.yml` submission, or
- a pasted campaign request that provides the same fields.

If required request fields are missing, create or report a human-gated clarification issue instead of guessing.

## Required Reading

Before creating or grooming Linear issues, read:

1. `AGENTS.md`
2. `README.md`
3. `CODEX_HANDOFF.md`
4. `.github/ISSUE_TEMPLATE/campaign-request.yml`
5. `ops/prompts/planner-agent.md`
6. `ops/prompts/campaign-groomer.md`
7. `ops/policies/planner-boundaries.md`
8. `ops/policies/campaign-execution.md`
9. `ops/policies/role-router.md`
10. `ops/policies/risk-gated-validation.md`
11. `ops/policies/context-economy.md`
12. `ops/checklists/planner-output-checklist.md`
13. `ops/checklists/campaign-grooming-checklist.md`
14. `ops/checklists/context-pack-checklist.md`
15. `ops/checklists/conflict-risk-checklist.md`
16. the supplied campaign request

## Factory Rules

- This is planning and queue grooming only.
- Choose Linear project mode: `main-project` or `campaign-project`.
- Do not create a new Linear project unless the campaign is multi-issue, the user requested or accepted campaign-project mode, the name follows the Tanchiki convention, and you report the active project.
- Operate only inside the declared active Linear project.
- Do not edit source files.
- Do not open a PR.
- Do not merge anything.
- Do not mark issues `Done`.
- Do not modify `src/game/movement.js`.
- Do not change gameplay, progression, level tuning, enemy AI, shooting, collision, movement, upgrade behavior, or persistence.
- Do not add dependencies.
- Do not create broad catch-all issues.
- Do not apply `automation-ready` to Coder, Test, Reviewer, Release, unresolved dependency, human-only, or needs-human-approval issues during intake.
- Do not apply `automation-ready` to any issue labeled `risk:human-only`.
- If the request includes unsafe categories, create a human approval gate before implementation work.
- Do not use token saving, context packs, or `model_hint` as a reason to skip safety-critical docs, validation, PR metadata, review cadence, or human gates.

## Request Review

First classify the request:

- `safe planning request`: docs, prompts, templates, harness policy, checklists, static validation, or low-risk UI copy.
- `needs-human-approval`: gameplay behavior, progression, level tuning, dependencies, CI browser checks, screenshots as pass/fail, public-demo release gates, broad architecture, or ambiguous product choices.
- `human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations, broad rewrites, or any category requiring human judgment before automation.

If any part is unsafe or ambiguous, split the campaign so the unsafe decision is a human gate issue and downstream implementation stays blocked by Linear blocked-by relations.

## Review Cadence

Planner must recommend a review cadence for every campaign. Use the request's
`Review cadence` field when it is present, and choose a safer cadence when the
request underspecifies risk.

Allowed modes:

- `final-audit`: A campaign-level Reviewer issue audits the complete campaign
  near the end. Expected inputs are merged or explicitly abandoned campaign PRs.
  Merged PRs are normal and not a blocker. The Reviewer does not approve merge
  retroactively and uses final-audit language: `AUDIT PASSED`,
  `AUDIT PASSED WITH NOTES`, `HUMAN FOLLOW-UP REQUIRED`, or
  `BLOCKING FINDING`.
- `paired-review`: Each PR-producing Coder/Test issue is followed by its own
  Reviewer issue. The Reviewer inspects an open PR before merge. The PR must be
  open, non-draft, unmerged, and have required checks/metadata according to
  policy. The Reviewer uses pre-merge language: `APPROVED FOR AUTO-MERGE AFTER
  HUMAN APPLIES merge:auto-eligible`, `APPROVED FOR MERGE`,
  `CHANGES REQUESTED`, `HUMAN REVIEW REQUIRED`, or `BLOCKED`.
- `let-architect-decide`: Planner may use this only when the campaign request is
  unclear. Architect must choose `final-audit` or `paired-review`, record the
  decision in Linear with the reason, and adjust downstream issues before any
  implementation issue is promoted.

If a campaign starts with `review_cadence: let-architect-decide` and may
contain medium-risk UI/gameplay/trust-boundary PR-producing Coder/Test issues,
prefer creating placeholder paired Reviewer issues in Backlog during initial
planning. Keep placeholders non-automation-ready until Architect confirms
`review_cadence: paired-review`. If Architect later chooses final-audit, mark
or comment on placeholders as skipped/not-needed through a human or Architect
comment.

If placeholders do not exist and Architect later chooses paired-review, require
a Planner/Groomer queue repair before implementation promotion. The repair must
create missing paired Reviewer issues and wire dependencies:

```text
Coder/Test issue A
-> paired Reviewer issue A
-> next Coder/Test issue B
```

Include review cadence in the campaign summary, every issue description where
relevant, dependency order, and grooming notes. Do not create ambiguous Reviewer
issues. Reviewer issue titles should make the cadence clear, for example:

- `Reviewer: paired-review PR for <issue id/title>`
- `Reviewer: final audit for <campaign name>`

Require or strongly recommend `paired-review` for PR acceptance / auto-merge
policy, Reviewer App / identity / token workflow, GitHub permissions, secrets
or credentials handling, CI/workflows, deployment, dependencies,
security-sensitive or trust-boundary work, movement/collision, `risk:medium` or
higher unless Architect justifies `final-audit`, anything touching
`src/game.js`, anything touching `src/render.js`, anything touching
`src/game/movement.js`, and broad architecture changes.

`final-audit` is acceptable for low-risk docs campaigns, low-risk harness
docs/checklist campaigns, low-risk test-only campaigns, routine release notes,
campaigns where individual PRs are manually reviewed and merged normally, and
retrospective campaign summaries.

## Planner Work

Create 6-8 small Linear issues when appropriate. Every issue must include:

- Linear project mode
- Active Linear project
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
- Role label
- Type label
- Risk label
- Validation profile
- Review cadence
- Dependency order
- Visible UI expectation
- Central-file conflict risk
- Issue context pack
- `model_hint`

Use Level 5 metadata on every issue:

- one `role:*` label: `role:architect`, `role:coder`, `role:test`, `role:reviewer`, or `role:release`
- one `type:*` label from the repo taxonomy
- one `risk:*` label from the repo taxonomy
- one `validation:*` label from the repo taxonomy

Preserve dependencies from the request. Keep issues small enough for one role pass. Prefer an Architect review issue first unless the request is already an approved continuation with a clear safe next issue.

Create a campaign context pack using `ops/policies/context-economy.md`. It must include the active Linear project, campaign goal, non-goals, review cadence, queue order, human gates, paired-review points, required safety context, relevant files, forbidden files, validation profiles, known decisions, PR/issue sequence, broad-scan rules, context refresh triggers, stop-and-ask conditions, and advisory `model_hint` recommendations.

Each issue context pack should be minimal and role-specific. Reference the campaign context pack instead of repeating broad repo process text.

## Auto-Groomer Work

After issue creation, groom the same Linear campaign:

1. Verify all campaign issues are in the declared active Linear project.
2. Verify only one first issue is `Todo` + `automation-ready` inside the active project.
3. Verify no unexpected `automation-ready` issue exists in another visible Tanchiki campaign project.
4. Avoid cross-project dependencies unless explicitly documented.
5. If campaign issues are split across projects, stop and ask for human triage. Do not move issues across projects without explicit approval.
6. Normalize every issue to exactly one role label.
7. Normalize every issue to exactly one type label.
8. Normalize every issue to exactly one risk label.
9. Normalize every issue to exactly one validation label.
10. Add `needs-human-approval` to human gate issues.
11. Add `human-only` and `risk:human-only` where automation must never run.
12. Add blocked-by / blocks relationships for dependency-blocked issues.
13. Do not add the `blocked` label for ordinary dependency sequencing.
14. Ensure no parent, umbrella, unresolved dependency, human-only, or gated issue has `automation-ready`.
15. Ensure no issue has `automation-ready` with `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`.
16. Make only the first safe Architect issue `Todo` + `automation-ready`.
17. Keep all Coder/Test/Reviewer/Release issues Backlog with blocked-by relations until Architect and human gates are complete.
18. Shape dependencies according to review cadence:
   - For `paired-review`: Coder/Test issue blocks its paired Reviewer issue; paired Reviewer issue blocks the next Coder/Test issue; Release waits until all paired reviewers and PR-producing issues are Done. Example: Architect, Human gate, Coder A, Reviewer A, Coder B, Reviewer B, Test, Reviewer Test, Release.
   - For `final-audit`: Coder/Test issues may proceed sequentially after their PRs are merged; a single final-audit Reviewer issue runs after implementation/test PRs are merged or explicitly abandoned; Release waits for final-audit Reviewer. Example: Architect, Human gate, Coder A, Coder B, Test, Final-audit Reviewer, Release.
19. If `let-architect-decide` was converted to `paired-review`, confirm paired Reviewer issues exist or require `prompts/codex-repair-paired-review-queue.md` before any implementation promotion.
20. Add a grooming comment with active Linear project, review cadence, queue order, blocked-by dependencies, and human gates.
21. Attach or clearly reference the campaign context pack in the grooming comment or first Architect issue.
22. Confirm every issue includes a minimal issue context pack and advisory `model_hint`.
23. Confirm release summary expectations include active Linear project, campaign name, issue list, PR list, project moves, and remaining active automation-ready issues.
24. Confirm required safety docs remain visible and broad repo scans require a recorded reason.

## Validation Expectations

For planning-only work, do not run code validation unless repository files were changed by an explicitly scoped docs/harness issue.

For future implementation issues, include the appropriate commands in each issue body. Default docs and harness validation:

```powershell
npm test
npm run build
npm run lint
git diff --check
```

## Final Report

After creating and grooming the campaign, report:

- Linear project mode: `main-project` or `campaign-project`
- active Linear project
- campaign name
- issue identifiers and titles
- role/type/risk/validation for each issue
- dependency order
- first eligible issue
- whether any automation-ready issues exist outside the active project
- blocked-by dependencies
- human approval gates
- central-file conflict risks
- visible UI expectations
- next human action
- campaign context pack location
- `model_hint` recommendations

Stop after reporting the groomed queue. Do not implement anything.
