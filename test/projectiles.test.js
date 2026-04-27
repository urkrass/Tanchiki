import test from "node:test";
import assert from "node:assert/strict";
import {
  createMovementState,
  requestMove,
  updateMovement
} from "../src/game/movement.js";
import {
  FIRE_COOLDOWN_SECONDS,
  PROJECTILE_MAX_RANGE_CELLS,
  PROJECTILE_SPEED_CELLS_PER_SECOND,
  createProjectile,
  createProjectileStore,
  spawnPointFromTank,
  tryFireProjectile,
  updateProjectile,
  updateProjectileStore
} from "../src/game/projectiles.js";

test("projectile moves at constant speed", () => {
  const projectile = createProjectile({
    x: 1,
    y: 1,
    direction: "right",
    speedCellsPerSecond: 6,
    maxRangeCells: 10
  });

  updateProjectile(projectile, 0.25, () => false);

  assert.equal(projectile.x, 2.5);
  assert.equal(projectile.y, 1);
  assert.equal(projectile.distanceTraveled, 1.5);
});

test("projectile direction is correct", () => {
  const projectile = createProjectile({
    x: 3,
    y: 3,
    direction: "up",
    speedCellsPerSecond: 4,
    maxRangeCells: 10
  });

  updateProjectile(projectile, 0.5, () => false);

  assert.equal(projectile.x, 3);
  assert.equal(projectile.y, 1);
});

test("projectile collides with wall cells", () => {
  const projectile = createProjectile({
    x: 1.5,
    y: 1.5,
    direction: "right",
    speedCellsPerSecond: 2,
    maxRangeCells: 10
  });
  const impacts = [];

  updateProjectile(projectile, 0.5, (x, y) => x === 2 && y === 1, impacts);

  assert.equal(projectile.active, false);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].active, true);
});

test("projectile expires after max range", () => {
  const projectile = createProjectile({
    x: 0,
    y: 0,
    direction: "right",
    speedCellsPerSecond: 5,
    maxRangeCells: 5
  });

  updateProjectile(projectile, 1, () => false);

  assert.equal(projectile.active, false);
});

test("firing cooldown prevents tap and key-repeat spam", () => {
  const store = createProjectileStore({
    speedCellsPerSecond: PROJECTILE_SPEED_CELLS_PER_SECOND,
    maxRangeCells: PROJECTILE_MAX_RANGE_CELLS,
    cooldownSeconds: FIRE_COOLDOWN_SECONDS
  });
  const spawnPoint = { x: 1.5, y: 1.5, direction: "right" };

  assert.equal(tryFireProjectile(store, spawnPoint), true);
  assert.equal(tryFireProjectile(store, spawnPoint), false);
  updateProjectileStore(store, FIRE_COOLDOWN_SECONDS - 0.01, () => false);
  assert.equal(tryFireProjectile(store, spawnPoint), false);
  updateProjectileStore(store, 0.01, () => false);
  assert.equal(tryFireProjectile(store, spawnPoint), true);

  assert.equal(store.projectiles.length, 2);
});

test("shooting does not affect movement progress or state", () => {
  const tank = createMovementState({
    gridX: 1,
    gridY: 1,
    facing: "right",
    speedCellsPerSecond: 2
  });
  const store = createProjectileStore();

  requestMove(tank, "right");
  updateMovement(tank, 0.25);
  const progress = tank.moveProgress;
  const isMoving = tank.isMoving;

  assert.equal(tryFireProjectile(store, spawnPointFromTank(tank)), true);

  assert.equal(tank.moveProgress, progress);
  assert.equal(tank.isMoving, isMoving);
  assert.equal(tank.gridX, 1);
  assert.equal(tank.gridY, 1);
});

test("shooting does not block turning", () => {
  const tank = createMovementState({
    gridX: 1,
    gridY: 1,
    facing: "right",
    speedCellsPerSecond: 2
  });
  const store = createProjectileStore();

  assert.equal(tryFireProjectile(store, spawnPointFromTank(tank)), true);
  assert.equal(requestMove(tank, "down"), false);

  assert.equal(tank.facing, "down");
  assert.equal(tank.isMoving, false);
  assert.equal(tank.gridX, 1);
  assert.equal(tank.gridY, 1);
});
