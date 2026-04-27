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

TODO:
- Next patch candidates: projectile cleanup policy, target score/rewards, moving enemy AI, destructible props, or sound effects.
