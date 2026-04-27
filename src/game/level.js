import { loadLevelSchema } from "./levelLoader.js";
import { CAMPAIGN_LEVEL_SCHEMAS } from "./levels/testMission.js";
import { validateMissionSpawn } from "./spawnValidation.js";

export function createTestMission() {
  return createCampaignMission(0);
}

export function createTestLevel() {
  return createTestMission().level;
}

export function getCampaignLevelCount() {
  return CAMPAIGN_LEVEL_SCHEMAS.length;
}

export function createCampaignMission(levelIndex = 0) {
  const schema = CAMPAIGN_LEVEL_SCHEMAS[levelIndex];
  if (!schema) {
    throw new Error(`Unknown campaign level index ${levelIndex}.`);
  }

  const mission = loadLevelSchema(schema);
  validateMission(mission, levelIndex);
  return mission;
}

export function validateCampaignMissions() {
  for (let index = 0; index < CAMPAIGN_LEVEL_SCHEMAS.length; index += 1) {
    createCampaignMission(index);
  }
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

function validateMission({ level, targets }, levelIndex) {
  validatePlayerSpawn(level);
  validateMissionSpawn(level, level.playerSpawn, targets, isBlockedCell);

  const enemyBase = targets.find((target) => (
    target.type === "base"
    && target.team === "enemy"
    && target.alive
  ));

  if (!enemyBase) {
    throw new Error(`Campaign level ${levelIndex + 1} must include a live enemy base.`);
  }
}
