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

Reviewer-agent acceptance may support a `reviewer:approved` or `merge:agent-approved` label only when the reviewer is independent from the Coder or Test agent that authored the PR. A Reviewer agent must not approve a PR authored by the same Codex session or run, and must not approve its own prior work.

Reviewer agents must not merge, push commits to the PR branch, or approve their own work.

### Human Required

Human approval is required whenever a PR falls outside the auto-eligible category, has unclear scope, touches a protected area, or changes repository governance.

Use `merge:human-required` when a PR may proceed only after human approval. Use `merge:do-not-merge` when the PR has a hard blocking problem.

### Auto-Merge Eligible

Auto-merge eligibility is limited to narrow, low-risk work after explicit human approval of the policy and any workflow that enforces it.

An eligible PR must satisfy every gate in this policy. `merge:auto-eligible` is never enough by itself; it is only one required signal among CI, metadata, branch protection, independent approval, issue state, and changed-file safety.

Draft PRs are a hard veto for auto-merge approval and paired-review approval.
A normal feature PR may remain Draft when that is the clearest review posture
for incomplete, exploratory, ordinary non-paired-review, validation-not-passed,
or human-gated work, but an auto-merge candidate PR, auto-merge burn-in PR, or
paired-review producer PR with passing validation must be marked ready for
review before the Coder or Test session stops.

### Do Not Merge

Stop labels are hard vetoes. The presence of any stop label blocks every
auto-merge lane until a human operator removes the stop label manually.

Stop labels are:

- `merge:do-not-merge`
- `merge:human-required`
- `needs-human-approval`
- `blocked`
- `human-only`
- `risk:human-only`

`merge:do-not-merge` is the highest-priority stop signal. Stop labels override:

- `merge:auto-eligible`
- `merge:agent-approved`
- `reviewer:approved`
- passing CI
- passing PR metadata checks
- low-risk issue metadata
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
| `merge:human-required` | Human, Reviewer, Coder, Test, or approved workflow | Human operator only | Use when policy requires human judgment before merge. Hard veto for auto-merge. |
| `merge:do-not-merge` | Human, Reviewer, Coder, Test, or approved workflow | Human operator only | Hard stop. Overrides every positive label. Hard veto for auto-merge. |
| `reviewer:approved` | Human or independent Reviewer agent | Human, Reviewer, or approved workflow | Must not be added by the Coder or Test author of the PR. |
| `reviewer:changes-requested` | Human or independent Reviewer agent | Human, Reviewer, or approved workflow after changes are resolved | Blocks auto-merge and reviewer-agent acceptance. |

Agents may add stop labels to protect the repository, but positive acceptance
labels require independent review or human action. If there is any doubt about
who authored the PR, do not add positive labels.
Human operators should apply `merge:auto-eligible` only after an independent
Reviewer-agent approval is already recorded on the PR.

### Stop-Label Removal Authority

Stop-label removal is human-controlled.

- Coder agents must not remove stop labels.
- Test agents must not remove stop labels.
- Reviewer agents must not remove stop labels.
- Release agents must not remove stop labels.
- Planner and Groomer agents must not remove stop labels from active PRs.
- Agents may recommend stop-label removal in a PR comment or Linear comment.
- A human operator must remove stop labels manually.
- The only exception is a future explicitly approved automation whose sole
  purpose is gate management. That automation does not exist yet and must be
  separately approved before use.

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

A PR may not enter an auto-merge lane if any stop label is present, regardless
of passing CI, passing PR metadata checks, reviewer-agent approval, low-risk
issue metadata, `merge:auto-eligible`, or `merge:agent-approved`.

### Reviewer-Agent Language

PR acceptance review is `paired-review`: the Reviewer inspects an open,
non-draft, unmerged PR before merge. Do not use final-audit language to approve
an open PR before merge.

Reviewer agents may use these paired-review decision phrases:

- `APPROVED FOR MERGE`
- `APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`
- `CHANGES REQUESTED`
- `HUMAN REVIEW REQUIRED`
- `BLOCKED`

Reviewer agents must not say or imply that they removed stop labels, authorized
themselves to remove stop labels, or treat stop labels as advisory only.

Reviewer agents must return `HUMAN REVIEW REQUIRED` when:

- the Reviewer authored the PR
- the Reviewer is from the same Codex session or run as the authoring agent
- the authoring run cannot be distinguished from the review run
- the PR was already merged before review
- the paired-review PR is Draft
- any stop label is present
- required metadata or checks are missing

Reviewer comments for acceptance or auto-merge shakedown review must state the
independence basis: authoring session or source if known, reviewer session or
source, whether they are independent, and whether independence is unknown.

Final-audit Reviewer issues are not PR acceptance reviews. They audit merged or
explicitly abandoned campaign PRs near the end, treat merged PRs as expected
inputs, do not approve merge retroactively, and use only these audit decisions:

