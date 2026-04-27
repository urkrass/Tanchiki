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
- `src/game/targets.js` - stationary dummy targets and damage rules.
- `test/movement.test.js` - movement behavior tests.
- `test/projectiles.test.js` - projectile and shooting behavior tests.
- `test/sentries.test.js` - enemy sentry and line-of-sight behavior tests.
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
