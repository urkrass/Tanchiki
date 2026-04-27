# Tank RPG Game - Codex Handoff Pack

This pack is meant to be copied into the root of the local game repository before opening it with Codex.

It contains:

- `CODEX_HANDOFF.md` - project brief and constraints.
- `prompts/CODEX_START_PROMPT.md` - first prompt to paste into Codex.
- `docs/ASSET_PIPELINE.md` - recommended sprite/tileset pipeline.
- `assets/style_reference_sprite_sheet.png` - visual style reference only, not yet a clean production sprite sheet.
- `assets/sprite_manifest.template.json` - target manifest format for usable sprite sheets.
- `index.html` - browser entry point for the playable prototype.
- `src/main.js` - requestAnimationFrame loop and fixed-step update driver.
- `src/game.js` - game state wiring for level, player, and movement.
- `src/render.js` - Canvas renderer.
- `src/input.js` - keyboard input handling.
- `src/game/level.js` - small test level and blocked-cell checks.
- `src/game/movement.js` - minimal grid movement state module.
- `src/game/projectiles.js` - shell spawning, cooldown, travel, range, and wall collisions.
- `src/game/sentries.js` - stationary enemy line-of-sight firing and player damage constants.
- `src/game/spawnValidation.js` - mission-start safety checks.
- `src/game/targets.js` - stationary dummy targets and damage rules.
- `test/movement.test.js` - movement behavior tests.
- `test/projectiles.test.js` - projectile and shooting behavior tests.
- `test/sentries.test.js` - enemy sentry and line-of-sight behavior tests.
- `test/spawnValidation.test.js` - safe mission-start validation tests.
- `test/targets.test.js` - dummy target hit/damage behavior tests.

Important: the included PNG is a style board/reference. It contains labels, grey background, and irregular layout. Codex should not treat it as a finished transparent sprite atlas unless it first builds a clean slicing/extraction workflow or replaces it with clean generated assets.

## Commands

Requires Node.js 20+.

```powershell
npm test
npm run build
npm run lint
npm run dev
```

Run `npm run dev`, then open `http://localhost:5173`.

Use Arrow keys or WASD to move. Press Space to fire a shell in the tank's current facing direction. Enemy sentries fire when they have clear row/column line of sight. Press `R` to restart.

## Git Discipline

This repository uses a versioned pre-commit hook in `.githooks/pre-commit`.

The repo-local Git config should point hooks at that directory:

```powershell
git config core.hooksPath .githooks
```

Before every commit, the hook runs:

```powershell
npm test
npm run build
npm run lint
```

If any command fails, the commit is blocked. Do not push automatically.

## Level 1 PR Workflow

Every pull request must be tied to one issue and stay small enough to review in one pass.

Required PR checks run in GitHub Actions on every pull request and on pushes to `main`:

```powershell
npm test
npm run build
npm run lint
```

CI uses Node.js 20. It installs dependencies with `npm ci` when `package-lock.json` exists, otherwise it uses `npm install`.

Use `.github/pull_request_template.md` for PR descriptions and `ops/policies/level-1-agent-boundaries.md` for agent boundaries. Do not push directly to `main`, force push, start broad refactors, or include unrelated cleanup in a Level 1 PR.

Harness smoke-test PRs should use an `agent/` branch, be opened as drafts with the PR template filled out, and remain unmerged until reviewed.

## Level 2 Command Center Workflow

Level 2 lets Codex select the next unit of work from Linear instead of requiring a manually named issue.

The Linear source of truth is `Tanchiki Level 2 Command Center Protocol` in the Tanchiki project:

https://linear.app/marsel/document/tanchiki-level-2-command-center-protocol-617ef034bf14

Use these Linear states:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

Codex may pick only issues that are all of the following:

- status `Todo`
- labeled `agent-ready`
- not blocked
- not safety-critical
- not labeled `human-only`

Level 2 labels:

- `agent-ready`
- `human-review`
- `gameplay`
- `testing`
- `level-design`
- `ai`
- `assets`
- `polish`
- `harness`
- `human-only`
- `blocked`

When Codex starts a Level 2 issue, it must move the issue to `In Progress`, create a branch from `main`, make one scoped change, run `npm test`, `npm run build`, and `npm run lint`, commit, push, and open a draft PR against `main`. After the draft PR is opened, Codex must move the Linear issue to `In Review`.

Codex must not pick `Backlog` issues and must not move an issue to `Done` until the PR is merged or a human explicitly approves closing it.

Use `prompts/codex-next-agent-ready.md` to start a Level 2 agent-ready run.

## Level 3 Planner Workflow

Level 3 lets Codex turn a high-level campaign brief into small Linear issues without implementing gameplay.

The Linear source of truth is `Tanchiki Level 3 Planner Protocol` in the Tanchiki project.

https://linear.app/marsel/document/tanchiki-level-3-planner-protocol-ec0d116846fd

Planner agents may:

- read the brief and repository documentation
- create Linear issues
- suggest labels, risk levels, and dependencies

Planner agents must not:

- edit source code
- implement gameplay
- mark issues `agent-ready` automatically unless explicitly instructed
- move issues into implementation states

Every planned issue must be classified as one of:

- `agent-ready candidate`
- `human-review required`
- `human-only`
- `blocked/dependency`

Use these files for Level 3 planning:

- `ops/prompts/planner-agent.md`
- `ops/policies/planner-boundaries.md`
- `ops/checklists/planner-output-checklist.md`
- `prompts/codex-plan-campaign.md`
