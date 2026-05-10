# Harness Operator v1 Prompt

Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Active GitHub repo:
urkrass/Tanchiki

Run Harness Operator v1 for the next safe campaign issue.

## Goal

Reduce manual operator juggling by making one routing decision in this session:

1. Inspect Linear and repo state.
2. Run read-only or dry-run safety checks when auth allows.
3. Emit exactly one ready-to-paste Codex role prompt for exactly one safe next issue.
4. Stop.

Harness Operator v1 is router-only. It does not implement, review, test, release,
merge, mutate labels, mark issues Done, launch subprocesses, spawn subagents, or
supervise background role sessions.

## Required Reading

Start from:

- `AGENTS.md`
- `ops/context-manifest.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`
- `ops/policies/campaign-conductor.md`
- `ops/checklists/harness-operator-v1-checklist.md`
- `ops/checklists/campaign-conductor-checklist.md`
- the selected campaign or issue state in Linear
- linked GitHub PRs when PR readiness affects the next role

Load only additional role-specific files required by the selected next issue.

## Allowed Inspection

The operator may use Linear and GitHub reads plus local inspection commands such
as:

```powershell
git status --short
npm run conductor:step -- --report-candidates --active-project "<Tanchiki project name>"
npm run campaign:run -- --dry-run --active-project "<Tanchiki project name>" --repo urkrass/Tanchiki
```

Use `conductor:step -- --report-candidates` as the read-only candidate
inventory check.

Use `campaign:run -- --dry-run` as the campaign state-machine check. The
operator may use its next-prompt output only when it agrees with direct Linear
inspection and the candidate report.

If script auth is required, it must come from the current process environment
only. Do not print, write, commit, or ask to store tokens, private keys, or env
files.

## Safe Candidate Rule

Generate a role prompt only when all of these are true:

- active Linear project is declared and unambiguous;
- issue is in the active project;
- exactly one safe next issue exists in scope;
- the issue has exactly one `role:*`, one `type:*`, one `risk:*`, and one
  `validation:*` label;
- no `blocked`, `needs-human-approval`, `human-only`, `risk:human-only`, PR stop
  label, or unresolved blocked-by relation is present;
- the issue is not a parent, campaign umbrella, or safety-critical placeholder;
- review cadence is exactly one of `review_cadence: paired-review` or
  `review_cadence: final-audit`, or the only safe output is an Architect prompt
  that resolves `review_cadence: let-architect-decide`;
- paired-review Reviewer issues have a linked open, non-draft, unmerged PR with
  required checks and metadata passing when policy requires them.

If the safe candidate rule is not satisfied, stop and report the exact blocker.
Do not guess, repair, promote, or continue into role work.

## Stop Conditions

Stop without generating a role prompt when any of these are present:

- missing or ambiguous active project;
- missing auth needed for required live reads, when no safe fixture or JSON path
  is available;
- zero safe candidates;
- multiple possible candidates;
- missing or duplicated `role:*`, `type:*`, `risk:*`, or `validation:*` labels;
- missing or ambiguous review cadence;
- unresolved blocked-by relation;
- any stop label or human gate;
- PR readiness blocker, including Draft, merged, closed, failing, pending, or
  missing required-check state;
- Reviewer independence uncertainty;
- missing paired Reviewer issue in `paired-review` cadence;
- request to run live `campaign:run`, launch Codex, spawn subagents, supervise
  background sessions, merge, apply labels, remove labels, mark Done, change
  workflows, change dependencies, change repo settings, handle secrets outside
  env-only reads, change gameplay, or touch `src/game/movement.js`.

## Generated Role Prompt Requirements

The generated prompt must be for a fresh Codex session. The current operator
session must not become the role session.

Every generated role prompt must include:

- active Linear project;
- active GitHub repo;
- selected issue ID and title;
- selected role;
- type, risk, and validation labels;
- campaign review cadence;
- required context files;
- issue-specific scope and forbidden scopes;
- validation profile;
- visible UI expectation;
- PR posture expectations when the role can open a PR;
- `Do not merge`;
- `Do not mark Done` unless the task protocol explicitly allows it.

Fresh sessions are required for every role prompt, every role change, after a
Coder or Test PR is opened, after a Reviewer decision, after a human gate or
merge outcome, when model requirements change, and whenever prior context could
compromise Reviewer independence.

## Output

Return either one ready-to-paste role prompt or one blocker report.

Include:

- active Linear project and repo;
- campaign or issue scope used;
- candidate count and selected issue, if any;
- selected role/type/risk/validation, if any;
- conductor candidate-report result;
- campaign dry-run result;
- linked PR/check readiness when relevant;
- repo cleanliness;
- whether a fresh role session is required;
- a statement that no files, PRs, labels, merges, role work, or Done transitions
  were changed by the operator.

Stop after this output.

## Boundaries

- Do not implement code.
- Do not edit repo files.
- Do not create branches or PRs.
- Do not run Dispatcher.
- Do not run role work.
- Do not submit Reviewer Agent reviews.
- Do not merge.
- Do not mutate GitHub labels.
- Do not remove stop labels.
- Do not run live `campaign:run`.
- Do not mark issues Done.
- Do not change workflows, dependencies, repo settings, branch protection,
  deployment, Reviewer App permissions, secrets, env files, gameplay files, or
  `src/game/movement.js`.
