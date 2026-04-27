import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PATROL_SPEED_CELLS_PER_SECOND,
  getPatrolVisualPosition,
  updateEnemyPatrols
} from "../src/game/patrols.js";
import { createMovementState, requestMove, updateMovement } from "../src/game/movement.js";
import { createTarget } from "../src/game/targets.js";

test("enemy follows a patrol route cell-by-cell without skipping cells", () => {
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 3, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 2
  });

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 3 },
    deltaSeconds: 0.5,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 2);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.patrolTargetIndex, 1);

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 3 },
    deltaSeconds: 0.5,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 3);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.patrolTargetIndex, 0);
});

test("enemy patrol exposes interpolated visual position while moving", () => {
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 2
  });

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 3 },
    deltaSeconds: 0.25,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.isPatrolling, true);
  assert.deepEqual(getPatrolVisualPosition(enemy), { x: 1.5, y: 1 });
});

test("enemy patrol does not enter walls", () => {
  const level = openLevel();
  level.tiles[1] = "#.#...#";
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 3, y: 1 }
    ]
  });

  updateEnemyPatrols({
    level,
    entities: [enemy],
    player: { gridX: 5, gridY: 3 },
    deltaSeconds: 1 / DEFAULT_PATROL_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.isPatrolling, false);
});

test("enemy patrol does not enter solid entity cells", () => {
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 3, y: 1 }
    ]
  });
  const blocker = createTarget({ id: "blocker", gridX: 2, gridY: 1 });

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy, blocker],
    player: { gridX: 5, gridY: 3 },
    deltaSeconds: 1 / DEFAULT_PATROL_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.isPatrolling, false);
});

test("enemy patrol does not enter player current or target cells", () => {
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 3, y: 1 }
    ]
  });

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy],
    player: { gridX: 5, gridY: 3, isMoving: true, toX: 2, toY: 1 },
    deltaSeconds: 1 / DEFAULT_PATROL_SPEED_CELLS_PER_SECOND,
    isBlockedCell
  });

  assert.equal(enemy.gridX, 1);
  assert.equal(enemy.gridY, 1);
  assert.equal(enemy.isPatrolling, false);
});

test("enemy movement does not affect player movement timing", () => {
  const player = createMovementState({
    gridX: 1,
    gridY: 3,
    facing: "right",
    speedCellsPerSecond: 4
  });
  const enemy = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 3, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 2
  });

  requestMove(player, "right");
  updateMovement(player, 0.125);
  const playerProgress = player.moveProgress;

  updateEnemyPatrols({
    level: openLevel(),
    entities: [enemy],
    player,
    deltaSeconds: 0.25,
    isBlockedCell
  });

  assert.equal(player.moveProgress, playerProgress);
  assert.equal(player.gridX, 1);
  assert.equal(player.toX, 2);
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

function isBlockedCell(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return true;
  }
  return level.tiles[y][x] === "#";
}
