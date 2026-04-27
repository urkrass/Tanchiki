import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
  getPursuitVisualPosition,
  updateEnemyPursuit
} from "../src/game/pursuit.js";
import { createMovementState, requestMove, updateMovement } from "../src/game/movement.js";
import { createTarget } from "../src/game/targets.js";

test("pursuit advances one cell at a time toward the player", () => {
  const enemy = createPursuer({ gridX: 1, gridY: 1 });

  updateEnemyPursuit({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 1 },
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 2);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.isPursuing, false);
});

test("pursuit exposes interpolated visual position while moving", () => {
  const enemy = createPursuer({ gridX: 1, gridY: 1, pursuitSpeedCellsPerSecond: 2 });

  updateEnemyPursuit({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 1 },
    deltaSeconds: 0.25,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.isPursuing, true);
  assert.deepEqual(getPursuitVisualPosition(enemy), { x: 1.5, y: 1 });
});

test("pursuit routes around simple walls", () => {
  const enemy = createPursuer({ gridX: 1, gridY: 1 });
  const level = {
    width: 7,
    height: 5,
    tiles: [
      "#######",
      "#.#...#",
      "#.....#",
      "#.....#",
      "#######"
    ]
  };

  updateEnemyPursuit({
    level,
    entities: [enemy],
    player: { gridX: 5, gridY: 1 },
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 2);
});

test("pursuit does not move when no route is available", () => {
  const enemy = createPursuer({ gridX: 1, gridY: 1 });
  const level = {
    width: 7,
    height: 5,
    tiles: [
      "#######",
      "#.###.#",
      "#######",
      "#.....#",
      "#######"
    ]
  };

  updateEnemyPursuit({
    level,
    entities: [enemy],
    player: { gridX: 5, gridY: 1 },
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.isPursuing, false);
});

test("pursuit does not move through solid alive entities", () => {
  const enemy = createPursuer({ gridX: 1, gridY: 1 });
  const blocker = createTarget({ id: "blocker", gridX: 2, gridY: 1 });

  updateEnemyPursuit({
    level: openLevel(),
    entities: [enemy, blocker],
    player: { gridX: 5, gridY: 1 },
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 2);
});

test("pursuit does not enter player current or target cells", () => {
  const enemy = createPursuer({ gridX: 4, gridY: 1 });
  const player = { gridX: 2, gridY: 1, isMoving: true, toX: 3, toY: 1 };

  updateEnemyPursuit({
    level: openLevel(),
    entities: [enemy],
    player,
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.notDeepEqual({ x: enemy.gridX, y: enemy.gridY }, { x: player.gridX, y: player.gridY });
  assert.notDeepEqual({ x: enemy.gridX, y: enemy.gridY }, { x: player.toX, y: player.toY });
});

test("pursuit movement does not affect player movement timing", () => {
  const player = createMovementState({
    gridX: 1,
    gridY: 3,
    facing: "right",
    speedCellsPerSecond: 4
  });
  const enemy = createPursuer({ gridX: 5, gridY: 3 });

  requestMove(player, "right");
  updateMovement(player, 0.125);
  const playerProgress = player.moveProgress;

  updateEnemyPursuit({
    level: openLevel(),
    entities: [enemy],
    player,
    deltaSeconds: 1 / DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(player.moveProgress, playerProgress);
  assert.equal(player.gridX, 1);
  assert.equal(player.toX, 2);
});

function createPursuer(options) {
  return createTarget({
    id: "pursuer",
    pursuitTarget: "player",
    ...options
  });
}

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

function isBlockedCell(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return true;
  }
  return level.tiles[y][x] === "#";
}
