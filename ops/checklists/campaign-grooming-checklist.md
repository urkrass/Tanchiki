# Campaign Grooming Checklist

Use this checklist after a Planner creates or revises a campaign queue and before automation starts.

- [ ] Read every campaign issue in Linear.
- [ ] Confirm each issue has exactly one suggested or applied `role:*` label:
  - `role:architect`
  - `role:coder`
  - `role:test`
  - `role:reviewer`
  - `role:release`
- [ ] Confirm no issue uses `human-review` to mean reviewer work.
- [ ] Confirm no new issue depends on broad `agent-ready` routing.
- [ ] Confirm human gates use `needs-human-approval`.
- [ ] Confirm blocked/dependency gates use `blocked` or explicit blocked-by relationships.
- [ ] Confirm human-only work uses `human-only`.
- [ ] Confirm parent, epic, and campaign umbrella issues do not have `automation-ready`.
- [ ] Confirm exactly one issue in each dependency chain is `Todo` + `automation-ready`.
- [ ] Confirm the automation-ready issue has exactly one `role:*` label.
- [ ] Confirm all later dependency issues remain Backlog, `blocked`, or `needs-human-approval`.
- [ ] Confirm the recommended first automation issue is documented for human approval.
- [ ] Comment on any issue with missing or ambiguous labels asking for triage.
- [ ] Do not edit gameplay code.
- [ ] Do not modify `src/game/movement.js`.
