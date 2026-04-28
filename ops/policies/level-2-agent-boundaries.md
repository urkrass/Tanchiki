# Level 2 Agent Boundaries

Level 2 is the autonomous implementation workflow. It may implement one Linear issue per branch and PR after the issue is explicitly eligible.

## Eligibility

Codex may select only issues that are all of the following:

- status `Todo`
- labeled `automation-ready`
- labeled with exactly one `role:*`
- labeled with exactly one `type:*`
- labeled with exactly one `risk:*`
- labeled with exactly one `validation:*`
- not labeled `blocked`
- not labeled `needs-human-approval`
- not labeled `human-only`
- not labeled `risk:human-only`
- not safety-critical
- not blocked by another issue
- not a parent, epic, or campaign umbrella issue

Issues gated by `needs-human-approval` are not eligible until a human removes the gate and applies `automation-ready`.

Use `ops/policies/risk-gated-validation.md` for Level 5 issue type, risk, and validation profile rules.

## Sequential Campaign Execution

For dependency chains, only one implementation issue may be `Todo` + `automation-ready` at a time.

Parent or epic issues must not have `automation-ready`. They are containers for planning and tracking, not Level 2 implementation targets.

If multiple issues in a chain are marked `Todo` + `automation-ready`, Codex must stop and report the harness violation instead of choosing one silently.

## Stale-Main Prevention

Before creating a task branch, Codex must run:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

The task branch must be created from updated `main`. Every PR must target `main` unless a human explicitly instructs otherwise.

## Conflict-Risk Detection

Before implementation, inspect recent merged PRs or git history when available. If the issue touches files modified by the previous one to three merged PRs, report conflict risk before editing.

If several consecutive issues touch central integration files such as `src/game.js` or `test/game.test.js`, recommend a seam-extraction issue before continuing feature work.

## Central-File Churn

Treat `src/game.js` and `test/game.test.js` as integration points, not dumping grounds. Significant feature logic should move into focused modules and focused test files where practical.

Prefer seams such as:

- progression-specific helpers
- campaign progression helpers
- player stats helpers
- reward helpers
- focused test files

Do not rewrite `src/game/movement.js` unless the issue explicitly requires it or a failing test proves it is necessary.

## Visibility Expectations

If an issue is internal-only, Codex must say that no visible UI change is expected. Examples include state objects, XP reward calculations, catalogs, and harness rules.

If the user expects visible UI, Codex must point to the later UI issue instead of implying the internal issue will change the screen.

## PR Conflict Policy

If a PR has conflicts with `main`:

- resolve conflicts on the PR branch, never on `main`
- merge or rebase latest `main` into the PR branch
- preserve both `main` behavior and PR behavior
- run `npm test`, `npm run build`, and `npm run lint`
- push the PR branch
- do not merge automatically

## Dev Server Port

If port `5173` is already occupied, do not treat that as app failure. Check whether the existing server is usable at `http://localhost:5173`, or give a clear command to stop the process before retrying.
