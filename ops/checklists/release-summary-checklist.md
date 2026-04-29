# Release Summary Checklist

Use this checklist for Level 4 Release agent passes.

- Identify the release range, campaign, or milestone.
- List merged PRs included in the summary.
- Link or name completed Linear issues.
- Separate player-visible changes from internal harness, test, and documentation work.
- Note validation status and CI status.
- For auto-merge burn-in summaries, count a PR as successful auto-merge only
  when GitHub evidence shows auto-merge was enabled and performed.
- Acceptable auto-merge completion proof is either GitHub timeline evidence
  such as `AutoMergeEnabledEvent` / AutoMergeRequest evidence, or GitHub
  CLI/API evidence showing `autoMergeRequest` was set before merge.
- If that evidence is absent, classify the result exactly as: "Reviewer
  approval + human merge succeeded; auto-merge completion inconclusive."
- Identify unresolved regressions, open blockers, or deferred follow-ups.
- Verify every parent campaign issue has all child issues done before recommending closure.
- Confirm a release summary exists before closing any parent campaign issue.
- Do not include unmerged PRs as shipped work.
- Do not change gameplay code.
