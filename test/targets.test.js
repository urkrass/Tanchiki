import test from "node:test";
import assert from "node:assert/strict";
import { createMovementState, requestMove, updateMovement } from "../src/game/movement.js";
import { createProjectile, updateProjectile } from "../src/game/projectiles.js";
import {
  createBase,
  createEntity,
  PROJECTILE_DAMAGE,
  createTarget,
  damageTarget,
  findTargetHitOnSegment,
  isSolidEntityAt
} from "../src/game/targets.js";

test("projectile hitting a target reduces hp and consumes projectile", () => {
  const target = createTarget({ id: "target-a", gridX: 3, gridY: 1, hp: 2 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });
  const impacts = [];

  updateProjectile(projectile, 0.5, () => false, impacts, hitTargets([target]));

  assert.equal(projectile.active, false);
  assert.equal(target.hp, 1);
  assert.equal(target.alive, true);
  assert.equal(impacts.length, 1);
});

test("target is destroyed at hp <= 0", () => {
  const target = createTarget({ id: "target-a", gridX: 3, gridY: 1, hp: 1 });

  assert.equal(damageTarget(target, PROJECTILE_DAMAGE), true);

  assert.equal(target.hp, 0);
  assert.equal(target.alive, false);
  assert.equal(target.destroyed, true);
});

test("enemy base takes damage and is destroyed at hp <= 0", () => {
  const base = createBase({ id: "base-a", gridX: 3, gridY: 1, hp: 1 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });

  updateProjectile(projectile, 0.5, () => false, [], hitTargets([base]));

  assert.equal(base.hp, 0);
  assert.equal(base.alive, false);
  assert.equal(base.destroyed, true);
  assert.equal(projectile.active, false);
});

test("projectile does not pass through one target and hit another behind it", () => {
  const front = createTarget({ id: "front", gridX: 3, gridY: 1, hp: 1 });
  const behind = createTarget({ id: "behind", gridX: 4, gridY: 1, hp: 1 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 8,
    maxRangeCells: 10
  });

  updateProjectile(projectile, 0.5, () => false, [], hitTargets([front, behind]));

  assert.equal(projectile.active, false);
  assert.equal(front.destroyed, true);
  assert.equal(behind.hp, 1);
  assert.equal(behind.alive, true);
});

test("wall collision still works without a target hit", () => {
  const target = createTarget({ id: "target-a", gridX: 5, gridY: 1, hp: 2 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });
  const impacts = [];

  updateProjectile(
    projectile,
    0.5,
    (x, y) => x === 3 && y === 1,
    impacts,
    hitTargets([target])
  );

  assert.equal(projectile.active, false);
  assert.equal(target.hp, 2);
  assert.equal(impacts.length, 1);
});

test("shooting a target does not affect player movement state", () => {
  const tank = createMovementState({
    gridX: 1,
    gridY: 1,
    facing: "right",
    speedCellsPerSecond: 2
  });
  const target = createTarget({ id: "target-a", gridX: 3, gridY: 1, hp: 2 });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });

  requestMove(tank, "right");
  updateMovement(tank, 0.25);
  const progress = tank.moveProgress;
  const toX = tank.toX;
  const toY = tank.toY;

  updateProjectile(projectile, 0.5, () => false, [], hitTargets([target]));

  assert.equal(tank.moveProgress, progress);
  assert.equal(tank.toX, toX);
  assert.equal(tank.toY, toY);
  assert.equal(tank.isMoving, true);
});

test("destroyed targets are not hit again", () => {
  const target = createTarget({ id: "target-a", gridX: 3, gridY: 1, hp: 1 });
  const first = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });
  const second = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });

  updateProjectile(first, 0.5, () => false, [], hitTargets([target]));
  updateProjectile(second, 0.5, () => false, [], hitTargets([target]));

  assert.equal(target.destroyed, true);
  assert.equal(target.hp, 0);
  assert.equal(second.active, true);
});

test("player projectiles do not damage player-team entities", () => {
  const ally = createEntity({
    id: "player-base",
    gridX: 3,
    gridY: 1,
    hp: 3,
    team: "player",
    type: "base"
  });
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 4,
    maxRangeCells: 10,
    team: "player"
  });

  updateProjectile(projectile, 0.5, () => false, [], hitTargets([ally], "player"));

  assert.equal(ally.hp, 3);
  assert.equal(ally.alive, true);
  assert.equal(projectile.active, true);
});

test("alive entities are solid and destroyed entities are not", () => {
  const target = createTarget({ id: "target-a", gridX: 2, gridY: 1, hp: 1 });

  assert.equal(isSolidEntityAt([target], 2, 1), true);
  damageTarget(target);
  assert.equal(isSolidEntityAt([target], 2, 1), false);
});

test("entity solidity is external to movement.js", () => {
  const tank = createMovementState({
    gridX: 1,
    gridY: 1,
    facing: "right",
    speedCellsPerSecond: 2
  });

  assert.equal(requestMove(tank, "right", () => true), true);
  updateMovement(tank, 0.5, () => true);

  assert.equal(tank.gridX, 2);
  assert.equal(tank.gridY, 1);
});

function hitTargets(targets, projectileTeam = "player") {
  return (fromX, fromY, toX, toY) => {
    const target = findTargetHitOnSegment(targets, fromX, fromY, toX, toY, projectileTeam);
    if (!target) {
      return null;
    }

    damageTarget(target);
    return {
      x: target.gridX + 0.5,
      y: target.gridY + 0.5,
      target
    };
  };
}
