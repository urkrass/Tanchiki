# Level 6 Repo Orchestration Checklist

Use this checklist when changing the automation harness.

- [ ] Root docs exist: `ARCHITECTURE.md`, `TASK_PROTOCOL.md`, `VALIDATION_MATRIX.md`, `SAFETY_BOUNDARIES.md`.
- [ ] `AGENTS.md` is concise and points to the source-of-truth docs.
- [ ] README explains the Level 1-6 ladder and normal prompts.
- [ ] GitHub issue templates require role, type, risk, validation, scope, do-not-touch list, acceptance criteria, tests, manual QA, visible UI expectation, and conflict risk.
- [ ] PR template requires linked issue, role/type/risk/validation, summary, files changed, tests run, manual QA, conflict risk, visible UI expectation, and known limitations.
- [ ] CI runs `npm test`, `npm run build`, and `npm run lint`.
- [ ] PR metadata checking is implemented or documented as future work.
- [ ] Movement safety boundaries still protect `src/game/movement.js`.
- [ ] Validation matrix includes all Level 5 validation profiles.
- [ ] No gameplay behavior changed.
- [ ] `src/game/movement.js` was not modified.
- [ ] Validation ran: `npm test`, `npm run build`, `npm run lint`, `git diff --check`.
