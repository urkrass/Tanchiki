# Repository Guidelines

## Current State

This repository is a Codex handoff pack for a future top-down tank RPG. It contains a small dependency-free browser prototype with grid movement, shooting, damageable dummy targets, enemy sentry fire, player HP, win/loss states, a canvas renderer, and a test maze.

Do not implement additional gameplay until the handoff files have been read and the next patch has been explicitly scoped.

## Repo Layout

- `README.md` explains the handoff pack and warns that the included sprite sheet is reference-only.
- `CODEX_HANDOFF.md` contains the gameplay brief, constraints, bug priorities, and recommended implementation sequence.
- `docs/ASSET_PIPELINE.md` defines the intended sprite-sheet and JSON manifest workflow.
- `prompts/` stores reusable Codex startup and implementation prompts.
- `assets/style_reference_sprite_sheet.png` is art direction only, not a production sprite atlas.
- `assets/sprite_manifest.template.json` is the target manifest shape for future production sprites.
- `index.html` is the browser entry point.
- `src/main.js` owns the requestAnimationFrame loop and fixed-step update driver.
- `src/game.js` wires the level, player state, and movement rules.
- `src/render.js` owns Canvas drawing.
- `src/input.js` owns keyboard input and browser scroll prevention.
- `src/game/level.js` owns the current test level and blocked-cell checks.
- `src/game/movement.js` owns canonical grid movement state and visual interpolation.
- `src/game/projectiles.js` owns shell spawning, cooldown, travel, range, and wall collisions.
- `src/game/sentries.js` owns stationary enemy line-of-sight firing rules.
- `src/game/spawnValidation.js` owns mission-start safety validation.
- `src/game/targets.js` owns stationary target state and damage rules.
- `test/movement.test.js` verifies movement invariants.
- `test/projectiles.test.js` verifies projectile and shooting invariants.
- `test/sentries.test.js` verifies sentry line-of-sight and firing behavior.
- `test/spawnValidation.test.js` verifies safe mission-start constraints.
- `test/targets.test.js` verifies dummy target hit and damage behavior.
- `AGENTS.md` records repository working rules for future agents.

When game source is added, prefer clear target paths such as:

```text
src/game/collision.*
src/game/ai.*
src/game/spawns.*
src/assets/sprites/manifest.json
```

## Gameplay Responsibility Map

Most source files do not exist yet. Current and future ownership:

- Game loop: `src/main.js`.
- Player input: `src/input.js`.
- Grid movement: `src/game/movement.js`.
- Collision: simple blocked-cell checks in `src/game/level.js`; no entity collision module yet.
- Shooting/projectiles: `src/game/projectiles.js`.
- Enemy sentry threats: `src/game/sentries.js`.
- Damageable targets: `src/game/targets.js`.
- AI tanks: not implemented yet.
- Level progression: not implemented yet.
- Asset loading: not implemented yet; follow `docs/ASSET_PIPELINE.md` and `assets/sprite_manifest.template.json`.

## Commands

There is currently no install command. Node.js 20+ is required for the static dev server and built-in test runner.

```powershell
npm run dev
npm test
npm run build
npm run lint
npm run codex:next
```

`npm run dev` serves the prototype at `http://localhost:5173`. `build` and `lint` currently run syntax checks only.

If port `5173` is already occupied, do not treat that alone as app failure. Check whether the existing server at `http://localhost:5173` is usable, or give a clear command to stop the stale process before retrying.

Useful repository inspection commands:

```powershell
git status
Get-ChildItem -Recurse -File
git log -5 --pretty=format:"%s"
```

Prefer `rg --files` and `rg` for search when available. If `rg` is unavailable or blocked, use PowerShell traversal.

## Build, Test, And Lint

