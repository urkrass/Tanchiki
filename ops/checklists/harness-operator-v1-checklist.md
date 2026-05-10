# Harness Operator v1 Checklist

Use this checklist for one Harness Operator v1 routing pass.

Harness Operator v1 is router-only:

```text
inspect Linear/repo state -> run read-only/dry-run safety checks -> emit one ready-to-paste role prompt -> stop
```

## Setup

- [ ] Confirm the prompt declares `Active Linear project: <Tanchiki project name>`.
- [ ] Confirm the prompt declares `Active GitHub repo: urkrass/Tanchiki`.
- [ ] Load `AGENTS.md`, `ops/context-manifest.md`, `TASK_PROTOCOL.md`,
      `VALIDATION_MATRIX.md`, and `SAFETY_BOUNDARIES.md`.
- [ ] Load `ops/policies/campaign-conductor.md` and
      `ops/checklists/campaign-conductor-checklist.md`.
- [ ] Load the selected campaign or issue state from Linear.
- [ ] Load linked GitHub PR state when PR readiness affects routing.
- [ ] Check repo cleanliness with `git status --short`.
- [ ] Do not edit files, create branches, open PRs, run role work, merge,
      mutate labels, remove labels, or mark issues Done.

## Safety Oracle Checks

- [ ] Run or inspect `npm run conductor:step -- --report-candidates
      --active-project "<Tanchiki project name>"` when auth allows.
- [ ] Treat `conductor:step -- --report-candidates` as read-only candidate
      inventory, not promotion authority.
- [ ] Run or inspect `npm run campaign:run -- --dry-run --active-project
      "<Tanchiki project name>" --repo urkrass/Tanchiki` when auth allows.
- [ ] Treat `campaign:run -- --dry-run` as a state-machine oracle, not live
      execution authority.
- [ ] Do not run live `campaign:run`.
- [ ] If script auth is missing, confirm whether a safe fixture or JSON path is
      available.
- [ ] If required auth is missing and no safe fixture or JSON path exists, stop
      and report the missing auth as the blocker.
- [ ] Confirm no secrets, tokens, private keys, or env files are printed,
      committed, or written to the repo.

## Candidate Gate

- [ ] Confirm the active Linear project is present and unambiguous.
- [ ] Confirm the candidate is in the active project.
- [ ] Confirm exactly one safe next candidate exists in scope.
- [ ] Stop if zero candidates are safe.
- [ ] Stop if multiple candidates could be next.
- [ ] Confirm the selected issue has exactly one `role:*` label.
- [ ] Confirm the selected issue has exactly one `type:*` label.
- [ ] Confirm the selected issue has exactly one `risk:*` label.
- [ ] Confirm the selected issue has exactly one `validation:*` label.
- [ ] Confirm no `blocked`, `needs-human-approval`, `human-only`, or
      `risk:human-only` label is present.
- [ ] Confirm no PR stop label blocks the next role.
- [ ] Confirm no unresolved blocked-by relation remains.
- [ ] Confirm the issue is not a parent, campaign umbrella, or safety-critical
      placeholder.
- [ ] Confirm review cadence is explicit and compatible with the selected role.
- [ ] Stop if cadence is missing or ambiguous.
- [ ] If cadence is `let-architect-decide`, generate only an Architect prompt
      that resolves cadence.
- [ ] For paired-review Reviewer routing, confirm the linked PR is open,
      non-draft, unmerged, and has required checks and metadata passing when
      policy requires them.
- [ ] Stop on Draft, merged, closed, failing, pending, or missing PR readiness.
- [ ] Stop when Reviewer independence is unknown or could be compromised.
- [ ] Stop when a paired Reviewer issue is missing for a PR-producing issue in
      `paired-review` cadence.

## Hard Human Gates

- [ ] Stop on `needs-human-approval`, `human-only`, or `risk:human-only`.
- [ ] Stop on protected movement, collision, persistence, security, deployment,
      dependency, workflow, branch-protection, repo-setting, or Reviewer App
      permission scope.
- [ ] Stop on any request to remove a stop label.
- [ ] Stop on any request to apply `merge:auto-eligible`.
- [ ] Stop on any merge request.
- [ ] Stop on missing secrets/auth that would require unsafe handling.
- [ ] Stop on any request to broaden GitHub or Linear mutation authority.
- [ ] Stop on gameplay changes or any touch to `src/game/movement.js`.

## Generated Prompt Gate

- [ ] Generate exactly one role prompt.
- [ ] Require the generated role to run in a fresh Codex session.
- [ ] Include active Linear project and repo.
- [ ] Include selected issue ID and title.
- [ ] Include role, type, risk, and validation labels.
- [ ] Include review cadence.
- [ ] Include required context files.
- [ ] Include issue scope and forbidden scopes.
- [ ] Include validation profile.
- [ ] Include visible UI expectation.
- [ ] Include PR posture expectations when the role can open a PR.
- [ ] Include `Do not merge`.
- [ ] Include `Do not mark Done` unless the task protocol explicitly allows it.
- [ ] Do not transform the operator session into Coder, Test, Reviewer, or
      Release.

## Output Gate

- [ ] Report the active Linear project and repo.
- [ ] Report the campaign or issue scope used.
- [ ] Report candidate counts and selected issue, if any.
- [ ] Report selected role/type/risk/validation, if any.
- [ ] Report conductor candidate-report result.
- [ ] Report campaign dry-run result.
- [ ] Report linked PR/check readiness when relevant.
- [ ] Report repo cleanliness.
- [ ] Report that a fresh role session is required.
- [ ] Return one ready-to-paste role prompt or the exact blocker.
- [ ] State that no files, PRs, labels, merges, role work, or Done transitions
      were changed by the operator.
- [ ] Stop after the output.
