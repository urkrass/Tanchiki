# Codex Role Router

Use this prompt when the user asks Codex to continue Tanchiki work without naming a Level 4 role.

## Goal

Inspect the next eligible Linear issue and choose the correct Level 4 role automatically: Architect, Coder, Test, Reviewer, or Release.

## Required Reading

- `AGENTS.md`
- `README.md`
- `ops/policies/role-router.md`
- `ops/policies/role-boundaries.md`
- `ops/checklists/role-routing-checklist.md`
- the selected Linear issue in full

## Selection

Use Linear MCP to search the Tanchiki project for the highest-priority issue that is:

- status `Todo`
- labeled `agent-ready` or with a specific role label
- not blocked by another issue
- not labeled `blocked`
- not labeled `human-only`
- not canceled
- not `Done`

If no issue qualifies, stop and report that the queue has no routable issue.

## Role Mapping

- `architect-review` label or classification: Architect agent
- `coder-ready` label or implementation scope with `agent-ready`: Coder agent
- `test-agent` label or classification: Test agent
- `reviewer-agent` label or classification: Reviewer agent
- `release-agent` label or classification: Release agent
- `agent-ready` plus implementation scope: Coder agent
- `agent-ready` plus architect-review classification: Architect agent
- `human-review` only: stop and ask for human action
- `blocked/dependency`: stop
- missing or ambiguous classification: stop and comment on the Linear issue asking for triage

## Routing Guards

- Work one issue only.
- Never route architect-review, test-agent, reviewer-agent, or release-agent issues to Coder.
- Never let Architect edit source code.
- Never let Test agent add gameplay features.
- Never let Reviewer merge PRs.
- Never let Release agent change gameplay behavior.
- Never bypass `human-review`.
- If the role cannot be determined confidently, stop and comment on the Linear issue.

## After Routing

Announce the selected issue, role, and reason.

Then follow the selected role prompt:

- Architect: `ops/prompts/architect-agent.md`
- Coder: `ops/prompts/coder-agent.md`
- Test: `ops/prompts/test-agent.md`
- Reviewer: `ops/prompts/reviewer-agent.md`
- Release: `ops/prompts/release-agent.md`

Start from updated `main` only when the selected role requires repository work.

Do not merge.
