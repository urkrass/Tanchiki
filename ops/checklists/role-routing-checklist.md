# Role Routing Checklist

Use this checklist before starting any Level 4 role-specific work.

- [ ] Queried Linear MCP for Tanchiki `Todo` issues with `agent-ready` or role labels.
- [ ] Selected one highest-priority eligible issue only.
- [ ] Read the full issue, including labels, status, description, and relations.
- [ ] Confirmed the issue is not blocked, canceled, `Done`, `human-only`, or labeled `blocked`.
- [ ] Confirmed the issue is not a parent, epic, campaign umbrella, or safety-critical item.
- [ ] Checked whether `human-review` is present and whether it blocks automation.
- [ ] Identified classification from labels and issue description.
- [ ] Routed with `ops/policies/role-router.md`.
- [ ] Stopped and commented in Linear if classification was missing, ambiguous, or conflicting.
- [ ] Confirmed the selected role's authority in `ops/policies/role-boundaries.md`.
- [ ] Loaded the selected role prompt from `ops/prompts/`.
- [ ] Started from updated `main` if the selected role needs repository work.
- [ ] Confirmed whether the selected role may open a PR.
- [ ] Confirmed no role will merge or mark `Done` unless explicitly allowed.
