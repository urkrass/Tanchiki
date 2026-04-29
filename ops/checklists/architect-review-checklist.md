# Architect Review Checklist

Use this checklist before a Coder agent starts implementation.

- Is the goal small enough for one PR?
- Is the primary gameplay object or system clear?
- Are likely files identified?
- Are ownership boundaries respected?
- Does the issue avoid broad refactors?
- Does the issue avoid `src/game.js` and `test/game.test.js` churn where a focused seam would work?
- Has recent merged PR history been checked for conflict risk?
- Are dependencies and blockers explicit?
- Is only one issue in the dependency chain eligible for `Todo` + `automation-ready`?
- If campaign cadence is `review_cadence: let-architect-decide`, did Architect choose exactly one of `review_cadence: final-audit` or `review_cadence: paired-review`?
- If Architect chose `review_cadence: paired-review`, are all PR-producing Coder/Test issues mapped to paired Reviewer issue titles, role/type/risk/validation, Reviewer App identity requirements, dependency order, and existing-or-create status?
- Are acceptance criteria testable?
- Are required tests named?
- Is visible UI impact stated?
- Are `needs-human-approval` decisions separated from implementation work?
- Are do-not-touch areas clear?
