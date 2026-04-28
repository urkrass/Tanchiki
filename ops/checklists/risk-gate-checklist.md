# Risk Gate Checklist

Use this checklist before the dispatcher routes an issue and before a role opens a PR.

## Dispatcher Gate

- [ ] Issue status is `Todo`.
- [ ] Issue has `automation-ready`.
- [ ] Issue has exactly one `role:*` label.
- [ ] Issue has exactly one `type:*` label.
- [ ] Issue has exactly one `risk:*` label.
- [ ] Issue has exactly one `validation:*` label.
- [ ] Issue does not have `blocked`.
- [ ] Issue does not have `needs-human-approval`.
- [ ] Issue does not have `human-only`.
- [ ] Issue does not have `risk:human-only`.
- [ ] Issue is not blocked by another issue.
- [ ] Issue is not canceled or `Done`.
- [ ] Issue is not a parent, epic, campaign umbrella, or safety-critical item.
- [ ] If metadata is missing or duplicated, stop and comment on the Linear issue asking for triage.
- [ ] If `automation-ready` appears with `blocked`, `needs-human-approval`, or `human-only`, stop and comment.

## Validation Profile Gate

- [ ] `validation:docs`: ran `npm test`, `npm run build`, `npm run lint`, and `git diff --check`; no gameplay source changed.
- [ ] `validation:harness`: ran `npm test`, `npm run build`, `npm run lint`, and `git diff --check`; no gameplay source changed.
- [ ] `validation:ui`: ran required commands, completed browser or manual QA, and checked narrow viewport when layout changed.
- [ ] `validation:test`: ran targeted tests if relevant plus full validation; no gameplay behavior changed unless explicitly justified.
- [ ] `validation:gameplay`: added focused behavior tests and documented gameplay QA; did not touch `src/game/movement.js` unless explicitly allowed.
- [ ] `validation:progression`: added focused progression or campaign tests and checked victory -> reward/upgrade -> next level flow.
- [ ] `validation:movement`: ran full movement regressions, documented movement QA, and confirmed human approval.

## PR Metadata

- [ ] PR links the Linear issue.
- [ ] PR states role, type, risk, and validation profile.
- [ ] PR summarizes changed files and systems.
- [ ] PR lists tests run.
- [ ] PR includes manual QA or says why it is not applicable.
- [ ] PR states conflict risk.
- [ ] PR states visible UI expectation.
- [ ] PR lists known limitations.
