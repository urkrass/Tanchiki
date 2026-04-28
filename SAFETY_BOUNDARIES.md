# Safety Boundaries

These rules define work that requires extra care or human approval.

## Protected Movement Core

`src/game/movement.js` is protected. It owns canonical grid movement and visual interpolation. Movement and collision changes are high risk because they affect player feel, tests, enemy interaction, and level validity.

Do not edit `src/game/movement.js` unless all are true:

- the Linear issue explicitly permits movement work
- the issue has `type:movement`
- the issue has `validation:movement`
- a human has approved automation, or the issue remains human-only

Movement issues should normally carry `risk:human-only`.

## Human Approval Required

Human approval is required for:

- movement, collision, interpolation, spawning, or control-feel rewrites
- save or persistence behavior
- destructive repository operations
- broad architecture rewrites
- broad AI rewrites or campaign-wide enemy behavior changes
- changes that intentionally alter progression balance or carried state

Use `needs-human-approval`, `human-only`, or `risk:human-only` when these gates apply.

## Repository Safety

- Do not push directly to `main`.
- Do not merge automatically.
- Do not bypass CI.
- Do not force push unless explicitly approved.
- Do not run destructive git commands without explicit approval.
- Do not use `git reset --hard` or destructive checkout commands to discard user work.
- Do not finish with a dirty working tree unless reporting a blocker.

PR acceptance and auto-merge preparation must follow
`ops/policies/pr-acceptance.md`. Coder and Test agents must not approve, label
as accepted, or merge their own PRs. `merge:do-not-merge` overrides every
positive acceptance label.

Stop labels are hard vetoes for auto-merge. Coder, Test, Reviewer, Release,
Planner, and Groomer agents may recommend stop-label removal in PR or Linear
comments, but must not remove stop labels from active PRs. A human operator must
remove stop labels manually unless a future gate-management automation is
explicitly approved.

Auto-merge must not be available for movement or collision work, `risk:high`,
`risk:human-only`, deployment, dependencies, CI workflow changes, broad gameplay
changes, save or persistence behavior, security-sensitive changes, or
public-demo-impacting changes without explicit human control.

## Gameplay Safety

- Do not implement gameplay from a harness/docs issue.
- Do not change game behavior from docs, harness, UI-copy, or test-only tasks.
- Do not change progression behavior unless the issue is typed and validated as progression work.
- Do not retune levels unless the issue explicitly scopes level design.
- Do not add dependencies unless the issue requires and justifies them.

## CI Safety

Every PR must pass the declared validation profile. Baseline CI is:

```powershell
npm test
npm run build
npm run lint
```

If CI fails, fix the PR branch or report the blocker. Do not recommend merge while CI is failing or unknown.
