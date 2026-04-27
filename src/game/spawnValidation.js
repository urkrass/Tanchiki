import { hasLineOfSight } from "./sentries.js";
import { isSolidEntityAt } from "./targets.js";

const adjacentOffsets = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function validateMissionSpawn(level, spawn, entities, isBlockedCell) {
  if (isBlockedCell(level, spawn.x, spawn.y)) {
    throw new Error(`Invalid player spawn inside wall at ${spawn.x}, ${spawn.y}`);
  }

  if (isSolidEntityAt(entities, spawn.x, spawn.y)) {
    throw new Error(`Invalid player spawn inside entity at ${spawn.x}, ${spawn.y}`);
  }

  for (const entity of entities) {
    if (!isEnemySentry(entity)) {
      continue;
    }
    const blockers = entities.filter((candidate) => candidate.id !== entity.id);
    if (hasLineOfSight(level, entity.gridX, entity.gridY, spawn.x, spawn.y, blockers)) {
      throw new Error(`Invalid player spawn in enemy line of sight from ${entity.id}`);
    }
  }

  const hasExit = adjacentOffsets.some((offset) => {
    const x = spawn.x + offset.x;
    const y = spawn.y + offset.y;
    return !isBlockedCell(level, x, y) && !isSolidEntityAt(entities, x, y);
  });

  if (!hasExit) {
    throw new Error(`Invalid player spawn has no legal adjacent move at ${spawn.x}, ${spawn.y}`);
  }
}

function isEnemySentry(entity) {
  return entity.alive
    && entity.team === "enemy"
    && (entity.type === "dummy" || entity.type === "turret");
}
