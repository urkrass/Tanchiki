import { createProjectile } from "./projectiles.js";
import {
  ENEMY_FIRE_COOLDOWN_SECONDS,
  ENEMY_FIRE_WINDUP_SECONDS,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
  PLAYER_INVULNERABILITY_SECONDS,
  PLAYER_MAX_HP
} from "./combatTuning.js";

export {
  ENEMY_FIRE_COOLDOWN_SECONDS,
  ENEMY_FIRE_WINDUP_SECONDS,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
  PLAYER_INVULNERABILITY_SECONDS,
  PLAYER_MAX_HP
};

export function hasLineOfSight(level, fromX, fromY, toX, toY, solidEntities = []) {
  if (fromX !== toX && fromY !== toY) {
    return false;
  }

  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let x = fromX + stepX;
  let y = fromY + stepY;

  while (x !== toX || y !== toY) {
    if (isWall(level, x, y) || isSolidEntity(solidEntities, x, y)) {
      return false;
    }
    x += stepX;
    y += stepY;
  }

  return true;
}

export function directionToTarget(fromX, fromY, toX, toY) {
  if (fromX === toX && toY < fromY) {
    return "up";
  }
  if (fromX === toX && toY > fromY) {
    return "down";
  }
  if (fromY === toY && toX < fromX) {
    return "left";
  }
  if (fromY === toY && toX > fromX) {
    return "right";
  }
  return null;
}

export function updateEnemySentries({
  level,
  entities,
  player,
  projectileStore,
  deltaSeconds
}) {
  for (const entity of entities) {
    if (!isEnemySentry(entity)) {
      continue;
    }

    entity.fireCooldownRemaining = Math.max(
      0,
      (entity.fireCooldownRemaining ?? 0) - deltaSeconds
    );

    const direction = directionToTarget(entity.gridX, entity.gridY, player.gridX, player.gridY);
    const blockers = entities.filter((candidate) => candidate.id !== entity.id);
    const hasSight = direction
      && hasLineOfSight(level, entity.gridX, entity.gridY, player.gridX, player.gridY, blockers);

    if (!hasSight || entity.fireCooldownRemaining > 0) {
      resetAim(entity);
      continue;
    }

    if (entity.aimDirection !== direction || (entity.aimRemainingSeconds ?? 0) <= 0) {
      entity.aimDirection = direction;
      entity.aimRemainingSeconds = entity.windupSeconds ?? ENEMY_FIRE_WINDUP_SECONDS;
      continue;
    }

    entity.aimRemainingSeconds = Math.max(0, entity.aimRemainingSeconds - deltaSeconds);
    if (entity.aimRemainingSeconds > 0) {
      continue;
    }

    projectileStore.projectiles.push(createProjectile({
      ...projectileSpawnFromEntity(entity, direction),
      speedCellsPerSecond: ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
      maxRangeCells: 8,
      team: entity.team
    }));
    entity.fireCooldownRemaining = entity.fireCooldownSeconds ?? ENEMY_FIRE_COOLDOWN_SECONDS;
    resetAim(entity);
  }
}

function resetAim(entity) {
  entity.aimDirection = null;
  entity.aimRemainingSeconds = 0;
}

function projectileSpawnFromEntity(entity, direction) {
  const offset = {
    up: { x: 0, y: -0.62 },
    right: { x: 0.62, y: 0 },
    down: { x: 0, y: 0.62 },
    left: { x: -0.62, y: 0 }
  }[direction];

  return {
    x: entity.gridX + 0.5 + offset.x,
    y: entity.gridY + 0.5 + offset.y,
    direction
  };
}

function isEnemySentry(entity) {
  return entity.alive
    && entity.team === "enemy"
    && (entity.type === "dummy" || entity.type === "turret");
}

function isWall(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return true;
  }
  return level.tiles[y][x] === "#";
}

function isSolidEntity(entities, x, y) {
  return entities.some((entity) => (
    entity.alive
    && entity.solid
    && entity.gridX === x
    && entity.gridY === y
  ));
}
