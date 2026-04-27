import test from "node:test";
import assert from "node:assert/strict";
import {
  createMovementState,
  getVisualPosition,
  requestMove,
  updateMovement
} from "../src/game/movement.js";
import {
  createTestLevel,
  isBlockedCell,
  validatePlayerSpawn
} from "../src/game/level.js";

test("moves between adjacent grid cells without changing logical position mid-step", () => {
  const tank = createMovementState({
    gridX: 2,
    gridY: 3,
    facing: "right",
    speedCellsPerSecond: 2
  });

  assert.equal(requestMove(tank, "right"), true);
  updateMovement(tank, 0.25);

  assert.equal(tank.gridX, 2);
  assert.equal(tank.gridY, 3);
  assert.equal(tank.isMoving, true);
  assert.deepEqual(getVisualPosition(tank), { x: 2.5, y: 3 });

  updateMovement(tank, 0.25);

  assert.equal(tank.gridX, 3);
  assert.equal(tank.gridY, 3);
  assert.equal(tank.isMoving, false);
  assert.deepEqual(getVisualPosition(tank), { x: 3, y: 3 });
});

test("repeated taps while moving do not increase movement progress", () => {
  const tank = createMovementState({
    gridX: 0,
    gridY: 0,
    facing: "right",
    speedCellsPerSecond: 1
  });

  requestMove(tank, "right");
  updateMovement(tank, 0.25);
  const progressAfterTime = tank.moveProgress;

  requestMove(tank, "right");
  requestMove(tank, "right");
  requestMove(tank, "right");

  assert.equal(tank.moveProgress, progressAfterTime);
  assert.equal(tank.gridX, 0);
});

test("visual interpolation is linear for constant rendered speed", () => {
  const tank = createMovementState({
    gridX: 0,
    gridY: 0,
    facing: "right",
    speedCellsPerSecond: 1
  });

  requestMove(tank, "right");
  updateMovement(tank, 0.25);

  assert.deepEqual(getVisualPosition(tank), { x: 0.25, y: 0 });
});

test("buffered direction applies only after reaching the next grid cell", () => {
  const tank = createMovementState({
    gridX: 0,
    gridY: 0,
    facing: "right",
    speedCellsPerSecond: 1
  });

  requestMove(tank, "right");
  requestMove(tank, "down");
  updateMovement(tank, 0.5);

  assert.equal(tank.facing, "right");
  assert.equal(tank.gridX, 0);
  assert.equal(tank.gridY, 0);
  assert.deepEqual(getVisualPosition(tank), { x: 0.5, y: 0 });

  updateMovement(tank, 0.5);

  assert.equal(tank.facing, "down");
  assert.equal(tank.gridX, 1);
  assert.equal(tank.gridY, 0);
  assert.equal(tank.isMoving, false);
  assert.deepEqual(getVisualPosition(tank), { x: 1, y: 0 });
});

test("stationary direction change turns without sideways drift", () => {
  const tank = createMovementState({
    gridX: 4,
    gridY: 4,
    facing: "up",
    speedCellsPerSecond: 3
  });

  assert.equal(requestMove(tank, "left"), false);

  assert.equal(tank.facing, "left");
  assert.equal(tank.isMoving, false);
  assert.equal(tank.gridX, 4);
  assert.equal(tank.gridY, 4);
  assert.deepEqual(getVisualPosition(tank), { x: 4, y: 4 });
});

test("blocked target cells do not start movement", () => {
  const tank = createMovementState({
    gridX: 1,
    gridY: 1,
    facing: "up",
    speedCellsPerSecond: 3
  });

  const canEnter = (x, y) => !(x === 1 && y === 0);

  assert.equal(requestMove(tank, "up", canEnter), false);
  assert.equal(tank.isMoving, false);
  assert.equal(tank.gridX, 1);
  assert.equal(tank.gridY, 1);
});

test("shooting-style callbacks are independent from movement updates", () => {
  const tank = createMovementState({
    gridX: 0,
    gridY: 0,
    facing: "right",
    speedCellsPerSecond: 2
  });
  let shots = 0;
  const shoot = () => {
    shots += 1;
  };

  requestMove(tank, "right");
  shoot();
  updateMovement(tank, 0.25);
  shoot();

  assert.equal(shots, 2);
  assert.equal(tank.isMoving, true);
  assert.deepEqual(getVisualPosition(tank), { x: 0.5, y: 0 });
});

test("test level has a valid player spawn and blocked outer walls", () => {
  const level = createTestLevel();

  assert.equal(level.width, 15);
  assert.equal(level.height, 11);
  assert.doesNotThrow(() => validatePlayerSpawn(level));
  assert.equal(isBlockedCell(level, 0, 0), true);
  assert.equal(isBlockedCell(level, level.playerSpawn.x, level.playerSpawn.y), false);
});
