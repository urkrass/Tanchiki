import { DIRECTIONS } from "./movement.js";
import { findGridPath } from "./pathfinding.js";
import { ENEMY_PURSUIT_SPEED_CELLS_PER_SECOND } from "./combatTuning.js";

const DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND = ENEMY_PURSUIT_SPEED_CELLS_PER_SECOND;
const PURSUIT_GOAL_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

export function updateEnemyPursuit({
  level,
  entities,
  player,
  deltaSeconds,
  isBlockedCell
}) {
  for (const entity of entities) {
    if (!isPursuitEnemy(entity)) {
      continue;
    }

    if (!entity.isPursuing) {
      startNextPursuitStep(entity, level, entities, player, isBlockedCell);
    }

    updatePursuitStep(entity, deltaSeconds);
  }
}

export function getPursuitVisualPosition(entity) {
  if (!entity.isPursuing) {
    return { x: entity.gridX, y: entity.gridY };
  }

  return {
    x: lerp(entity.fromX, entity.toX, entity.pursuitProgress),
    y: lerp(entity.fromY, entity.toY, entity.pursuitProgress)
  };
}

export function isPursuitEnemy(entity) {
  return entity.alive
    && entity.team === "enemy"
    && entity.pursuitTarget === "player";
}

export function entityOccupiesPursuitCell(entity, x, y) {
  return entity.isPursuing && entity.toX === x && entity.toY === y;
}

function startNextPursuitStep(entity, level, entities, player, isBlockedCell) {
  const nextCell = findNextPursuitCell({
    level,
    entities,
    entity,
    player,
    isBlockedCell
  });

  if (!nextCell) {
    facePlayer(entity, player);
    return;
  }

  const direction = directionToward(entity.gridX, entity.gridY, nextCell.x, nextCell.y);
  if (!direction) {
    return;
  }

  entity.facing = direction;
  entity.fromX = entity.gridX;
  entity.fromY = entity.gridY;
  entity.toX = nextCell.x;
  entity.toY = nextCell.y;
  entity.pursuitProgress = 0;
  entity.isPursuing = true;
}

function findNextPursuitCell({
  level,
  entities,
  entity,
  player,
  isBlockedCell
}) {
  if (!player) {
    return null;
  }

  const goals = pursuitGoalCells(player)
    .filter((cell) => canEnterPursuitCell({
      level,
      entities,
      entity,
      player,
      x: cell.x,
      y: cell.y,
      isBlockedCell
    }));

  if (goals.length === 0) {
    return null;
  }

  const goalKeys = new Set(goals.map((cell) => cellKey(cell.x, cell.y)));
  const path = findGridPath({
    start: { x: entity.gridX, y: entity.gridY },
    isGoal: (x, y) => goalKeys.has(cellKey(x, y)),
    canEnterCell: (x, y) => canEnterPursuitCell({
      level,
      entities,
      entity,
      player,
      x,
      y,
      isBlockedCell
    })
  });

  return path.length > 1 ? path[1] : null;
}

function updatePursuitStep(entity, deltaSeconds) {
  if (!entity.isPursuing || deltaSeconds <= 0) {
    return;
  }

  const speed = entity.pursuitSpeedCellsPerSecond ?? DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND;
  entity.pursuitProgress = Math.min(1, entity.pursuitProgress + deltaSeconds * speed);
  if (entity.pursuitProgress < 1) {
    return;
  }

  entity.gridX = entity.toX;
  entity.gridY = entity.toY;
  entity.fromX = entity.gridX;
  entity.fromY = entity.gridY;
  entity.toX = entity.gridX;
  entity.toY = entity.gridY;
  entity.pursuitProgress = 0;
  entity.isPursuing = false;
}

function canEnterPursuitCell({
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

function pursuitGoalCells(player) {
  return PURSUIT_GOAL_OFFSETS.map((offset) => ({
    x: player.gridX + offset.x,
    y: player.gridY + offset.y
  }));
}

function playerOccupiesCell(player, x, y) {
  if (!player) {
    return false;
  }

  return (player.gridX === x && player.gridY === y)
    || (player.isMoving && player.toX === x && player.toY === y);
}

function entityOccupiesCell(entity, x, y) {
  return (entity.gridX === x && entity.gridY === y)
    || (entity.isPatrolling && entity.toX === x && entity.toY === y)
    || entityOccupiesPursuitCell(entity, x, y);
}

function facePlayer(entity, player) {
  const direction = directionToward(entity.gridX, entity.gridY, player.gridX, player.gridY);
  if (direction) {
    entity.facing = direction;
  }
}

function directionToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) {
      return "right";
    }
    if (dx < 0) {
      return "left";
    }
  }

  if (dy > 0) {
    return "down";
  }
  if (dy < 0) {
    return "up";
  }

  return null;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

export { DEFAULT_PURSUIT_SPEED_CELLS_PER_SECOND };

