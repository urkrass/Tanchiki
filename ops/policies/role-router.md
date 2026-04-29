# Level 5 Role Router Policy

The Level 5 Dispatcher is the default automation entrypoint for Tanchiki. It selects one eligible Linear issue and routes it to the correct Level 4 role after applying risk-gated validation.

## Purpose

Use the router when a user asks Codex to continue the next Tanchiki issue without naming a role. The router must choose a role before any role-specific work starts.

## Eligibility

The router scans `Todo` issues in the declared active Linear project. It must
skip blocked or gated issues instead of stopping at the first one.

Dispatcher runs require:

```text
Active Linear project: <Tanchiki project name>
```

If active project is missing and exactly one unambiguous eligible issue exists
across visible Tanchiki projects, the router may report that project and issue
before acting. If active project is missing and multiple eligible issues exist
across Tanchiki projects, the router must stop and ask for human triage. It
must not run issues from another campaign project.

An issue is eligible only when all of these are true:

- issue is in the declared active Linear project, or is the single unambiguous
  eligible issue across visible Tanchiki projects when no active project was
  supplied
- status is `Todo`
- has `automation-ready`
- has exactly one `role:*` label
- has exactly one `type:*` label
- has exactly one `risk:*` label
- has exactly one `validation:*` label
- not blocked by another issue
- not labeled `blocked`
- not labeled `needs-human-approval`
- not labeled `human-only`
- not labeled `risk:human-only`
- not canceled
- not `Done`

The router must read the full issue before making a routing decision. If required metadata is missing or duplicated, the router must stop and comment on the Linear issue asking for triage.

## Campaign Grooming Requirements

The router must ignore ungroomed campaign queues. Before selecting a campaign issue, inspect other Todo and automation-ready issues in the same campaign or dependency chain when identifiable from issue text, parent links, project context, labels, or blocked-by relationships.

Stop and ask for campaign grooming before changing issue state or repository files if:

- any Todo candidate lacks exactly one `role:*` label
- any Todo candidate lacks exactly one `type:*`, `risk:*`, or `validation:*` label
- more than one issue in the campaign or dependency chain has `automation-ready`
- any issue has `automation-ready` together with `blocked`, `needs-human-approval`, or `human-only`
- any issue has `automation-ready` together with `risk:human-only`
- an implementation issue is automation-ready immediately after planning while an Architect review or human gate is still open
- role labels conflict with the issue classification, for example a human review gate labeled `role:coder`
- multiple visible Tanchiki projects contain eligible `automation-ready` issues
  and no active project was declared

When stopping, add a Linear comment that asks for the Campaign Groomer and names the unsafe labels or statuses.

## Label Taxonomy

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Issue type labels:

- `type:docs`
- `type:harness`
- `type:ui`
- `type:test`
- `type:gameplay`
- `type:progression`
- `type:architecture`
- `type:movement`

Risk labels:

- `risk:low`
- `risk:medium`
- `risk:high`
- `risk:human-only`

Validation profile labels:

- `validation:docs`
- `validation:harness`
- `validation:ui`
- `validation:test`
- `validation:gameplay`
- `validation:progression`
- `validation:movement`

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
| Missing or multiple `type:*`, `risk:*`, or `validation:*` labels | Stop and comment asking for triage |
| `risk:human-only` | Skip; dispatcher must not automate |

## Hard Stops

Stop before changing code or issue state if:

- the active Linear project is missing and eligible issues are ambiguous across
  Tanchiki projects
- the selected issue is outside the declared active Linear project
- the issue is blocked or dependency-gated
- the issue has `needs-human-approval` or `human-only`
- the issue has `risk:human-only`
- the classification conflicts with the labels
- multiple roles appear equally plausible or multiple `role:*` labels are present
- multiple type, risk, or validation labels are present
- required Level 5 metadata is missing
- the issue looks like a parent, epic, campaign umbrella, or safety-critical item
- more than one issue in a dependency chain is simultaneously exposed as `Todo` + `automation-ready`
- the campaign appears ungroomed under the Campaign Grooming Requirements

When stopping for ambiguity, add a Linear comment that states the missing or conflicting routing signals and asks for triage.

## Refusal Comment Copy

Use short, specific Linear comments when refusing a candidate:

```text
Dispatcher stopped: this issue is not eligible for automation yet.

Fix Level 5 metadata before retrying:
- role labels: expected exactly one `role:*`, found <value>
- type labels: expected exactly one `type:*`, found <value>
- risk labels: expected exactly one `risk:*`, found <value>
- validation labels: expected exactly one `validation:*`, found <value>
- gate labels: remove any of `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only` before adding `automation-ready`
```

Omit rows that are already valid. If `automation-ready` appears with a gate label, say which gate blocks automation and ask for Campaign Groomer or human triage.

## Role Boundaries

- Work one issue only.
- Never let Coder implement `role:architect`, `role:test`, `role:reviewer`, or `role:release` issues.
- Never let Architect edit source code.
- Never let Test agent add gameplay features.
- Never let Reviewer merge PRs.
- Never let Release agent change gameplay behavior.
- Never bypass `blocked`, `needs-human-approval`, or `human-only` labels.
- Never bypass `risk:human-only`.
- Never mark an issue `Done` unless the selected role protocol explicitly allows it.

## Repository Rules

For roles that need repository work, start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Open PRs only when the selected role allows PRs. Every PR must target `main`, remain unmerged, include Level 5 PR metadata, and pass the selected `validation:*` profile. Baseline validation is:

```powershell
npm test
npm run build
npm run lint
```

## Output

The router must state:

- active Linear project
- selected issue ID and title
- selected role
- role label used
- type label, risk label, and validation profile used
- any hard-stop reason
- skipped blocked/gated candidates if no issue is eligible
- ineligible candidates and missing or duplicated metadata
- next protocol file to follow
- whether repository work and a PR are allowed
