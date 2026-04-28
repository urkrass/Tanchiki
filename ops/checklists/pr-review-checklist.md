# PR Review Checklist

Use this checklist for Level 4 Reviewer agent passes.

- Does the PR target `main`?
- Is the PR tied to one issue or explicit documentation task?
- Does the PR include role, type, risk, and validation profile?
- Is the scope limited to the stated goal?
- Are unrelated refactors or cleanup absent?
- Does the diff respect file ownership boundaries?
- Are gameplay behavior changes covered by focused tests?
- Are test-only PRs free of unintended gameplay changes?
- Are documentation-only PRs free of source changes?
- Were the commands required by the declared `validation:*` profile run?
- Were baseline `npm test`, `npm run build`, and `npm run lint` run when required?
- Is CI passing or explicitly still pending?
- Are parent or campaign issues left open unless all children are done and a release summary exists?
- Are risks, edge cases, and manual QA notes clear?
- Are conflict risk, visible UI expectation, and known limitations clear?
