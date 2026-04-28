# Tanchiki Architecture

This prototype is a dependency-free browser game. The runtime is small and deliberately split by gameplay responsibility so future agents can change one behavior without turning `src/game.js` into a catch-all.

## Runtime Shape

- `index.html` loads the browser entry point.
- `src/main.js` owns the requestAnimationFrame loop and fixed-step update driver.
- `src/input.js` owns keyboard state and browser scroll prevention.
- `src/game.js` wires level loading, player state, combat, pickups, progression, and mission status.
- `src/render.js` owns Canvas drawing.
- `src/upgradePanel.js` owns the reward and upgrade UI surface.

Keep `src/game.js` as orchestration. New behavior should move into focused modules under `src/game/` and be wired into `src/game.js` only at the boundary.

## Movement Ownership

`src/game/movement.js` is the canonical movement module. It owns:

- grid movement state
- facing direction
- target-cell movement
- visual interpolation
- constant movement speed invariants
- tap-rush prevention

Movement is protected. Do not edit `src/game/movement.js` unless the Linear issue explicitly authorizes movement work and uses `type:movement`, `validation:movement`, and the required human gate. Entity collision, spawn checks, and AI routing should normally live outside `movement.js`.

## Level Schema

Level data is loaded through `src/game/levelLoader.js` and level definitions under `src/game/levels/`.

Current responsibilities:

- `src/game/level.js`: blocked-cell checks and test-level compatibility.
- `src/game/levelLoader.js`: schema loading and validation.
- `src/game/spawnValidation.js`: mission-start safety checks.
- `src/game/pathfinding.js`: route search helpers.

New level rules should prefer schema validation or focused helpers rather than special cases in `src/game.js`.

## Campaign And Progression

Campaign state is split across focused modules:

- `src/game/campaignProgression.js`: campaign advancement and snapshots.
- `src/game/progression.js`: XP, upgrade points, and upgrade ranks.
- `src/game/upgradeChoices.js`: deterministic upgrade choices.
- `src/game/progressionFeedback.js`: display-ready reward feedback.
- `src/game/playerStats.js`: derived player stats from upgrades.
- `src/game/pickups.js`: pickup collection and effects.

No save or persistence layer exists. Persistence requires explicit human approval because it changes carried state, compatibility, and player expectations.

## Combat And Enemies

- `src/game/projectiles.js`: projectile creation, travel, range, cooldown, and wall collision.
- `src/game/sentries.js`: stationary enemy line-of-sight firing.
- `src/game/patrols.js`: patrol movement.
- `src/game/pursuit.js`: pursuit movement and routing.
- `src/game/targets.js`: damageable entities and base destruction.
- `src/game/combatTuning.js`: combat constants that need central visibility.

Avoid broad AI rewrites. Add focused behavior in a named module with tests and manual QA.

## Rendering And UI Boundaries

Rendering and UI should stay separate from gameplay decisions:

- `src/render.js` draws current state to Canvas.
- `src/upgradePanel.js` displays campaign reward and upgrade choices.
- `src/styles.css` owns page styling.

UI changes must not change movement, combat, progression, or level rules unless the issue is explicitly scoped for that behavior.

## Central Files To Protect

These files are high-conflict integration points:

- `src/game.js`
- `test/game.test.js`
- `src/game/movement.js`
- `package.json`
- `README.md`
- `AGENTS.md`

Touch them only when the issue requires it. When multiple consecutive issues need the same central file, create an architecture or seam-extraction issue before continuing feature work.

## Where New Logic Goes

Prefer focused modules:

```text
src/game/collision.js
src/game/ai.js
src/game/spawns.js
src/game/rewards.js
src/game/campaignState.js
src/assets/sprites/manifest.json
```

Each new gameplay module should have a focused test file under `test/` and should keep state explicit and serializable where practical.
