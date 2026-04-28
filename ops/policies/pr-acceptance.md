# PR Acceptance Policy

Use this policy when reviewing, approving, or preparing Tanchiki pull requests for merge. It adds an acceptance layer on top of the existing Level 5 metadata, CI, PR metadata check, branch protection, and human-control rules.

This policy does not authorize direct merges, branch-protection changes, CI bypasses, deployment changes, dependency changes, or gameplay changes. Any auto-merge implementation must be separately approved and must preserve the gates in this document.

## Acceptance Tiers

### Recommendation Only

Any agent may summarize whether a PR appears ready, blocked, risky, or unclear.

Recommendation-only output does not grant approval or merge authority. Use this tier by default for high-risk, ambiguous, gameplay, rendering, progression, deployment, dependency, workflow, persistence, security-sensitive, or public-demo-impacting changes.

### Reviewer-Agent Accepted

A `role:reviewer` agent may recommend acceptance after checking:

- PR metadata completeness
- linked Linear issue and Level 5 labels
- diff scope and file ownership boundaries
- validation evidence
- CI state
- gameplay, movement, progression, deployment, dependency, and security boundaries
- conflict risk and manual QA notes

Reviewer-agent acceptance may support a `reviewer:approved` or `merge:agent-approved` label only when the reviewer is independent from the Coder or Test agent that authored the PR.

Reviewer agents must not merge, push commits to the PR branch, or approve their own work.

### Human Required

Human approval is required whenever a PR falls outside the auto-eligible category, has unclear scope, touches a protected area, or changes repository governance.

Use `merge:human-required` when a PR may proceed only after human approval. Use `merge:do-not-merge` when the PR has a hard blocking problem.

### Auto-Merge Eligible

Auto-merge eligibility is limited to narrow, low-risk work after explicit human approval of the policy and any workflow that enforces it.

An eligible PR must satisfy every gate in this policy. `merge:auto-eligible` is never enough by itself; it is only one required signal among CI, metadata, branch protection, independent approval, issue state, and changed-file safety.

### Do Not Merge

`merge:do-not-merge` is the highest-priority stop signal. It overrides:

- `merge:auto-eligible`
- `merge:agent-approved`
- `reviewer:approved`
- any positive review summary

## Required Merge And Review Labels

The repository uses these PR acceptance labels:

- `merge:auto-eligible` - PR may enter the auto-merge path if every other gate passes.
- `merge:agent-approved` - independent reviewer-agent accepted the PR under this policy; not sufficient alone for auto-merge.
- `merge:human-required` - human approval is required before merge or before auto-merge eligibility.
- `merge:do-not-merge` - hard stop; overrides all positive labels.
- `reviewer:approved` - independent reviewer or human approval signal.
- `reviewer:changes-requested` - blocking review findings exist; incompatible with auto-merge.

### Label Ownership

| Label | Who may add it | Who may remove it | Notes |
| --- | --- | --- | --- |
| `merge:auto-eligible` | Human, or a future workflow explicitly approved by a human | Human, Reviewer, or approved workflow | Requires every auto-merge gate. Must not be added by the PR author. |
| `merge:agent-approved` | Independent Reviewer agent | Human, Reviewer, or approved workflow | Records reviewer-agent acceptance only. It is not merge authority by itself. |
| `merge:human-required` | Human, Reviewer, Coder, Test, or approved workflow | Human only, unless the same Reviewer removes it after documented resolution | Use when policy requires human judgment before merge. |
| `merge:do-not-merge` | Human, Reviewer, Coder, Test, or approved workflow | Human only, unless the same Reviewer removes it after documented resolution | Hard stop. Overrides every positive label. |
| `reviewer:approved` | Human or independent Reviewer agent | Human, Reviewer, or approved workflow | Must not be added by the Coder or Test author of the PR. |
| `reviewer:changes-requested` | Human or independent Reviewer agent | Human, Reviewer, or approved workflow after changes are resolved | Blocks auto-merge and reviewer-agent acceptance. |

Agents may add stop labels to protect the repository, but positive acceptance
labels require independent review or human action. If there is any doubt about
who authored the PR, do not add positive labels.

