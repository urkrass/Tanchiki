import { loadLevelSchema } from "./levelLoader.js";
import { TEST_MISSION_SCHEMA } from "./levels/testMission.js";

export function createTestMission() {
  return loadLevelSchema(TEST_MISSION_SCHEMA);
}

export function createTestLevel() {
  return createTestMission().level;
}

export function isBlockedCell(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return true;
  }

  return level.tiles[y][x] === "#";
}

export function validatePlayerSpawn(level) {
  const { x, y } = level.playerSpawn;

  if (isBlockedCell(level, x, y)) {
    throw new Error(`Invalid player spawn at ${x}, ${y}`);
  }
}
