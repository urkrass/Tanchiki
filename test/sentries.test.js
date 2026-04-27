import test from "node:test";
import assert from "node:assert/strict";
import { createProjectile, updateProjectile } from "../src/game/projectiles.js";
import {
  ENEMY_FIRE_COOLDOWN_SECONDS,
  ENEMY_FIRE_WINDUP_SECONDS,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
  hasLineOfSight,
  updateEnemySentries
} from "../src/game/sentries.js";
import { createTarget, damageTarget } from "../src/game/targets.js";

test("enemy detects player in same row with no wall", () => {
  assert.equal(hasLineOfSight(openLevel(), 1, 1, 4, 1), true);
});

test("enemy does not detect player if wall blocks line of sight", () => {
  const level = openLevel();
  level.tiles[1] = "#..#..#";

  assert.equal(hasLineOfSight(level, 1, 1, 5, 1), false);
});

test("enemy does not detect player diagonally", () => {
  assert.equal(hasLineOfSight(openLevel(), 1, 1, 3, 3), false);
});

test("solid entities block line of sight", () => {
  const blocker = createTarget({ id: "blocker", gridX: 2, gridY: 1 });

  assert.equal(hasLineOfSight(openLevel(), 1, 1, 4, 1, [blocker]), false);
});

test("enemy wind-up starts when LOS exists", () => {
  const sentry = createTarget({ id: "sentry", gridX: 1, gridY: 1 });
  const store = { projectiles: [] };

  updateEnemySentries({
    level: openLevel(),
    entities: [sentry],
    player: { gridX: 4, gridY: 1 },
    projectileStore: store,
    deltaSeconds: 0.1
  });

  assert.equal(store.projectiles.length, 0);
  assert.equal(sentry.aimDirection, "right");
  assert.equal(sentry.aimRemainingSeconds, ENEMY_FIRE_WINDUP_SECONDS);
});

test("enemy shot is cancelled if LOS breaks before wind-up completes", () => {
  const sentry = createTarget({ id: "sentry", gridX: 1, gridY: 1 });
  const blocker = createTarget({ id: "blocker", gridX: 2, gridY: 1 });
  const store = { projectiles: [] };

  updateEnemySentries({
    level: openLevel(),
    entities: [sentry],
    player: { gridX: 4, gridY: 1 },
    projectileStore: store,
    deltaSeconds: 0.1
  });
  updateEnemySentries({
    level: openLevel(),
    entities: [sentry, blocker],
    player: { gridX: 4, gridY: 1 },
    projectileStore: store,
    deltaSeconds: ENEMY_FIRE_WINDUP_SECONDS
  });

  assert.equal(store.projectiles.length, 0);
  assert.equal(sentry.aimDirection, null);
  assert.equal(sentry.aimRemainingSeconds, 0);
});

test("enemy fires only after wind-up and cooldown", () => {
  const sentry = createTarget({
    id: "sentry",
    gridX: 1,
    gridY: 1,
    fireCooldownRemaining: ENEMY_FIRE_COOLDOWN_SECONDS
  });
  const store = { projectiles: [] };

  updateEnemySentries({
    level: openLevel(),
    entities: [sentry],
    player: { gridX: 4, gridY: 1 },
    projectileStore: store,
    deltaSeconds: ENEMY_FIRE_COOLDOWN_SECONDS
  });
  assert.equal(store.projectiles.length, 0);
  assert.equal(sentry.aimDirection, "right");

  updateEnemySentries({
    level: openLevel(),
    entities: [sentry],
    player: { gridX: 4, gridY: 1 },
    projectileStore: store,
    deltaSeconds: ENEMY_FIRE_WINDUP_SECONDS
  });

  assert.equal(store.projectiles.length, 1);
  assert.equal(store.projectiles[0].team, "enemy");
  assert.equal(store.projectiles[0].speedCellsPerSecond, ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND);
});

test("enemy projectile damage value is defined", () => {
  assert.equal(ENEMY_PROJECTILE_DAMAGE, 1);
});

test("enemy projectile does not damage enemy entities", () => {
  const target = createTarget({ id: "enemy", gridX: 3, gridY: 1, hp: 2 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10,
    team: "enemy"
  });

  updateProjectile(projectile, 0.5, () => false, [], (fromX, fromY, toX, toY, shot) => {
    if (shot.team === target.team) {
      return null;
    }
    damageTarget(target);
    return { x: target.gridX + 0.5, y: target.gridY + 0.5 };
  });

  assert.equal(target.hp, 2);
  assert.equal(projectile.active, true);
});

function openLevel() {
  return {
    width: 7,
    height: 5,
    tiles: [
      "#######",
      "#.....#",
      "#.....#",
      "#.....#",
      "#######"
    ]
  };
}