- Install: none needed yet.
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`

When tooling is introduced, keep it minimal and update both `README.md` and this file in the same patch.

`npm run codex:next` prints the default Level 4 Dispatcher prompt. Use it as the standard next-work entrypoint when the user does not name a specific role.

## Coding Conventions

For Markdown, use short headings, direct language, and fenced code blocks for examples. Keep documentation easy to scan.

For future JavaScript or TypeScript game code:

- Use small modules with clear ownership, such as `movement`, `projectiles`, `levels`, `spawns`, and `assets`.
- Use camelCase for variables and functions.
- Use PascalCase for classes or components.
- Use kebab-case or snake_case only when matching asset filenames or manifest keys.
- Keep gameplay state explicit and serializable where practical.
- Prefer deterministic update functions that accept delta time over hidden timers.

## Gameplay Constraints

- Movement must be grid-based but animated smoothly.
- Tank speed must remain constant.
- Tap-rushing must not increase movement speed.
- Turning must not cause sideways drift.
- Shooting must not freeze movement or turning.
- Projectiles should be spawned cheaply and updated in the normal game loop.
- Player and AI tanks must never spawn inside props, walls, bases, water, or occupied cells.
- Collision checks should happen against intended target cells before movement starts.
- Logical grid position should update only when movement into the next cell completes.
- AI should be designed for compact tactical maps with corridors, chokepoints, cover, and base zones rather than open-field chaos.
- Keep changes small, reversible, and easy to review.

## Do-Not-Break Rules

- Follow `CODEX_HANDOFF.md` before coding.
- Preserve any playable core once one exists.
- Do not rewrite large systems unless the existing implementation is clearly unsalvageable and the user approves.
- Do not add dependencies unless they are necessary and justified.
- Do not treat `assets/style_reference_sprite_sheet.png` as a clean transparent atlas.
- Do not hard-code sprite frame coordinates into entity logic once an asset loader exists.
- Do not couple shooting, movement, and input in a way that blocks one action while another runs.
- Do not hide spawn validation failures; surface invalid level data during development.

## Testing Guidelines

Automated tests use Node's built-in test runner. Add focused tests around gameplay rules that are easy to regress:

- grid interpolation
- constant movement speed
- tap-rush prevention
- collision checks
- spawn validation
- projectile updates
- win/loss conditions

Until tests exist, document manual verification steps in each change. Example: "Start level 1, hold movement, fire while turning, confirm movement speed does not increase."

## Commit And Pull Request Guidelines

Current history uses a plain descriptive commit style, for example `Initial Tanchiki checkpoint before Codex handoff`. Keep commits short, imperative or descriptive, and scoped to one logical change.

Pull requests should include a concise summary, changed files or systems, manual test steps, and screenshots or clips for visible gameplay or asset changes. Link issues when available.

## Linear Label Taxonomy

Use explicit role, readiness, and gate labels for Level 4 automation.

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Gate labels:

- `needs-human-approval`
- `blocked`
- `human-only`

Deprecated ambiguous usage:

- Do not use `agent-ready` for new Level 4 routing.
- Do not use `human-review` to mean reviewer-agent work.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.

Level 1 PR workflow:

- Use one issue per PR.
- Keep PRs small and reviewable.
- Use `.github/pull_request_template.md`.
- Follow `ops/policies/level-1-agent-boundaries.md`.
- GitHub Actions must pass `npm test`, `npm run build`, and `npm run lint` before merge.
- Do not push to `main`.
- Do not force push unless explicitly approved.
- Do not include broad refactors or unrelated cleanup.
- Do not rewrite `src/game/movement.js` unless the issue explicitly requires it or a failing test proves it is necessary.

Level 2 command-center workflow:

- Codex must select work from Linear, not from a manually named issue, when using the Level 2 workflow.
- Codex must not pick Backlog issues.
- Codex may pick only issues with status `Todo`, label `automation-ready`, and exactly one `role:*` label.
- Codex must not pick issues labeled `blocked`, `needs-human-approval`, or `human-only`, issues blocked by another issue, or safety-critical work.
- Codex must not pick parent, epic, or campaign umbrella issues.
- Codex must not implement issues gated by `needs-human-approval` until a human removes the gate and applies `automation-ready`.
- For dependency chains, only one implementation issue may be `Todo` + `automation-ready` at a time.
- Codex must work one issue only per branch and PR.
- Codex must move the selected Linear issue to `In Progress` when starting.
- Before creating a branch, Codex must run `git fetch --prune origin`, `git switch main`, `git pull --ff-only origin main`, and `git status --short`.
- Codex must create a branch from updated `main`.
- Codex must open a draft PR against `main`.
- Codex must move the Linear issue to `In Review` when the draft PR is opened.
- Codex must not move the issue to `Done` until the PR is merged or a human explicitly approves closing it.
- Use `prompts/codex-next.md` as the reusable dispatcher prompt for this workflow.
- Before implementation, Codex must inspect recent merged PRs or git history when available. If the issue touches files modified by the previous one to three merged PRs, report conflict risk.
- If several consecutive issues touch `src/game.js` or `test/game.test.js`, recommend a seam-extraction issue before continuing feature work.

Level 3 planner workflow:

- Use Level 3 only to turn a high-level campaign brief into small Linear issues.
- The planner may create Linear issues only.
- The planner must not edit source code or implement gameplay.
- The planner must not apply `automation-ready` automatically.
- The planner must not apply `automation-ready` to parent, epic, blocked, or `needs-human-approval` issues.
- The planner must classify every issue as `automation-ready candidate`, `needs-human-approval`, `human-only`, or `blocked/dependency`.
- The planner must assign suggested role labels in the issue description.
- Each planned issue must include Goal, Current state, Files likely involved, Scope, Do-not-touch list, Acceptance criteria, Tests required, Validation commands, Manual QA, Risk level, Suggested labels, Planner classification, Dependencies or blockers, Dependency order, Blocked-by relationships where possible, Visible UI change expected, Central-file conflict risk, Suggested role label, and First issue that should become `Todo` + `automation-ready`.
- Issues must be small enough for one Level 2 implementation pass.
- Avoid broad vague issues like "improve AI", "polish game", or "add campaign".
- Use `ops/prompts/planner-agent.md`, `ops/policies/planner-boundaries.md`, `ops/policies/campaign-execution.md`, `ops/checklists/conflict-risk-checklist.md`, `ops/checklists/planner-output-checklist.md`, and `prompts/codex-plan-campaign.md` for this workflow.
- Use `ops/prompts/campaign-groomer.md` and `ops/checklists/campaign-grooming-checklist.md` after planning to ensure exactly one issue is ready for automation.

Level 4 role-separated workflow:

- Use Level 4 when a Codex run must act as one clear role: Planner, Architect, Coder, Test, Reviewer, or Release.
- Prefer the Level 4 Dispatcher when the user asks to continue the next eligible issue without naming a role.
- The Dispatcher must use Linear MCP, read one full issue, and route by `ops/policies/role-router.md`.
- The Dispatcher may route to Architect, Coder, Test, Reviewer, or Release; it must skip blocked/gated issues and stop for missing or ambiguous role labels.
- The Dispatcher must require `Todo`, `automation-ready`, exactly one `role:*` label, and no gate labels.
- Never route Architect, Test, Reviewer, or Release issues to Coder.
- Use `ops/policies/role-boundaries.md` as the shared boundary source.
- Planner may create Linear issues only.
- Architect may review issues, architecture risk, dependency order, file ownership, and conflict risk only; no implementation.
- Coder may implement exactly one Linear issue that is `Todo` + `automation-ready` + `role:coder`.
- Test agent may add or improve tests but must not change gameplay behavior unless required to make tests meaningful and explicitly reported.
- Reviewer agent reviews PR diffs, comments, tests, CI, and role-boundary compliance; it must not merge.
- Release agent summarizes merged PRs and updates campaign or release notes; no gameplay changes.
- Any role must start from updated `main`.
- Any PR must target `main`.
- No role may bypass CI.
- No role may push directly to `main`, merge automatically, or close parent campaign issues unless all children are done and a release summary exists.
- Use `ops/prompts/architect-agent.md`, `ops/prompts/coder-agent.md`, `ops/prompts/test-agent.md`, `ops/prompts/reviewer-agent.md`, and `ops/prompts/release-agent.md` for role runs.
- Use `ops/policies/role-router.md`, `ops/checklists/role-routing-checklist.md`, `ops/checklists/campaign-grooming-checklist.md`, `ops/checklists/architect-review-checklist.md`, `ops/checklists/pr-review-checklist.md`, and `ops/checklists/release-summary-checklist.md` for routing and validation.
- Use `prompts/codex-next.md`, `prompts/codex-role-router.md`, `prompts/codex-architect-review.md`, `prompts/codex-test-pass.md`, `prompts/codex-review-pr.md`, and `prompts/codex-release-summary.md` as reusable launch prompts.

## Harness Conflict Prevention

- `src/game.js` and `test/game.test.js` are integration points, not dumping grounds.
- Significant feature logic should move into focused modules and focused tests when practical.
- Prefer seams such as progression helpers, campaign progression helpers, player stats helpers, reward helpers, and focused test files.
- If an issue is internal-only, state that no visible UI change is expected. If visible UI is expected, point to the later UI issue.
- If a PR conflicts with `main`, resolve conflicts on the PR branch, never on `main`; preserve both `main` behavior and PR behavior; run `npm test`, `npm run build`, and `npm run lint`; push the PR branch; do not merge automatically.

## Git Discipline

- Before editing files, inspect `git status --short`.
- If the tree is dirty before starting, create a checkpoint commit or explain why a checkpoint is not appropriate.
- After changes, run:

```bash
npm test
npm run build
npm run lint
```

- If validation passes, commit the changes with a meaningful message.
- Include the Linear issue ID in the commit message when available.
- The repo uses `.githooks/pre-commit` through `git config core.hooksPath .githooks`; that hook reruns `npm test`, `npm run build`, and `npm run lint` and blocks failed commits.
- Never finish a task with a dirty working tree unless explicitly reporting a blocked state.
- Never run `git push` automatically.

# Linear + Codex workflow

This project uses Linear as the development program and Codex as the implementation agent.

## Core rule
Do not start broad rewrites. Work from one Linear issue at a time.

## Level 2 issue selection
When no issue is named and the user asks Codex to continue automation-ready work:

1. Query Linear for all `Todo` issues.
2. Select the highest-priority issue with `automation-ready` and exactly one `role:*` label.
3. Exclude `Backlog`, `blocked`, `needs-human-approval`, `human-only`, blocked-by relations, parent/epic issues, and safety-critical work.
4. Confirm dependency chains expose only one `Todo` + `automation-ready` issue.
5. Move the issue to `In Progress` before editing.
6. Sync `main` with `git fetch --prune origin`, `git switch main`, `git pull --ff-only origin main`, and `git status --short`.
7. Inspect recent merged PRs or git history for conflict risk.
8. Open a draft PR against `main` after validation and move the issue to `In Review`.
9. Leave the issue out of `Done` until merge or explicit human approval.

## Level 3 campaign planning
When the user asks Codex to plan a campaign brief:

1. Use Linear MCP and read the campaign brief.
2. Read `ops/policies/planner-boundaries.md` and `ops/checklists/planner-output-checklist.md`.
3. Create 5-8 small Linear issues when the brief is large enough.
4. Preserve dependencies between issues.
5. Do not implement gameplay or edit source code.
6. Do not apply `automation-ready` unless a human explicitly instructs it.
7. Include dependency order, blocked-by relationships where possible, visible UI expectation, central-file conflict risk, suggested role labels, and the first issue that should become `Todo` + `automation-ready`.
8. Stop after creating issues and reporting the summary.

## Level 4 role-separated workflow
When the user asks Codex to run a role-separated workflow:

1. If no role is named, run the Level 4 Dispatcher from `ops/policies/role-router.md`.
2. Choose exactly one role: Planner, Architect, Coder, Test, Reviewer, or Release.
3. Read `ops/policies/role-boundaries.md` and the matching role prompt in `ops/prompts/`.
4. Start from updated `main`.
5. Stay inside the role's authority.
6. Open PRs only against `main`.
7. Do not bypass CI.
8. Do not merge automatically.
9. Do not close parent campaign issues unless all children are done and a release summary exists.

## Before implementation
1. Use the Linear MCP server to read the assigned issue.
2. Restate the goal, constraints, and acceptance criteria.
3. Inspect the relevant files before editing.
4. Create or use a Git branch for the task when appropriate.
5. Do not change `movement.js` unless the issue explicitly requires it or a failing test proves it is necessary.

## During implementation
1. Keep patches small and reversible.
2. Maintain separation between:
   - movement
   - input
   - projectiles
   - targets/entities
   - sentry/enemy behavior
   - rendering
   - levels
3. Add or update tests for every gameplay logic change.
4. Do not add external dependencies unless the issue explicitly asks for it.

## Validation
After code changes, run:

```bash
npm test
npm run build
npm run lint
```
