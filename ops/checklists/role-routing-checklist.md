# Role Routing Checklist

Use this checklist before starting any Level 4 role-specific work.

- [ ] Queried Linear MCP for all Tanchiki `Todo` issues.
- [ ] Skipped issues labeled `blocked`, `needs-human-approval`, or `human-only`.
- [ ] Selected one highest-priority eligible issue only.
- [ ] Read the full issue, including labels, status, description, and relations.
- [ ] Confirmed the issue has `automation-ready`.
- [ ] Confirmed the issue has exactly one `role:*` label.
- [ ] Confirmed the issue has exactly one `type:*` label.
- [ ] Confirmed the issue has exactly one `risk:*` label.
- [ ] Confirmed the issue has exactly one `validation:*` label.
- [ ] Confirmed the issue is not blocked, canceled, `Done`, `human-only`, `needs-human-approval`, or labeled `blocked`.
- [ ] Confirmed the issue is not labeled `risk:human-only`.
- [ ] Confirmed the issue is not a parent, epic, campaign umbrella, or safety-critical item.
- [ ] Confirmed deprecated `agent-ready` or `human-review` usage is not being used for routing.
- [ ] Identified the route from the single `role:*` label.
- [ ] Routed with `ops/policies/role-router.md`.
- [ ] Stopped and commented in Linear if role labels were missing, ambiguous, or conflicting.
- [ ] Stopped and commented in Linear if type, risk, or validation labels were missing, ambiguous, or conflicting.
- [ ] Refusal comments name the exact invalid rows: role, type, risk, validation, and gate labels.
- [ ] Refusal comments identify `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only` gates when present.
- [ ] If no eligible issue exists, reported all blocked/gated candidates and required human actions.
- [ ] Confirmed the selected role's authority in `ops/policies/role-boundaries.md`.
- [ ] Loaded the selected role prompt from `ops/prompts/`.
- [ ] Started from updated `main` if the selected role needs repository work.
- [ ] Confirmed whether the selected role may open a PR.
- [ ] Confirmed no role will merge or mark `Done` unless explicitly allowed.
