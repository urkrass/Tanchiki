# Context Pack Checklist

Use this checklist when creating, grooming, implementing, reviewing, or
releasing a campaign that uses context packs.

## Campaign Pack

- [ ] Campaign goal and non-goals are stated.
- [ ] Review cadence and reason are stated.
- [ ] Queue order, blocked-by dependencies, human gates, paired-review points,
      and release condition are listed.
- [ ] Required Level 5 metadata is listed.
- [ ] Required safety context names the authoritative docs agents must still
      read when relevant.
- [ ] Relevant files, forbidden files, protected files, central-file conflict
      risk, and visible UI expectation are listed.
- [ ] Validation profiles, required commands, manual QA, and PR metadata
      expectations are listed.
- [ ] Known decisions, open questions, and follow-up work are captured.
- [ ] `model_hint` is present, explicitly advisory, and uses one of
      `model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, or
      `model_hint: human-only`.
- [ ] Context refresh triggers are listed.
- [ ] Stop-and-ask conditions are listed.

## Issue Pack

- [ ] Issue goal and role authority are clear.
- [ ] Current state and upstream decisions are summarized.
- [ ] Direct blockers, paired-review requirements, and linked PR expectations
      are stated.
- [ ] Likely files and do-not-touch files are listed.
- [ ] Required safety docs for the issue risk/type are listed.
- [ ] Validation profile, commands, manual QA, and PR metadata are listed.
- [ ] Review cadence and PR posture are stated for PR-producing issues.
- [ ] Central-file conflict risk is stated.
- [ ] Visible UI expectation is stated.
- [ ] `model_hint` is advisory, uses an allowed value, and includes escalation
      conditions.

## Safety Gate

- [ ] Token saving is not used to skip `TASK_PROTOCOL.md`.
- [ ] Token saving is not used to skip `VALIDATION_MATRIX.md`.
- [ ] Token saving is not used to skip `SAFETY_BOUNDARIES.md`.
- [ ] Token saving is not used to skip required architecture, PR acceptance, or
      conductor policy checks when relevant.
- [ ] Validation commands are unchanged by model hints.
- [ ] PR metadata requirements are unchanged by model hints.
- [ ] Human gates and stop labels remain hard blockers.
- [ ] Review cadence remains authoritative.
- [ ] Reviewer changed-file scrutiny remains mandatory.

## Broad Scan Gate

- [ ] Broad repo scans are avoided when the context pack and file list are
      sufficient.
- [ ] Broad repo scans are used when safety, ambiguity, validation failure,
      unexpected diff scope, or stale context requires them.
- [ ] The reason for any broad repo scan is recorded in Linear, the PR body,
      the review note, or the final summary.

## Model Hint Gate

- [ ] `model_hint` does not override role/type/risk/validation labels.
- [ ] `model_hint` does not override safety docs, validation, PR metadata,
      human approval, PR readiness, or reviewer independence.
- [ ] Frontier model use is required or strongly preferred for trust-boundary,
      medium-risk, high-risk, PR acceptance, security, CI/workflow, deployment,
      dependency, Reviewer App identity, movement, protected-file, or ambiguous
      work.
- [ ] Cheaper/local model candidates are limited to approved low-risk routine
      docs, static test, or narrow harness wording lanes.
- [ ] Agents stop when the current model is below the required `model_hint`
      unless a human-approved downgrade is recorded.
- [ ] `model_hint: human-only` stops automation.

## Review Gate

- [ ] Coder starts from issue context pack, listed files, required safety docs,
      and direct dependencies.
- [ ] Reviewer starts from PR diff, linked issue, context pack, validation
      evidence, and PR metadata.
- [ ] Release starts from merged PR summaries, Linear comments, campaign
      context pack, and recorded review outcomes.
- [ ] Conductor still verifies campaign order, blockers, cadence, issue labels,
      state, stop labels, and PR readiness.
- [ ] Dispatcher still enforces the normal eligibility gate before routing.
