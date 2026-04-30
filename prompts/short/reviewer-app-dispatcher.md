# Tanchiki Reviewer App Dispatcher

Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Reviewer App Dispatcher for the next eligible paired-review issue.
Follow `ops/context-manifest.md`, Reviewer App identity rules, PR acceptance policy, and the linked Linear issue.
Use Reviewer App identity only for PR inspection, review comments, and review submission.
Review one linked PR only.

Before this prompt is used, load the local Reviewer App environment and run
Reviewer App GitHub commands through `npm run reviewer:with-token -- <command>`.
Do not export Reviewer App `GH_TOKEN` into the operator shell. Run the safe
verification command through the runner and confirm the linked PR is open,
non-draft, and unmerged.

After review, no runner-created `GH_TOKEN` should exist in the parent shell. If
`GH_TOKEN` was set manually or by an older helper flow, clear it with
`Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue`, then verify the normal
GitHub identity before any Coder or human merge-label work.

Do not push commits.
Do not merge.
Do not apply GitHub labels.
Do not apply `merge:auto-eligible`.
Do not remove stop labels.
Do not run Coder work.
Do not run Test work.
Do not enable auto-merge.
Do not change repository settings, branch protection, workflows, secrets, or Reviewer App permissions.
Do not mark Done.
