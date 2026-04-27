# Codex Handoff: Top-Down Tank RPG

## Project identity

Working concept: a top-down tactical tank RPG inspired by classic grid-based tank games, but with smoother pacing, teammates, bases, level progression, and light RPG systems.

Current design direction:

- Top-down 2D tank game.
- Grid-aware movement, but not ugly snapping.
- Movement should feel smooth, slow, readable, and constant-speed.
- Player should not be able to tap-rush faster than the intended speed.
- Tank should never spawn inside props/walls.
- Shooting must not freeze turning or movement.
- Projectiles should be slower and readable.
- AI should perform better in maze-like levels than in chaotic open fields.
- Add teams, allies, bases, winning conditions, new levels, and progression.
- Add RPG elements: tank roles/classes, upgrades, repairs, ammo, armor/shield, and teammate support.

## Strong constraints

Do not rewrite the whole project unless the existing code is unsalvageable. First inspect the codebase and identify the current architecture.

Preserve the current playable core if it exists. Work in small reviewable patches.

Before coding, produce a short plan with:

1. Files to inspect.
2. Likely source of movement/grid snapping bugs.
3. Minimal implementation sequence.
4. Risks.

## Current gameplay problems to fix first

### 1. Movement/grid snapping

The tank currently shows strange grid snapping or jitter while moving. The desired behavior is:

- Commands are grid-based: the player chooses a target cell/direction.
- Motion is animated between cells.
- The tank moves at constant speed.
- A new move command is ignored or queued while the tank is already moving, so tap-rushing cannot accelerate movement.
- The rendered position should be interpolated from logical cell A to logical cell B.
- The logical grid position should update only when the move finishes.
- Collision checks should happen against the intended target cell before movement starts.

Suggested model:

```js
entity = {
  gridX, gridY,
  fromX, fromY,
  toX, toY,
  facing,
  moveProgress: 0,
  isMoving: false,
  speedCellsPerSecond: 3
}
```

Update loop:

```js
if (entity.isMoving) {
  entity.moveProgress += dt * entity.speedCellsPerSecond;
  if (entity.moveProgress >= 1) {
    entity.gridX = entity.toX;
    entity.gridY = entity.toY;
    entity.isMoving = false;
    entity.moveProgress = 0;
  }
}
```

Render position:

```js
renderX = lerp(fromX, toX, smoothstep(moveProgress)) * tileSize;
renderY = lerp(fromY, toY, smoothstep(moveProgress)) * tileSize;
```

### 2. Shooting lag

Shooting must not block movement or turning. Do not tie projectile creation to expensive synchronous work in the input handler. Projectiles should be spawned cheaply and updated in the normal game loop.

Projectile behavior:

- Slower than current version.
- One projectile entity per shot.
- Moves by velocity and delta time.
- Collision resolved in the update loop.
- Optional fire cooldown prevents spam.

### 3. Spawning inside props

Create a spawn validator:

- Define legal spawn cells per level.
- Reject walls, props, bases, water, and occupied cells.
- On level load, validate all spawns and throw a visible development error if invalid.
- Runtime fallback: search nearest legal cell only as emergency recovery.

## Level design direction

Move away from open-field chaos. Use compact tactical maps:

- Maze corridors.
- Chokepoints.
- Defensive base zones.
- Cover islands.
- Flanking routes.
- Ally and enemy spawn zones separated by terrain.

Winning conditions:

- Defend allied base for N waves.
- Destroy enemy base.
- Escort ally engineer tank.
- Capture repair depot.
- Survive boss/heavy tank encounter.

## Teams and roles

Teams:

- Player team.
- Allied AI team.
- Enemy team.
- Neutral/destructible props.

Suggested tank roles:

- Player: balanced command tank.
- Ally Scout: fast, low armor, marks enemies.
- Ally Support: repairs player/allies slowly.
- Ally Heavy: slow, high armor, blocks chokepoints.
- Enemy Scout: fast harassment.
- Enemy Heavy: slow pressure unit.
- Enemy Turret: static area denial.

## RPG progression

Add simple, readable progression first:

- XP gained from enemy kills and objectives.
- Level-up grants one upgrade choice.
- Upgrade examples:
  - Armor +1 hit.
  - Reload speed improved.
  - Projectile speed/damage adjusted.
  - Repair kit capacity.
  - Ally command radius.
  - Shield pickup duration.

Do not overbuild menus first. Start with a simple post-level upgrade screen.

## Assets

Use `assets/style_reference_sprite_sheet.png` as a style reference only.

Target final asset format:

- Pixel art.
- Top-down perspective.
- 32x32 or 48x48 sprites.
- Transparent background.
- Clear silhouettes.
- Consistent outline and palette.
- Sprite sheets with a JSON manifest.

Suggested first production asset set:

- Player tank: idle/move/shoot/destroyed, four directions.
- Ally tanks: scout/support/heavy, four directions.
- Enemy tanks: scout/heavy/turret, four directions where relevant.
- Projectiles: bullet, shell, missile.
- Effects: muzzle flash, smoke, explosion.
- Tiles: grass, dirt, road, stone wall, brick wall, water, base floor, rubble.
- Pickups: repair, ammo, upgrade, shield.

## Engineering sequence for Codex

Recommended implementation order:

1. Run the project locally and identify framework/build commands.
2. Add or repair `README.md` run instructions.
3. Add a deterministic level schema.
4. Fix movement model and grid interpolation.
5. Fix projectile update loop and shooting lag.
6. Add spawn validation.
7. Add teams and base ownership.
8. Add two tactical levels and win/loss conditions.
9. Add asset manifest loader.
10. Add placeholder sprites first; integrate final sprites later.
11. Add basic RPG progression screen.
12. Add smoke/explosion/muzzle effects.
13. Add tests or debug overlays for grid cells, collisions, spawns, and projectile counts.

## Debug overlay requirements

Add a developer/debug toggle if reasonable:

- Show grid.
- Show collision cells.
- Show entity logical cells.
- Show render positions.
- Show target cell while moving.
- Show projectile count and FPS.

This is important because the main current bug appears to be mismatch between logical grid state and rendered movement.

## Codex operating style

Codex should work in small patches. After each patch:

- Explain what changed.
- Explain how to test it manually.
- Mention any files that require special review.
- Do not silently introduce large dependencies.
