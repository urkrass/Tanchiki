import { DIRECTIONS } from "./movement.js";
import { entityOccupiesPursuitCell } from "./pursuit.js";
import { ENEMY_PATROL_SPEED_CELLS_PER_SECOND } from "./combatTuning.js";

const VALID_DIRECTIONS = Object.keys(DIRECTIONS);
const DEFAULT_PATROL_SPEED_CELLS_PER_SECOND = ENEMY_PATROL_SPEED_CELLS_PER_SECOND;

export function updateEnemyPatrols({
  level,
  entities,
  player,
  deltaSeconds,
  isBlockedCell
}) {
  for (const entity of entities) {
    if (!isPatrolEnemy(entity)) {
      continue;
    }

    if (!entity.isPatrolling) {
      startNextPatrolStep(entity, level, entities, player, isBlockedCell);
    }

    updatePatrolStep(entity, deltaSeconds);
  }
}

export function getPatrolVisualPosition(entity) {
  if (!entity.isPatrolling) {
    return { x: entity.gridX, y: entity.gridY };
  }

  return {
    x: lerp(entity.fromX, entity.toX, entity.patrolProgress),
    y: lerp(entity.fromY, entity.toY, entity.patrolProgress)
  };
}

export function isPatrolEnemy(entity) {
  return entity.alive
    && entity.team === "enemy"
    && entity.pursuitTarget !== "player"
    && Array.isArray(entity.patrolRoute)
    && entity.patrolRoute.length > 1;
}

function startNextPatrolStep(entity, level, entities, player, isBlockedCell) {
  const waypoint = entity.patrolRoute[entity.patrolTargetIndex ?? 1];
  const direction = directionToward(entity.gridX, entity.gridY, waypoint.x, waypoint.y);

  if (!direction) {
    advancePatrolTarget(entity);
    return;
  }

  const offset = DIRECTIONS[direction];
  const targetX = entity.gridX + offset.x;
  const targetY = entity.gridY + offset.y;

  if (!canEnterPatrolCell({
    level,
    entities,
    entity,
    player,
    x: targetX,
    y: targetY,
    isBlockedCell
  })) {
    entity.facing = direction;
    return;
  }

  entity.facing = direction;
  entity.fromX = entity.gridX;
  entity.fromY = entity.gridY;
  entity.toX = targetX;
  entity.toY = targetY;
  entity.patrolProgress = 0;
  entity.isPatrolling = true;
}

function updatePatrolStep(entity, deltaSeconds) {
  if (!entity.isPatrolling || deltaSeconds <= 0) {
    return;
  }

  const speed = entity.patrolSpeedCellsPerSecond ?? DEFAULT_PATROL_SPEED_CELLS_PER_SECOND;
  entity.patrolProgress = Math.min(1, entity.patrolProgress + deltaSeconds * speed);
  if (entity.patrolProgress < 1) {
    return;
  }

  entity.gridX = entity.toX;
  entity.gridY = entity.toY;
  entity.fromX = entity.gridX;
  entity.fromY = entity.gridY;
  entity.toX = entity.gridX;
  entity.toY = entity.gridY;
  entity.patrolProgress = 0;
  entity.isPatrolling = false;

  const waypoint = entity.patrolRoute[entity.patrolTargetIndex ?? 1];
  if (waypoint.x === entity.gridX && waypoint.y === entity.gridY) {
    advancePatrolTarget(entity);
  }
}

function canEnterPatrolCell({
  level,
  entities,
  entity,
  player,
  x,
  y,
  isBlockedCell
}) {
  if (isBlockedCell(level, x, y)) {
    return false;
  }

  if (playerOccupiesCell(player, x, y)) {
    return false;
  }

  return !entities.some((candidate) => (
    candidate !== entity
    && candidate.alive
    && candidate.solid
    && entityOccupiesCell(candidate, x, y)
  ));
}

function playerOccupiesCell(player, x, y) {
  if (!player) {
    return false;
  }

  return (player.gridX === x && player.gridY === y)
    || (player.isMoving && player.toX === x && player.toY === y);
}

export function entityOccupiesCell(entity, x, y) {
  return (entity.gridX === x && entity.gridY === y)
    || (entity.isPatrolling && entity.toX === x && entity.toY === y)
    || entityOccupiesPursuitCell(entity, x, y);
}

function advancePatrolTarget(entity) {
  const nextIndex = ((entity.patrolTargetIndex ?? 1) + 1) % entity.patrolRoute.length;
  entity.patrolTargetIndex = nextIndex;
}

function directionToward(fromX, fromY, toX, toY) {
  if (fromX < toX) {
    return "right";
  }
  if (fromX > toX) {
    return "left";
  }
  if (fromY < toY) {
    return "down";
  }
  if (fromY > toY) {
    return "up";
  }
  return null;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function validatePatrolRoute(level, entitySchema) {
  if (entitySchema.patrolRoute === undefined) {
    return;
  }

  if (!Array.isArray(entitySchema.patrolRoute) || entitySchema.patrolRoute.length < 2) {
    throw new Error(`Level schema entity ${entitySchema.id} patrolRoute must include at least two cells.`);
  }

  for (const cell of entitySchema.patrolRoute) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
      throw new Error(`Level schema entity ${entitySchema.id} patrolRoute cells must include integer x and y.`);
    }
    if (isOutOfBounds(level, cell.x, cell.y)) {
      throw new Error(`Level schema entity ${entitySchema.id} patrolRoute cell is outside level bounds.`);
    }
    if (isBlockedCell(level, cell.x, cell.y)) {
      throw new Error(`Level schema entity ${entitySchema.id} patrolRoute enters a wall at ${cell.x}, ${cell.y}.`);
    }
  }

  if (
    entitySchema.patrolRoute[0].x !== entitySchema.gridX
    || entitySchema.patrolRoute[0].y !== entitySchema.gridY
  ) {
    throw new Error(`Level schema entity ${entitySchema.id} patrolRoute must start at the entity cell.`);
  }

  for (let index = 0; index < entitySchema.patrolRoute.length; index += 1) {
    const current = entitySchema.patrolRoute[index];
    const next = entitySchema.patrolRoute[(index + 1) % entitySchema.patrolRoute.length];
    if (current.x !== next.x && current.y !== next.y) {
      throw new Error(`Level schema entity ${entitySchema.id} patrolRoute segments must be orthogonal.`);
    }
  }
}

function isBlockedCell(level, x, y) {
  return level.tiles[y][x] === "#";
}

function isOutOfBounds(level, x, y) {
  return x < 0 || y < 0 || x >= level.width || y >= level.height;
}

export { DEFAULT_PATROL_SPEED_CELLS_PER_SECOND };
