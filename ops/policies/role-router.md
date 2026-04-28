# Level 4 Role Router Policy

The Level 4 Dispatcher is the default automation entrypoint for Tanchiki. It selects one eligible Linear issue and routes it to the correct Level 4 role.

## Purpose

Use the router when a user asks Codex to continue the next Tanchiki issue without naming a role. The router must choose a role before any role-specific work starts.

## Eligibility

The router scans all `Todo` issues in the Tanchiki project. It must skip blocked or gated issues instead of stopping at the first one.

An issue is eligible only when all of these are true:

- `Todo`
- labeled `automation-ready`
- has exactly one `role:*` label
- not blocked by another issue
- not labeled `blocked`
- not labeled `needs-human-approval`
- not labeled `human-only`
- not canceled
- not `Done`

The router must read the full issue before making a routing decision.

## Label Taxonomy

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Gate labels:

- `needs-human-approval`
- `blocked`
- `human-only`

Deprecated ambiguous usage:

- Do not use `agent-ready` for new Level 4 routing.
- Do not use `human-review` to mean reviewer-agent work.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.

## Role Mapping

Use the single `role:*` label. Description classification may confirm intent, but it must not override missing or conflicting role labels.

| Signal | Route |
| --- | --- |
| `role:architect` | Architect |
| `role:coder` | Coder |
| `role:test` | Test |
| `role:reviewer` | Reviewer |
| `role:release` | Release |
| Missing `role:*` label | Stop and comment asking for triage |
| Multiple `role:*` labels | Stop and comment asking for triage |
| `blocked`, `needs-human-approval`, or `human-only` | Skip and report when no eligible issue exists |

## Hard Stops

Stop before changing code or issue state if:

- the issue is blocked or dependency-gated
- the issue has `needs-human-approval` or `human-only`
- the classification conflicts with the labels
- multiple roles appear equally plausible or multiple `role:*` labels are present
- the issue looks like a parent, epic, campaign umbrella, or safety-critical item
- more than one issue in a dependency chain is simultaneously exposed as `Todo` + `automation-ready`

When stopping for ambiguity, add a Linear comment that states the missing or conflicting routing signals and asks for triage.

## Role Boundaries

- Work one issue only.
- Never let Coder implement `role:architect`, `role:test`, `role:reviewer`, or `role:release` issues.
- Never let Architect edit source code.
- Never let Test agent add gameplay features.
- Never let Reviewer merge PRs.
- Never let Release agent change gameplay behavior.
- Never bypass `blocked`, `needs-human-approval`, or `human-only` labels.
- Never mark an issue `Done` unless the selected role protocol explicitly allows it.

## Repository Rules

For roles that need repository work, start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Open PRs only when the selected role allows PRs. Every PR must target `main`, remain unmerged, and pass:

```powershell
npm test
npm run build
npm run lint
```

## Output

The router must state:

- selected issue ID and title
- selected role
- role label used
- any hard-stop reason
- skipped blocked/gated candidates if no issue is eligible
- next protocol file to follow
- whether repository work and a PR are allowed
