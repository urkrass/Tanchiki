# Codex Role Router

Use this prompt when the user asks Codex to continue Tanchiki work without naming a Level 4 role.

## Goal

Inspect the next eligible Linear issue and choose the correct Level 4 role automatically from explicit role labels: Architect, Coder, Test, Reviewer, or Release. Apply Level 5 risk-gated validation before routing.

## Required Reading

- `AGENTS.md`
- `README.md`
- `ops/policies/role-router.md`
- `ops/policies/risk-gated-validation.md`
- `ops/policies/role-boundaries.md`
- `ops/checklists/role-routing-checklist.md`
- `ops/checklists/risk-gate-checklist.md`
- the selected Linear issue in full

## Selection

Use Linear MCP to scan all `Todo` issues in the Tanchiki project.

An issue is eligible only when all of these are true:

- status is `Todo`
- has `automation-ready`
- has exactly one `role:*` label
- has exactly one `type:*` label
- has exactly one `risk:*` label
- has exactly one `validation:*` label
- does not have `blocked`
- does not have `needs-human-approval`
- does not have `human-only`
- does not have `risk:human-only`
- is not blocked by another issue
- is not canceled or `Done`

Skip blocked or gated issues while scanning. Do not stop at the first gated issue.

If no issue qualifies, stop and report all blocked/gated candidates plus the human action needed for each.

## Role Mapping

- `role:architect`: Architect agent
- `role:coder`: Coder agent
- `role:test`: Test agent
- `role:reviewer`: Reviewer agent
- `role:release`: Release agent

Deprecated signals:

- Do not use `agent-ready` for new Level 4 routing.
- Do not use `human-review` to mean reviewer work.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.

## Routing Guards

- Work one issue only.
- Never route work without exactly one `role:*` label.
- Never route work without exactly one `type:*`, `risk:*`, and `validation:*` label.
- Never route Architect, Test, Reviewer, or Release work to Coder.
- Never let Architect edit source code.
- Never let Test agent add gameplay features.
- Never let Reviewer merge PRs.
- Never let Release agent change gameplay behavior.
- Never bypass `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only`.
- If Level 5 metadata is missing or ambiguous, stop and comment on the Linear issue asking for triage.
- Refusal comments must be short and must name the failing rows: role, type, risk, validation, and gate labels. Use this shape: "Dispatcher stopped: this issue is not eligible for automation yet. Fix Level 5 metadata before retrying: <specific missing, duplicated, or gated labels>."

## After Routing

Announce the selected issue, role, and role-label reason.

Then follow the selected role prompt:

- Architect: `ops/prompts/architect-agent.md`
- Coder: `ops/prompts/coder-agent.md`
- Test: `ops/prompts/test-agent.md`
- Reviewer: `ops/prompts/reviewer-agent.md`
- Release: `ops/prompts/release-agent.md`

Start from updated `main` only when the selected role requires repository work.

Do not merge.
Do not mark Done.
