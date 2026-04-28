# Campaign Grooming Checklist

Use this checklist after a Planner creates or revises a campaign queue and before automation starts.

- [ ] Read every campaign issue in Linear.
- [ ] Confirm each issue has exactly one applied `role:*` label where applicable:
  - `role:architect`
  - `role:coder`
  - `role:test`
  - `role:reviewer`
  - `role:release`
- [ ] Fix classification mismatches before automation starts, for example human review gates mislabeled as Coder work.
- [ ] Confirm no issue uses `human-review` to mean reviewer work.
- [ ] Confirm no new issue depends on broad `agent-ready` routing.
- [ ] Confirm human gates use `needs-human-approval`.
- [ ] Confirm blocked/dependency gates use `blocked` or explicit blocked-by relationships.
- [ ] Confirm human-only work uses `human-only`.
- [ ] Confirm parent, epic, and campaign umbrella issues do not have `automation-ready`.
- [ ] Confirm exactly one issue in each dependency chain is `Todo` + `automation-ready`.
- [ ] Confirm the automation-ready issue has exactly one `role:*` label.
- [ ] Confirm no issue has `automation-ready` with `blocked`, `needs-human-approval`, or `human-only`.
- [ ] If architecture review is required first, confirm only the first Architect issue is `Todo` + `role:architect` + `automation-ready`.
- [ ] Confirm no Coder issue is automation-ready immediately after planning unless the user explicitly requested it.
- [ ] Confirm all later dependency issues remain Backlog, `blocked`, or `needs-human-approval`.
- [ ] Confirm Coder issues stay Backlog/blocked until Architect and human gates are done.
- [ ] Confirm Test issues stay blocked until implementation PRs are merged or ready.
- [ ] Confirm Reviewer issues stay blocked until implementation/test PRs exist.
- [ ] Confirm Release issues stay blocked until review is done.
- [ ] Confirm the recommended first automation issue is documented for human approval.
- [ ] Add a grooming comment summarizing queue order and required human actions.
- [ ] Comment on any issue with missing or ambiguous labels asking for triage.
- [ ] Do not edit gameplay code.
- [ ] Do not modify `src/game/movement.js`.
