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

## Dry-Run Router

- [ ] Router output is advisory text only and does not execute Dispatcher,
      Campaign Conductor, agents, model runners, PR operations, label changes,
      merges, file edits, or issue closure.
- [ ] Output includes `RUN` or `DO NOT RUN`, next issue, active Linear project,
      role/type/risk/validation, review cadence, `model_hint`, recommended
      model class, required identity, recommended prompt, required context pack,
      validation profile, stop conditions, and next human action.
- [ ] Router refuses ambiguous, incomplete, duplicated, stale, or contradictory
      metadata.
- [ ] Router refuses missing active project, missing review cadence, missing
      context pack or copied metadata, unresolved blockers, human gates,
      `human-only`, `risk:human-only`, stop labels, and PR readiness gaps.
- [ ] Reviewer issues that inspect PRs require Reviewer App identity.
- [ ] Human gates and human-only lanes require human-only identity.
- [ ] Frontier is recommended for trust-boundary, model-routing, PR acceptance,
      Reviewer App identity, safety policy, CI/workflow, deployment,
      dependency, security, protected-file, medium-risk, high-risk, ambiguous,
      or broad policy work.
- [ ] Cheap or local recommendations are limited to bounded low-risk docs,
      static test, release-summary, or narrow harness work with current context
      and unchanged validation.
- [ ] `model_hint` never overrides Level 5 labels, risk gates, validation,
      safety docs, PR metadata, review cadence, reviewer independence, human
      gates, stop labels, or changed-file scrutiny.
