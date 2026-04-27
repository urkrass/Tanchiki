import { createEntityFromSchema } from "./targets.js";
import { validatePatrolRoute } from "./patrols.js";

export function loadLevelSchema(schema) {
  validateSchemaObject(schema);
  const tiles = normalizeTiles(schema);
  const width = schema.width ?? tiles[0].length;
  const height = schema.height ?? tiles.length;

  validateDimensions({ width, height, tiles });
  const playerSpawn = normalizeSpawn(schema.playerSpawn ?? findPlayerSpawn(tiles));
  const level = {
    id: schema.id,
    width,
    height,
    tiles,
    playerSpawn
  };

  validateSpawnCell(level, playerSpawn);

  const targets = (schema.entities ?? []).map((entitySchema) => {
    validateEntitySchema(level, entitySchema);
    validatePatrolRoute(level, entitySchema);
    return createEntityFromSchema(entitySchema);
  });

  return { level, targets };
}

function validateSchemaObject(schema) {
  if (!schema || typeof schema !== "object") {
    throw new Error("Level schema must be an object.");
  }
}

function normalizeTiles(schema) {
  if (!Array.isArray(schema.tiles) || schema.tiles.length === 0) {
    throw new Error("Level schema must include non-empty tiles.");
  }

  return schema.tiles.map((row) => {
    if (typeof row !== "string" || row.length === 0) {
      throw new Error("Level schema tiles must be non-empty strings.");
    }
    return row;
  });
}

function validateDimensions({ width, height, tiles }) {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error("Level schema width must be a positive integer.");
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error("Level schema height must be a positive integer.");
  }
  if (tiles.length !== height) {
    throw new Error(`Level schema height ${height} does not match ${tiles.length} tile rows.`);
  }

  for (const row of tiles) {
    if (row.length !== width) {
      throw new Error("Level schema tile rows must all match width.");
    }
  }
}

function normalizeSpawn(spawn) {
  if (!spawn || !Number.isInteger(spawn.x) || !Number.isInteger(spawn.y)) {
    throw new Error("Level schema playerSpawn must include integer x and y.");
  }

  return { x: spawn.x, y: spawn.y };
}

function validateSpawnCell(level, spawn) {
  if (isWall(level, spawn.x, spawn.y)) {
    throw new Error(`Level schema player spawn is inside a wall at ${spawn.x}, ${spawn.y}.`);
  }
}

function validateEntitySchema(level, entitySchema) {
  if (!entitySchema || typeof entitySchema !== "object") {
    throw new Error("Level schema entity must be an object.");
  }
  if (!entitySchema.id) {
    throw new Error("Level schema entity must include an id.");
  }
  if (!Number.isInteger(entitySchema.gridX) || !Number.isInteger(entitySchema.gridY)) {
    throw new Error(`Level schema entity ${entitySchema.id} must include integer gridX and gridY.`);
  }
  if (isOutOfBounds(level, entitySchema.gridX, entitySchema.gridY)) {
    throw new Error(`Level schema entity ${entitySchema.id} is outside level bounds.`);
  }
}

function findPlayerSpawn(tiles) {
  for (let y = 0; y < tiles.length; y += 1) {
    const x = tiles[y].indexOf("P");
    if (x !== -1) {
      return { x, y };
    }
  }

  throw new Error("Level schema must include playerSpawn or a P tile.");
}

function isWall(level, x, y) {
  if (isOutOfBounds(level, x, y)) {
    return true;
  }

  return level.tiles[y][x] === "#";
}

function isOutOfBounds(level, x, y) {
  return x < 0 || y < 0 || x >= level.width || y >= level.height;
}