- `AUDIT PASSED`
- `AUDIT PASSED WITH NOTES`
- `HUMAN FOLLOW-UP REQUIRED`
- `BLOCKING FINDING`

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

## Safe Low-Risk Auto-Merge Lane

Live auto-merge does not exist yet. If separately approved later, it may only
apply to low-risk categories such as:

- `type:docs` + `risk:low` + `validation:docs`
- `type:harness` + `risk:low` + `validation:harness`
- `type:test` + `risk:low` + `validation:test`

Even in these low-risk categories, stop labels remain hard vetoes.
Draft PRs remain hard vetoes for auto-merge approval and paired-review
approval. Normal non-auto-merge feature PRs may still use Draft when
appropriate, but low-risk auto-merge candidate PRs, burn-in PRs, and
paired-review producer PRs with passing validation must be ready for review
before the Coder or Test stops.

Human merge or human review remains required for:

- `type:ui`
- `type:gameplay`
- `type:progression`
- `type:movement`
- deployment changes
- dependency changes
- CI or workflow changes
- `risk:medium` or higher unless explicitly approved by a human
- anything touching `src/game.js`, `src/render.js`, `src/game/movement.js`, or broad architecture files

Campaigns involving PR acceptance / auto-merge policy, Reviewer App / identity
/ token workflow, GitHub permissions, secrets or credentials handling,
CI/workflows, deployment, dependencies, security-sensitive or trust-boundary
work, movement/collision, `risk:medium` or higher unless Architect justifies
`final-audit`, anything touching `src/game.js`, anything touching
`src/render.js`, anything touching `src/game/movement.js`, or broad
architecture changes require or strongly recommend `paired-review`.
Use `paired-review` for `risk:medium` or higher unless Architect justifies `final-audit`.
Final-audit acceptable examples include low-risk harness docs/checklist campaigns.

## Auto-Merge Shakedown Sequence

An auto-merge shakedown is valid only when the PR remains open and unmerged
until the full sequence completes:

1. Coder creates the PR.
2. Coder marks any auto-merge candidate or burn-in PR ready for review before stopping.
3. PR remains open, ready for review, and unmerged.
4. CI passes.
5. PR metadata check passes.
6. Independent Reviewer-agent approves.
7. Human operator manually applies `merge:auto-eligible`.
8. No stop labels are present.
9. GitHub auto-merge performs the merge.

Successful auto-merge proof requires one of:

- GitHub timeline evidence such as `AutoMergeEnabledEvent` or AutoMergeRequest
  evidence.
- GitHub CLI/API evidence showing `autoMergeRequest` was set before merge.

If that evidence is absent, release summaries and burn-in reports must classify
the result as: "Reviewer approval + human merge succeeded; auto-merge
completion inconclusive."

If a human merges before Reviewer approval or before applying
`merge:auto-eligible`, the result is valid as a normal human merge but invalid
or inconclusive as an auto-merge shakedown.

## Minimum Auto-Merge Gates

Any future auto-merge workflow or documented procedure must require all of these:

- PR targets `main`.
- PR is not draft; Draft PRs are hard vetoes for auto-merge approval.
- PR has a linked Linear issue.
- PR body uses `.github/PULL_REQUEST_TEMPLATE.md` exact headings and includes role, type, risk, validation profile, tests run, manual QA, broad scan reason, conflict risk, visible UI expectation, and known limitations.
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
- `needs-human-approval`, `blocked`, `human-only`, and `risk:human-only` are absent from the linked issue.
- `reviewer:changes-requested` is absent.
- Independent approval is present through `reviewer:approved` or an approved human label.
- The approval actor is not the Coder or Test author of the PR.
- The approval actor is not from the same Codex session or run as the authoring agent.
- Reviewer comments state the independence basis.
- New commits after approval require approval to be rechecked or refreshed.

## Independence Rule

Coder and Test agents must not approve, label as accepted, or merge their own PRs. Reviewer approval must come from a separate reviewer-agent pass or a human. A Reviewer agent must not approve a PR authored by the same Codex session or run, and must not approve its own prior work.

If actor independence cannot be proven mechanically, auto-merge must remain unavailable and the PR must use human-controlled merge. If independence is unknown, the Reviewer must return `HUMAN REVIEW REQUIRED`.

## Workflow Changes

Changes to GitHub Actions workflows, PR metadata checks, branch-protection-adjacent logic, deployment, dependencies, or this acceptance policy are not auto-merge eligible. They require normal human-controlled review and merge.

## Relationship To Existing Protocol

This policy adds stricter acceptance rules; it does not remove existing requirements from `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, `SAFETY_BOUNDARIES.md`, or the PR review checklist.

If any rule conflicts, use the stricter rule and require human review.
