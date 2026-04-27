Original prompt: Implement the first projectile/shooting system for the playable Tanchiki prototype.

Progress:
- Added plan to keep shooting independent from movement and input buffering.
- Projectile logic will live in `src/game/projectiles.js` and stay testable without the browser.
- Implemented projectile store, firing cooldown, wall impacts, rendering hooks, and deterministic browser debug hooks.
- Fixed floating-point cooldown edge found by `npm test`.
- Browser fallback verification confirmed visible shell, active projectile state, cooldown, wall removal, and zero console errors.
- Final command pass: `npm test`, `npm run build`, and `npm run lint` all passed.
- Fixed movement step-length regression by consuming one movement intent per non-repeat keydown in `src/input.js`.
- Browser verification confirmed tap, hold, and Space-during-move all end one cell from the start position with zero console errors.
- Refined input again so held movement continues cell-by-cell at normal movement speed. Tap still moves one cell; repeat keydown is ignored for acceleration.
- Browser verification confirmed tap, hold, direction change, and Space while holding movement with zero console errors.
- Added damageable stationary dummy targets. Shells damage targets for 1 HP, targets have 2 HP, and targets do not block player movement in this slice.
- Browser verification confirmed the first dummy target loses 1 HP on the first shell and is destroyed on the second shell with zero console errors.
- Added mission status, enemy base win condition, solid live enemy entities, and `R` restart.
- HTTP check confirmed the dev server responds on `http://localhost:5173`; Playwright MCP transport was closed during this pass, so browser visual verification could not be completed.
- Added enemy sentry firing, player HP, loss state, enemy projectile damage, and row/column line-of-sight checks. Solid live entities block sentry line of sight.
- Added combat fairness pass: spawn safety validation, 0.45s enemy wind-up, red warning line, 0.55s player invulnerability, slower 3.5 cells/sec enemy shells, and loss/victory restart prompts.
- Adjusted the first sentry from `(4,1)` to `(4,3)` so the player no longer spawns in immediate enemy line of sight.
- MAR-48 combat fairness follow-up: centralized combat tuning, lengthened enemy warning to 0.6s, cooldown to 1.45s, player invulnerability to 0.7s, slowed enemy shells to 3 cells/sec, and added status/debug visibility for sentry warnings and invulnerability.
- MAR-51 level schema pass: moved the current test mission into `TEST_MISSION_SCHEMA`, added `loadLevelSchema()` normalization/validation, routed default game setup through `createTestMission()`, preserved current level/entity behavior, and added loader tests.
- MAR-52 multiple levels and progression: added a three-level campaign using the existing level schema, validated every campaign level before play, added current-level tracking with `N`/`Enter` advancement after victory, kept `R` scoped to current-level restart, added a final campaign-complete state, and covered progression with tests.
- MAR-52 validation pass: `npm test`, `npm run build`, and `npm run lint` all passed; `src/game/movement.js` remained unchanged.
- MAR-53 mission summary screen: added snapshot-driven victory, failure, and campaign-complete summaries with level, HP, enemy base status, enemies destroyed, and next action data. Campaign-complete uses the current supported `R` behavior: replay the final level rather than restart the full campaign.
- MAR-53 validation pass: `npm test`, `npm run build`, and `npm run lint` all passed; `src/game/movement.js` remained unchanged.
- MAR-53 PR follow-up: added regression coverage that the loss summary remains failure-only, does not advance levels, and never advertises the victory continue action.
- MAR-57 pickups: added repair, ammo, and shield pickups loaded from mission schemas. Collection happens only when player movement settles on a cell boundary. Repair caps at max HP, ammo is tracked as reserve without limiting fire yet, and shield blocks one incoming enemy hit.
- MAR-57 validation pass: `npm test`, `npm run build`, and `npm run lint` all passed. Browser smoke test confirmed visible pickup glyphs and pickup consumption through `window.render_game_to_text`.

TODO:
- Next patch candidates: projectile cleanup policy, target score/rewards, moving enemy AI, destructible props, or sound effects.
- MAR-57 follow-up candidate: decide later whether ammo reserve should become a real shot limit or remain a displayed progression/resource stub.
