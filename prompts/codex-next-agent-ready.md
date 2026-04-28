# Deprecated Next Agent-Ready Prompt

This prompt is retained only for historical references. New automation must use `prompts/codex-next.md`.

Use Linear MCP and GitHub.

Run the Level 4 Dispatcher for the next eligible Tanchiki issue.
Choose the correct role automatically from role labels.
Follow repo harness protocols.
Work one issue only.
Do not merge.
Do not mark Done.

Eligibility now requires:

- status is `Todo`
- label includes `automation-ready`
- exactly one `role:*` label is present
- label does not include `blocked`
- label does not include `needs-human-approval`
- label does not include `human-only`
- issue is not blocked by another issue
- issue is not a parent, epic, or campaign umbrella
- issue is not safety-critical

Deprecated:

- Do not use `agent-ready` for new routing.
- Do not use `human-review` to mean reviewer work.

Follow `prompts/codex-next.md`, `ops/policies/role-router.md`, and `ops/checklists/role-routing-checklist.md`.
