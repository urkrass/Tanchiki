import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaignMission,
  getCampaignLevelCount,
  isBlockedCell
} from "../src/game/level.js";
import { findPathToCell } from "../src/game/pathfinding.js";

test("campaign enemy bases are reachable from player spawn", () => {
  forEachCampaignMission((mission) => {
    const enemyBase = mission.targets.find(isLiveEnemyBase);
    const path = findPathToCell({
      start: mission.level.playerSpawn,
      goal: { x: enemyBase.gridX, y: enemyBase.gridY },
      canEnterCell: (x, y) => canReachCell(mission, enemyBase, x, y)
    });

    assert.ok(
      path.length > 1,
      `${mission.level.id} enemy base ${enemyBase.id} must be reachable from player spawn`
    );
  });
});

test("campaign pickups stay off spawn, walls, and solid enemies", () => {
  forEachCampaignMission((mission) => {
    const solidEnemyCells = new Set(
      mission.targets
        .filter((target) => target.alive && target.solid)
        .map((target) => cellKey(target.gridX, target.gridY))
    );

    for (const pickup of mission.pickups) {
      assert.notEqual(
        cellKey(pickup.gridX, pickup.gridY),
        cellKey(mission.level.playerSpawn.x, mission.level.playerSpawn.y),
        `${mission.level.id} pickup ${pickup.id} overlaps player spawn`
      );
      assert.equal(
        isBlockedCell(mission.level, pickup.gridX, pickup.gridY),
        false,
        `${mission.level.id} pickup ${pickup.id} is inside a wall`
      );
      assert.equal(
        solidEnemyCells.has(cellKey(pickup.gridX, pickup.gridY)),
        false,
        `${mission.level.id} pickup ${pickup.id} overlaps a solid enemy`
      );
    }
  });
});

test("campaign patrol routes stay on valid orthogonal walkable cells", () => {
  forEachCampaignMission((mission) => {
    const patrols = mission.targets.filter((target) => Array.isArray(target.patrolRoute));

    for (const patrol of patrols) {
      assert.ok(
        patrol.patrolRoute.length > 1,
        `${mission.level.id} patrol ${patrol.id} must include at least two cells`
      );
      assert.deepEqual(
        patrol.patrolRoute[0],
        { x: patrol.gridX, y: patrol.gridY },
        `${mission.level.id} patrol ${patrol.id} route must start at the enemy cell`
      );

      for (let index = 0; index < patrol.patrolRoute.length; index += 1) {
        const current = patrol.patrolRoute[index];
        const next = patrol.patrolRoute[(index + 1) % patrol.patrolRoute.length];

        assert.equal(
          isBlockedCell(mission.level, current.x, current.y),
          false,
          `${mission.level.id} patrol ${patrol.id} route enters a wall at ${current.x},${current.y}`
        );
        assert.equal(
          manhattanDistance(current, next),
          1,
          `${mission.level.id} patrol ${patrol.id} route has a non-orthogonal segment at index ${index}`
        );
      }
    }
  });
});

test("campaign pursuit enemies do not start in immediate player pressure range", () => {
  forEachCampaignMission((mission) => {
    const pursuitEnemies = mission.targets.filter((target) => target.pursuitTarget === "player");

    for (const enemy of pursuitEnemies) {
      assert.ok(
        manhattanDistance(mission.level.playerSpawn, { x: enemy.gridX, y: enemy.gridY }) >= 4,
        `${mission.level.id} pursuit enemy ${enemy.id} starts too close to player spawn`
      );
    }
  });
});

function forEachCampaignMission(callback) {
  for (let index = 0; index < getCampaignLevelCount(); index += 1) {
    callback(createCampaignMission(index));
  }
}

function canReachCell(mission, goalTarget, x, y) {
  if (isBlockedCell(mission.level, x, y)) {
    return false;
  }

  return !mission.targets.some((target) => (
    target !== goalTarget
    && target.alive
    && target.solid
    && target.gridX === x
    && target.gridY === y
  ));
}

function isLiveEnemyBase(target) {
  return target.type === "base" && target.team === "enemy" && target.alive;
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function cellKey(x, y) {
  return `${x},${y}`;
}
