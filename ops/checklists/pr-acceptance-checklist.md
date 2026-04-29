# PR Acceptance Checklist

Use this checklist before adding an acceptance label, recommending merge, or allowing any PR into a future auto-merge path.

## Basic PR Gate

- [ ] PR targets `main`.
- [ ] PR is not draft before any auto-merge path is considered.
- [ ] Draft PRs are hard vetoes for auto-merge approval.
- [ ] Auto-merge candidate PRs and auto-merge burn-in PRs were marked ready for review before the Coder session stopped.
- [ ] Normal non-auto-merge feature PRs may still use Draft when appropriate.
- [ ] PR links exactly one Linear issue or explicit documentation task.
- [ ] PR includes role, type, risk, and validation profile.
- [ ] PR lists files changed, tests run, manual QA, conflict risk, visible UI expectation, and known limitations.
- [ ] PR metadata check is passing.
- [ ] CI is passing.
- [ ] Branch protection requirements are satisfied and not bypassed.

## Linear Gate

- [ ] Linked issue has exactly one `role:*` label.
- [ ] Linked issue has exactly one `type:*` label.
- [ ] Linked issue has exactly one `risk:*` label.
- [ ] Linked issue has exactly one `validation:*` label.
- [ ] Linked issue is not blocked.
- [ ] Linked issue does not have `needs-human-approval`.
- [ ] Linked issue does not have `human-only`.
- [ ] Linked issue does not have `risk:human-only`.
- [ ] Linked issue classification matches the PR body.

## Scope Gate

- [ ] Changed files match the declared role, type, risk, and validation profile.
- [ ] No unrelated cleanup or refactor is included.
- [ ] Docs and harness PRs do not change gameplay behavior.
- [ ] Test-only PRs do not change gameplay behavior unless explicitly justified.
- [ ] Protected movement files are not touched unless explicitly authorized by a human-gated movement issue.

## Auto-Merge Exclusion Gate

Auto-merge is unavailable if any item below is true:

- [ ] Movement, collision, spawning, interpolation, or control feel changed.
- [ ] PR has `type:movement` or `validation:movement`.
- [ ] PR has `risk:high`.
- [ ] PR has `risk:human-only`.
- [ ] PR changes deployment workflows or GitHub Pages behavior.
- [ ] PR changes dependencies, package manager behavior, or lockfiles.
- [ ] PR changes CI workflows, PR metadata checks, branch-protection-adjacent logic, or auto-merge logic.
- [ ] PR changes broad gameplay behavior.
- [ ] PR changes medium or high-risk gameplay, rendering, progression, or public-demo-impacting behavior without human authority.
- [ ] PR changes save or persistence behavior.
- [ ] PR touches security-sensitive behavior, secrets, credentials, permissions, tokens, or repository settings.
- [ ] PR has ambiguous metadata, missing validation evidence, failing CI, pending CI, or stale approval after new commits.

If any exclusion is true, use `merge:human-required` or `merge:do-not-merge`.

## Label Gate

- [ ] Required GitHub labels exist before they are used.
- [ ] Label ownership follows `ops/policies/pr-acceptance.md`.
- [ ] Positive acceptance labels were not added by the PR author.
- [ ] No stop labels are present: `merge:do-not-merge`, `merge:human-required`, `needs-human-approval`, `blocked`, `human-only`, or `risk:human-only`.
- [ ] Stop labels were not removed by a Coder, Test, Reviewer, Release, Planner, or Groomer agent.
- [ ] If a stop label was previously present, the PR body records which human operator approved gate removal.
- [ ] `merge:do-not-merge` is absent.
- [ ] `reviewer:changes-requested` is absent.
- [ ] `merge:human-required` is absent before auto-merge eligibility.
- [ ] `merge:auto-eligible` is present before auto-merge eligibility.
- [ ] `reviewer:approved` or an approved human approval label is present.
- [ ] Any `merge:agent-approved` label came from an independent reviewer-agent pass.
- [ ] `merge:do-not-merge` overrides every positive label.
- [ ] Positive labels were removed or refreshed after the latest commit.
- [ ] Any missing label setup is documented as a manual/admin step, not hidden in implementation work.

## Independence Gate

- [ ] The approval actor is not the Coder or Test author of the PR.
- [ ] The Reviewer agent is not from the same Codex session or run as the PR authoring agent.
- [ ] The Reviewer agent did not author the PR or review its own prior work.
- [ ] The Reviewer comment states the independence basis: authoring session/source if known, reviewer session/source, whether they are independent, and whether independence is unknown.
- [ ] Coder/Test agents did not approve or label their own PR as accepted.
- [ ] Agents only recommended stop-label removal in PR or Linear comments; they did not remove stop labels.
- [ ] Reviewer did not push commits to the PR branch.
- [ ] Any new commit after approval rechecks or refreshes approval.
- [ ] If actor independence cannot be proven, auto-merge remains unavailable.
- [ ] If authoring and review runs cannot be distinguished, Reviewer returns `HUMAN REVIEW REQUIRED`.

## Auto-Merge Shakedown Evidence

For auto-merge shakedowns, reviewer comments must record:

- [ ] PR number.
- [ ] Linked Linear issue.
- [ ] PR state at review time: open, draft, merged, or closed.
- [ ] Whether an auto-merge candidate or burn-in PR is ready for review.
- [ ] Whether CI passed.
- [ ] Whether PR metadata check passed.
- [ ] Whether stop labels are absent.
- [ ] Whether the Reviewer is independent from the PR authoring session.
- [ ] Whether `merge:auto-eligible` was applied by a human.
- [ ] Whether GitHub auto-merge, not manual merge, performed the merge.
- [ ] Successful auto-merge proof includes GitHub timeline evidence such as
      `AutoMergeEnabledEvent` / AutoMergeRequest evidence, or GitHub CLI/API
      evidence showing `autoMergeRequest` was set before merge.
- [ ] If that proof is absent, classify the result exactly as: "Reviewer
      approval + human merge succeeded; auto-merge completion inconclusive."
- [ ] Final decision using one of the approved Reviewer outcomes.

An auto-merge shakedown is valid only if the PR remains open until Coder PR,
CI, PR metadata check, independent Reviewer approval, human-applied
`merge:auto-eligible`, no stop labels, and GitHub auto-merge all complete. If
a human merges before Reviewer approval or before applying
`merge:auto-eligible`, the PR may be a valid normal human merge, but the
auto-merge shakedown is invalid or inconclusive.

A burn-in summary must not count a PR as successful auto-merge solely because a
human merged it after Reviewer approval. Without explicit auto-merge event or
request evidence, use: "Reviewer approval + human merge succeeded; auto-merge
completion inconclusive."

## Validation Evidence Gate

- [ ] The PR still satisfies role/type/risk/validation metadata after all changes.
- [ ] CI passed after the latest commit.
- [ ] PR metadata checks passed after the latest commit.
- [ ] QA evidence is present when the validation profile or risk level requires it.
- [ ] Harness or checklist wording changes were read as clarifications only, not policy or authority expansions.

## Final Decision

- [ ] Recommendation only: post findings, no approval or merge authority.
- [ ] Reviewer-agent accepted: independent review passed, but merge remains controlled by policy.
- [ ] Human required: human must decide before merge.
- [ ] Auto-merge eligible: all gates passed, no stop label is present, any previous stop-label removal was approved by a human operator, and the repository policy/workflow explicitly allows it.
- [ ] Do not merge: blocking issue exists.
