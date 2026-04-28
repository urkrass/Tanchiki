# Level 4 Role Router Policy

The Level 4 Dispatcher is the default automation entrypoint for Tanchiki. It selects one eligible Linear issue and routes it to the correct Level 4 role.

## Purpose

Use the router when a user asks Codex to continue the next Tanchiki issue without naming a role. The router must choose a role before any role-specific work starts.

## Eligibility

The router may consider only issues in the Tanchiki project that are:

- `Todo`
- labeled `agent-ready` or labeled for a specific role
- not blocked by another issue
- not labeled `blocked`
- not labeled `human-only`
- not canceled
- not `Done`

The router must read the full issue before making a routing decision.

## Role Mapping

Use labels first, then the issue description classification and scope.

| Signal | Route |
| --- | --- |
| `architect-review` label or classification | Architect |
| `coder-ready` label | Coder |
| `test-agent` label or classification | Test |
| `reviewer-agent` label or classification | Reviewer |
| `release-agent` label or classification | Release |
| `agent-ready` plus implementation scope | Coder |
| `agent-ready` plus architect-review classification | Architect |
| `human-review` only | Stop for human action |
| `blocked/dependency` classification | Stop |
| Missing or ambiguous classification | Stop and comment asking for triage |

## Hard Stops

Stop before changing code or issue state if:

- the issue is blocked or dependency-gated
- the issue is `human-review` only
- the classification conflicts with the labels
- multiple roles appear equally plausible
- the issue looks like a parent, epic, campaign umbrella, or safety-critical item
- more than one issue in a dependency chain is simultaneously exposed as `Todo` + `agent-ready`

When stopping for ambiguity, add a Linear comment that states the missing or conflicting routing signals and asks for triage.

## Role Boundaries

- Work one issue only.
- Never let Coder implement architect-review, test-agent, reviewer-agent, or release-agent issues.
- Never let Architect edit source code.
- Never let Test agent add gameplay features.
- Never let Reviewer merge PRs.
- Never let Release agent change gameplay behavior.
- Never bypass `human-review` labels.
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
- routing signals used
- any hard-stop reason
- next protocol file to follow
- whether repository work and a PR are allowed
