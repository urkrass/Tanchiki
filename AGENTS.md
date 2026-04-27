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
```

`npm run dev` serves the prototype at `http://localhost:5173`. `build` and `lint` currently run syntax checks only.

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
- Never finish a task with a dirty working tree unless explicitly reporting a blocked state.
- Never run `git push` automatically.

# Linear + Codex workflow

This project uses Linear as the development program and Codex as the implementation agent.

## Core rule
Do not start broad rewrites. Work from one Linear issue at a time.

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
