# Model Routing Checklist

Use this checklist when assigning, grooming, dispatching, conducting, coding,
testing, reviewing, or releasing work with `model_hint`.

## Hint Values

- [ ] The issue or context pack uses one explicit value:
      `model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, or
      `model_hint: human-only`.
- [ ] The hint is compatible with role/type/risk/validation metadata.
- [ ] The hint is documented as advisory for routing and cost, not authority to
      skip safety gates.

## Safety Rules

- [ ] `model_hint` does not override risk gates.
- [ ] `model_hint` does not override validation profiles or validation
      commands.
- [ ] `model_hint` does not override PR metadata requirements.
- [ ] `model_hint` does not override safety docs, human gates, stop labels,
      reviewer independence, or changed-file scrutiny.
- [ ] `model_hint: human-only` stops automation unless a human creates a new
      explicit safe automation path.

## Low-Cost Lane

- [ ] `model_hint: cheap` or `model_hint: local-ok` is used only for bounded
      low-risk docs, static test, release-summary, or narrow harness work.
- [ ] The context pack is current.
- [ ] The file list is narrow.
- [ ] No movement, collision, gameplay, progression, rendering, deployment,
      dependency, CI workflow, repository setting, secrets, security, Reviewer
      App, PR acceptance, or auto-merge trust-boundary work is in scope.

## Stop Conditions

- [ ] Stop if the current model is below the required `model_hint` and no human
      approved downgrade is recorded.
- [ ] Stop if `model_hint` conflicts with role/type/risk/validation metadata.
- [ ] Stop if the hint would hide required safety context or weaken validation.
- [ ] Stop if the work should be `model_hint: human-only`.
