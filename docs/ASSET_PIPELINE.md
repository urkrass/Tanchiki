# Asset Pipeline Plan

## Why the current PNG is reference-only

`assets/style_reference_sprite_sheet.png` is not a clean production atlas. It has labels, a grey background, and inconsistent layout. It is useful for art direction, not direct slicing.

## Target production format

Use clean sprite sheets:

- Transparent PNG.
- Uniform cell size: 32x32 or 48x48.
- No labels inside the image.
- One sheet per character/effect group.
- A JSON manifest maps animation names to frame coordinates.

## Recommended asset paths

```text
src/assets/sprites/tanks/player.png
src/assets/sprites/tanks/ally_scout.png
src/assets/sprites/tanks/ally_support.png
src/assets/sprites/tanks/enemy_scout.png
src/assets/sprites/tanks/enemy_heavy.png
src/assets/sprites/effects/explosion.png
src/assets/sprites/effects/muzzle_flash.png
src/assets/sprites/projectiles/projectiles.png
src/assets/sprites/tiles/tileset.png
src/assets/sprites/pickups/pickups.png
src/assets/sprites/manifest.json
```

## Loader behavior

The game should not hard-code frame coordinates in entity logic. Use a manifest:

```js
getSpriteFrame("player_tank", "move", "up", frameIndex)
```

## Temporary implementation

Before final art is available, Codex may create placeholder colored rectangles or simple canvas sprites. The gameplay architecture should support later replacement with real sprite sheets.