### Label Transitions

- New PRs start with no positive acceptance label.
- Add `merge:human-required` when the PR touches a gated category or the reviewer cannot prove auto-merge eligibility.
- Add `merge:do-not-merge` when CI fails, metadata is missing, scope is unsafe, branch protection is bypassed, or the PR should not merge in its current state.
- Add `reviewer:changes-requested` when review findings require code, docs, tests, validation, or scope changes.
- Add `reviewer:approved` only after independent review passes and no stop labels are present.
- Add `merge:agent-approved` only after independent Reviewer-agent acceptance under this policy.
- Add `merge:auto-eligible` only after every auto-merge gate passes and no exclusion applies.
- Remove or refresh positive labels after any new commit unless the approval is explicitly rechecked.
- `merge:do-not-merge` and `reviewer:changes-requested` must be removed before any positive acceptance label can be acted on.
- `merge:human-required` must be removed by a human before any auto-merge path can proceed.

### GitHub Label Setup

If any required label does not exist in GitHub, create it manually or through a
separate approved repository administration step. Recommended colors:

- `merge:auto-eligible`: green
- `merge:agent-approved`: blue
- `merge:human-required`: orange
- `merge:do-not-merge`: red
- `reviewer:approved`: green
- `reviewer:changes-requested`: red

Label creation must not weaken branch protection, grant broad repository
permissions, change workflows, or imply that auto-merge is implemented.

## Auto-Merge Hard Exclusions

Auto-merge must not be available for PRs that involve any of the following:

- movement, collision, spawning, interpolation, or control-feel changes
- `type:movement` or `validation:movement`
- `risk:high`
- `risk:human-only`
- `needs-human-approval`, `human-only`, or `blocked` on the linked Linear issue
- deployment workflow changes, including GitHub Pages
- dependency changes, package manager changes, or lockfile changes
- CI workflow changes
- PR metadata workflow changes
- branch-protection-adjacent changes
- auto-merge workflow changes
- broad gameplay changes
- medium or high-risk gameplay, rendering, progression, or public-demo-impacting changes unless a human remains the approving authority
- save or persistence behavior
- security-sensitive changes, secrets, credentials, permissions, tokens, or repository settings
- ambiguous metadata, missing validation evidence, failing CI, pending CI, or stale approval after new commits

When in doubt, use `merge:human-required`.

## Minimum Auto-Merge Gates

Any future auto-merge workflow or documented procedure must require all of these:

- PR targets `main`.
- PR is not draft.
- PR has a linked Linear issue.
- PR body includes role, type, risk, validation profile, tests run, manual QA, conflict risk, visible UI expectation, and known limitations.
- PR metadata check passes.
- CI passes.
- Branch protection requirements are satisfied and not bypassed.
- Exactly one role, type, risk, and validation profile are declared.
- PR classification matches the linked Linear issue.
- Linked Linear issue is not blocked, `human-only`, `risk:human-only`, or `needs-human-approval`.
- Changed files are allowed for the declared role, type, risk, and validation profile.
- `merge:auto-eligible` is present.
- `merge:do-not-merge` is absent.
- `merge:human-required` is absent.
- `reviewer:changes-requested` is absent.
- Independent approval is present through `reviewer:approved` or an approved human label.
- The approval actor is not the Coder or Test author of the PR.
- New commits after approval require approval to be rechecked or refreshed.

## Independence Rule

Coder and Test agents must not approve, label as accepted, or merge their own PRs. Reviewer approval must come from a separate reviewer-agent pass or a human.

If actor independence cannot be proven mechanically, auto-merge must remain unavailable and the PR must use human-controlled merge.

## Workflow Changes

Changes to GitHub Actions workflows, PR metadata checks, branch-protection-adjacent logic, deployment, dependencies, or this acceptance policy are not auto-merge eligible. They require normal human-controlled review and merge.

## Relationship To Existing Protocol

This policy adds stricter acceptance rules; it does not remove existing requirements from `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, `SAFETY_BOUNDARIES.md`, or the PR review checklist.

If any rule conflicts, use the stricter rule and require human review.
