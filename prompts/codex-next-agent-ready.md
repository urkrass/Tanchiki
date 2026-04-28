# Deprecated Next Agent-Ready Prompt

This prompt is retained only for historical references. New automation must use `prompts/codex-next.md`.

Use Linear MCP and GitHub.

Run the Tanchiki dispatcher for the next eligible issue.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.

Eligibility now requires:

- status is `Todo`
- label includes `automation-ready`
- exactly one `role:*` label is present
- exactly one `type:*` label is present
- exactly one `risk:*` label is present
- exactly one `validation:*` label is present
- label does not include `blocked`
- label does not include `needs-human-approval`
- label does not include `human-only`
- label does not include `risk:human-only`
- issue is not blocked by another issue
- issue is not a parent, epic, or campaign umbrella
- issue is not safety-critical

Deprecated:

- Do not use `agent-ready` for new routing.
- Do not use `human-review` to mean reviewer work.

Follow `prompts/codex-next.md`, `ops/policies/role-router.md`, `ops/policies/risk-gated-validation.md`, `ops/checklists/role-routing-checklist.md`, and `ops/checklists/risk-gate-checklist.md`.
