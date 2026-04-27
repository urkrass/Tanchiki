import {
  ENEMY_FIRE_COOLDOWN_SECONDS,
  ENEMY_FIRE_WINDUP_SECONDS
} from "./combatTuning.js";
import { TEST_MISSION_SCHEMA } from "./levels/testMission.js";

export const TARGET_MAX_HP = 2;
export const ENEMY_BASE_HP = 6;
export const PROJECTILE_DAMAGE = 1;

export function createEntity({
  id,
  gridX,
  gridY,
  hp,
  team = "enemy",
  type = "dummy",
  solid = true,
  facing = "up",
  fireCooldownSeconds = ENEMY_FIRE_COOLDOWN_SECONDS,
  fireCooldownRemaining = 0,
  windupSeconds = ENEMY_FIRE_WINDUP_SECONDS,
  aimDirection = null,
  aimRemainingSeconds = 0,
  patrolRoute = null,
  patrolSpeedCellsPerSecond,
  patrolTargetIndex = 1,
  isPatrolling = false,
  fromX = gridX,
  fromY = gridY,
  toX = gridX,
  toY = gridY,
  patrolProgress = 0
}) {
  return {
    id,
    gridX,
    gridY,
    hp,
    maxHp: hp,
    team,
    type,
    solid,
    facing,
    fireCooldownSeconds,
    fireCooldownRemaining,
    windupSeconds,
    aimDirection,
    aimRemainingSeconds,
    patrolRoute: patrolRoute ? patrolRoute.map((cell) => ({ x: cell.x, y: cell.y })) : null,
    patrolSpeedCellsPerSecond,
    patrolTargetIndex,
    isPatrolling,
    fromX,
    fromY,
    toX,
    toY,
    patrolProgress,
    alive: true,
    destroyed: false
  };
}

export function createTarget(options) {
  return createEntity({
    hp: TARGET_MAX_HP,
    type: "dummy",
    team: "enemy",
    ...options
  });
}

export function createBase(options) {
  return createEntity({
    hp: ENEMY_BASE_HP,
    type: "base",
    team: "enemy",
    ...options
  });
}

export function createEntityFromSchema(entitySchema) {
  return createEntity({
    hp: entitySchema.type === "base" ? ENEMY_BASE_HP : TARGET_MAX_HP,
    team: "enemy",
    type: "dummy",
    solid: true,
    ...entitySchema
  });
}

export function createTestTargets() {
  return TEST_MISSION_SCHEMA.entities.map(createEntityFromSchema);
}

export function findTargetHitOnSegment(targets, fromX, fromY, toX, toY, projectileTeam = "player") {
  let closest = null;

  for (const target of targets) {
    if (!target.alive || target.team === projectileTeam) {
      continue;
    }

    const distance = segmentDistanceToTargetCell(fromX, fromY, toX, toY, target);
    if (distance === null) {
      continue;
    }

    if (!closest || distance < closest.distance) {
      closest = { target, distance };
    }
  }

  return closest?.target || null;
}

export function damageTarget(target, damage = PROJECTILE_DAMAGE) {
  if (!target.alive) {
    return false;
  }

  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) {
    target.alive = false;
    target.destroyed = true;
  }

  return true;
}

export function isSolidEntityAt(entities, x, y) {
  return entities.some((entity) => (
    entity.alive
    && entity.solid
    && (
      (entity.gridX === x && entity.gridY === y)
      || (entity.isPatrolling && entity.toX === x && entity.toY === y)
    )
  ));
}

export function isEnemyBaseDestroyed(entities) {
  return entities.some((entity) => (
    entity.type === "base"
    && entity.team === "enemy"
    && entity.destroyed
  ));
}

function segmentDistanceToTargetCell(fromX, fromY, toX, toY, target) {
  const minX = target.gridX;
  const maxX = target.gridX + 1;
  const minY = target.gridY;
  const maxY = target.gridY + 1;

  if (fromY === toY && fromY >= minY && fromY < maxY) {
    if (toX > fromX && fromX < maxX && toX >= minX) {
      return Math.max(0, minX - fromX);
    }
    if (toX < fromX && fromX >= minX && toX < maxX) {
      return Math.max(0, fromX - maxX);
    }
  }

  if (fromX === toX && fromX >= minX && fromX < maxX) {
    if (toY > fromY && fromY < maxY && toY >= minY) {
      return Math.max(0, minY - fromY);
    }
    if (toY < fromY && fromY >= minY && toY < maxY) {
      return Math.max(0, fromY - maxY);
    }
  }

  return null;
}
