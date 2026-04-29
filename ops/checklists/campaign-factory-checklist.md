# Campaign Factory Checklist

Use this checklist when converting a self-service campaign request into a groomed Linear campaign.

## Intake

- [ ] Read `.github/ISSUE_TEMPLATE/campaign-request.yml` or the equivalent pasted request.
- [ ] Confirm the request names a campaign goal.
- [ ] Confirm Linear project mode is stated as `main-project` or `campaign-project`.
- [ ] Confirm the active Linear project is named exactly.
- [ ] Confirm the current state is described.
- [ ] Confirm constraints and do-not-touch areas are listed.
- [ ] Confirm requested campaign shape or issue count is provided.
- [ ] Confirm review cadence is stated as `final-audit`, `paired-review`, or `let-architect-decide`.
- [ ] Confirm human gates are listed or explicitly absent.
- [ ] Confirm validation expectations are listed.
- [ ] Confirm visible UI expectation is stated.
- [ ] Confirm non-goals are stated.
- [ ] If required fields are missing, create or report a human-gated clarification item instead of guessing.

## Classification

- [ ] Classify the request as `safe planning request`, `needs-human-approval`, or `human-only`.
- [ ] Recommend a review cadence for every campaign.
- [ ] Use `paired-review` for trust-boundary or high-risk work, including PR acceptance / auto-merge policy, Reviewer App / identity / token workflow, GitHub permissions, secrets or credentials, CI/workflows, deployment, dependencies, security-sensitive work, movement/collision, `risk:medium` or higher unless Architect justifies `final-audit`, `src/game.js`, `src/render.js`, `src/game/movement.js`, or broad architecture changes.
- [ ] Use `final-audit` only for acceptable low-risk docs, harness docs/checklist, test-only, routine release note, manual-review, or retrospective campaigns.
- [ ] If review cadence is `let-architect-decide`, create an Architect issue that must choose `final-audit` or `paired-review` and record the reason in Linear before implementation is promoted.
- [ ] Split mixed requests so unsafe decisions become separate human gate issues.
- [ ] Gate gameplay behavior, progression, level tuning, dependency additions, broad architecture, public-demo release decisions, and screenshot pass/fail CI decisions when needed.
- [ ] Mark movement, collision, spawning, control feel, persistence, credentials, destructive repository work, and broad rewrites as human-only unless a human explicitly approves automation.

## Issue Creation

- [ ] Use `main-project` mode for ordinary work, single issues, small fixes, and maintenance.
- [ ] Use `campaign-project` mode only for multi-issue campaigns where the user requested or accepted it.
- [ ] If creating a dedicated project, use `Tanchiki / Harness — <Campaign Name>`, `Tanchiki / Game — <Campaign Name>`, `Tanchiki / Release — <Campaign Name>`, or `Tanchiki / Research — <Campaign Name>`.
- [ ] If using the main project, state the campaign name clearly in every issue body.
- [ ] Record Linear project mode and active Linear project in Planner output.
- [ ] Create 6-8 small Linear issues when the request is campaign-sized.
- [ ] Avoid parent, epic, umbrella, or catch-all tasks as runnable automation issues.
- [ ] Preserve dependency order.
- [ ] Add blocked-by relationships for ordinary dependencies.
- [ ] Keep each issue small enough for one Level 4 role pass.
- [ ] Include Goal.
- [ ] Include Current state.
- [ ] Include Files likely involved.
- [ ] Include Scope.
- [ ] Include Do-not-touch list.
- [ ] Include Acceptance criteria.
- [ ] Include Tests required.
- [ ] Include Validation commands.
- [ ] Include Manual QA.
- [ ] Include Risk level.
- [ ] Include Suggested labels.
- [ ] Include Role label.
- [ ] Include Type label.
- [ ] Include Risk label.
- [ ] Include Validation profile.
- [ ] Include Review cadence.
- [ ] Include Dependency order.
- [ ] Include Visible UI expectation.
- [ ] Include Central-file conflict risk.
- [ ] Make Reviewer issue titles cadence-specific, such as `Reviewer: paired-review PR for <issue id/title>` or `Reviewer: final audit for <campaign name>`.

## Label Normalization

- [ ] Apply exactly one `role:*` label to every issue where applicable.
- [ ] Apply exactly one `type:*` label to every issue where applicable.
- [ ] Apply exactly one `risk:*` label to every issue where applicable.
- [ ] Apply exactly one `validation:*` label to every issue where applicable.
- [ ] Use `needs-human-approval` for human gates.
- [ ] Use `human-only` and `risk:human-only` where automation must never run.
- [ ] Use Linear blocked-by / blocks relations for dependency-blocked work.
- [ ] Do not use the `blocked` label for ordinary campaign dependency sequencing.
- [ ] Do not use `agent-ready` for new routing.
- [ ] Do not use `human-review` to mean reviewer-agent work.

## Grooming

- [ ] Run the Campaign Groomer before stopping.
- [ ] Confirm all campaign issues are in the declared active Linear project.
- [ ] Confirm the grooming comment includes the active Linear project.
- [ ] Confirm the campaign context pack includes the active Linear project when present.
- [ ] Confirm release summary expectations include the active Linear project.
- [ ] Confirm the grooming comment includes review cadence.
- [ ] Confirm only one issue in the dependency chain is `Todo` + `automation-ready`.
- [ ] Confirm the exposed issue is the first safe Architect issue unless a human explicitly approved another safe first issue.
- [ ] Confirm no Coder issue became automation-ready directly from request intake.
- [ ] Confirm no issue with unresolved blocked-by relations has `automation-ready`.
- [ ] Confirm no `needs-human-approval` issue has `automation-ready`.
- [ ] Confirm no `human-only` issue has `automation-ready`.
- [ ] Confirm no `risk:human-only` issue has `automation-ready`.
- [ ] Confirm no unexpected `automation-ready` issue exists in another visible Tanchiki campaign project.
- [ ] Confirm cross-project dependencies are absent unless explicitly documented.
- [ ] If campaign issues are split across projects, stop for human triage instead of moving them.
- [ ] Confirm Coder issues remain Backlog with blocked-by relations until Architect and human gates are complete.
- [ ] Confirm Test issues remain Backlog with blocked-by relations until implementation PRs are merged or ready.
- [ ] Confirm Reviewer issues remain Backlog with blocked-by relations until implementation or test PRs exist.
- [ ] Confirm Release issues remain Backlog with blocked-by relations until review is complete.
- [ ] For `paired-review`, confirm each Coder/Test issue blocks its paired Reviewer issue and each paired Reviewer blocks the next Coder/Test issue.
- [ ] For `final-audit`, confirm the final-audit Reviewer runs only after implementation/test PRs are merged or explicitly abandoned.
- [ ] Add a grooming comment with queue order and human gates.

## Final Report

- [ ] Report issue identifiers and titles.
- [ ] Report Linear project mode.
- [ ] Report active Linear project.
- [ ] Report campaign name.
- [ ] Report role/type/risk/validation for each issue.
- [ ] Report selected or deferred review cadence.
- [ ] Report dependency order.
- [ ] Report the first eligible issue.
- [ ] Report blocked-by dependencies.
- [ ] Report human approval gates.
- [ ] Report visible UI expectations.
- [ ] Report central-file conflict risks.
- [ ] Report whether any automation-ready issues exist outside the active project.
- [ ] Report next human action.
- [ ] Stop after reporting the groomed queue.
- [ ] Do not edit source files.
- [ ] Do not open a PR during planning.
- [ ] Do not merge anything.
- [ ] Do not mark issues `Done`.
