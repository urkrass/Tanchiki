# Campaign Factory Checklist

Use this checklist when converting a self-service campaign request into a groomed Linear campaign.

## Intake

- [ ] Read `.github/ISSUE_TEMPLATE/campaign-request.yml` or the equivalent pasted request.
- [ ] Confirm the request names a campaign goal.
- [ ] Confirm the current state is described.
- [ ] Confirm constraints and do-not-touch areas are listed.
- [ ] Confirm requested campaign shape or issue count is provided.
- [ ] Confirm human gates are listed or explicitly absent.
- [ ] Confirm validation expectations are listed.
- [ ] Confirm visible UI expectation is stated.
- [ ] Confirm non-goals are stated.
- [ ] If required fields are missing, create or report a human-gated clarification item instead of guessing.

## Classification

- [ ] Classify the request as `safe planning request`, `needs-human-approval`, or `human-only`.
- [ ] Split mixed requests so unsafe decisions become separate human gate issues.
- [ ] Gate gameplay behavior, progression, level tuning, dependency additions, broad architecture, public-demo release decisions, and screenshot pass/fail CI decisions when needed.
- [ ] Mark movement, collision, spawning, control feel, persistence, credentials, destructive repository work, and broad rewrites as human-only unless a human explicitly approves automation.

## Issue Creation

- [ ] Create 6-8 small Linear issues when the request is campaign-sized.
- [ ] Avoid parent, epic, umbrella, or catch-all tasks as runnable automation issues.
- [ ] Preserve dependency order.
- [ ] Add blocked-by relationships where possible.
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
- [ ] Include Dependency order.
- [ ] Include Visible UI expectation.
- [ ] Include Central-file conflict risk.

## Label Normalization

- [ ] Apply exactly one `role:*` label to every issue where applicable.
- [ ] Apply exactly one `type:*` label to every issue where applicable.
- [ ] Apply exactly one `risk:*` label to every issue where applicable.
- [ ] Apply exactly one `validation:*` label to every issue where applicable.
- [ ] Use `needs-human-approval` for human gates.
- [ ] Use `human-only` and `risk:human-only` where automation must never run.
- [ ] Use `blocked` for dependency-blocked work.
- [ ] Do not use `agent-ready` for new routing.
- [ ] Do not use `human-review` to mean reviewer-agent work.

## Grooming

- [ ] Run the Campaign Groomer before stopping.
- [ ] Confirm only one issue in the dependency chain is `Todo` + `automation-ready`.
- [ ] Confirm the exposed issue is the first safe Architect issue unless a human explicitly approved another safe first issue.
- [ ] Confirm no Coder issue became automation-ready directly from request intake.
- [ ] Confirm no blocked issue has `automation-ready`.
- [ ] Confirm no `needs-human-approval` issue has `automation-ready`.
- [ ] Confirm no `human-only` issue has `automation-ready`.
- [ ] Confirm no `risk:human-only` issue has `automation-ready`.
- [ ] Confirm Coder issues remain Backlog or blocked until Architect and human gates are complete.
- [ ] Confirm Test issues remain blocked until implementation PRs are merged or ready.
- [ ] Confirm Reviewer issues remain blocked until implementation or test PRs exist.
- [ ] Confirm Release issues remain blocked until review is complete.
- [ ] Add a grooming comment with queue order and human gates.

## Final Report

- [ ] Report issue identifiers and titles.
- [ ] Report role/type/risk/validation for each issue.
- [ ] Report dependency order.
- [ ] Report the first eligible issue.
- [ ] Report blocked issues.
- [ ] Report human approval gates.
- [ ] Report visible UI expectations.
- [ ] Report central-file conflict risks.
- [ ] Report next human action.
- [ ] Stop after reporting the groomed queue.
- [ ] Do not edit source files.
- [ ] Do not open a PR during planning.
- [ ] Do not merge anything.
- [ ] Do not mark issues `Done`.
