import { DIRECTIONS } from "./movement.js";

export const PROJECTILE_SPEED_CELLS_PER_SECOND = 6;
export const PROJECTILE_MAX_RANGE_CELLS = 5;
export const FIRE_COOLDOWN_SECONDS = 0.4;

const muzzleOffsetCells = 0.62;

export function createProjectileStore({
  speedCellsPerSecond = PROJECTILE_SPEED_CELLS_PER_SECOND,
  maxRangeCells = PROJECTILE_MAX_RANGE_CELLS,
  cooldownSeconds = FIRE_COOLDOWN_SECONDS,
  team = "player"
} = {}) {
  return {
    projectiles: [],
    impacts: [],
    cooldownRemaining: 0,
    speedCellsPerSecond,
    maxRangeCells,
    cooldownSeconds,
    team
  };
}

export function spawnPointFromTank(player) {
  const offset = DIRECTIONS[player.facing];
  const visual = player.visual || { x: player.gridX, y: player.gridY };

  return {
    x: visual.x + 0.5 + offset.x * muzzleOffsetCells,
    y: visual.y + 0.5 + offset.y * muzzleOffsetCells,
    direction: player.facing
  };
}

export function tryFireProjectile(store, spawnPoint) {
  if (store.cooldownRemaining > 0) {
    return false;
  }

  store.projectiles.push(createProjectile({
    x: spawnPoint.x,
    y: spawnPoint.y,
    direction: spawnPoint.direction,
    speedCellsPerSecond: store.speedCellsPerSecond,
    maxRangeCells: store.maxRangeCells,
    team: store.team
  }));
  store.cooldownRemaining = store.cooldownSeconds;
  return true;
}

export function createProjectile({
  x,
  y,
  direction,
  speedCellsPerSecond = PROJECTILE_SPEED_CELLS_PER_SECOND,
  maxRangeCells = PROJECTILE_MAX_RANGE_CELLS,
  team = "player"
}) {
  if (!DIRECTIONS[direction]) {
    throw new Error(`Invalid projectile direction: ${direction}`);
  }

  return {
    x,
    y,
    startX: x,
    startY: y,
    direction,
    team,
    speedCellsPerSecond,
    maxRangeCells,
    distanceTraveled: 0,
    active: true
  };
}

export function updateProjectileStore(store, deltaSeconds, isBlockedCell, hitEntityOnSegment = null) {
  store.cooldownRemaining = Math.max(0, store.cooldownRemaining - deltaSeconds);
  if (store.cooldownRemaining < 0.000001) {
    store.cooldownRemaining = 0;
  }
  updateProjectiles(
    store.projectiles,
    deltaSeconds,
    isBlockedCell,
    store.impacts,
    hitEntityOnSegment
  );
  updateImpacts(store.impacts, deltaSeconds);
}

export function updateProjectiles(
  projectiles,
  deltaSeconds,
  isBlockedCell,
  impacts = [],
  hitEntityOnSegment = null
) {
  for (const projectile of projectiles) {
    updateProjectile(projectile, deltaSeconds, isBlockedCell, impacts, hitEntityOnSegment);
  }
}

export function updateProjectile(
  projectile,
  deltaSeconds,
  isBlockedCell,
  impacts = [],
  hitEntityOnSegment = null
) {
  if (!projectile.active || deltaSeconds <= 0) {
    return;
  }

  const offset = DIRECTIONS[projectile.direction];
  const distance = projectile.speedCellsPerSecond * deltaSeconds;
  const nextX = projectile.x + offset.x * distance;
  const nextY = projectile.y + offset.y * distance;

  const entityHit = hitEntityOnSegment?.(projectile.x, projectile.y, nextX, nextY, projectile);
  if (entityHit) {
    projectile.active = false;
    impacts.push(createImpact(entityHit.x ?? projectile.x, entityHit.y ?? projectile.y));
    return;
  }

  if (isBlockedCell(Math.floor(nextX), Math.floor(nextY))) {
    projectile.active = false;
    impacts.push(createImpact(projectile.x, projectile.y));
    return;
  }

  projectile.x = nextX;
  projectile.y = nextY;
  projectile.distanceTraveled += distance;

  if (projectile.distanceTraveled >= projectile.maxRangeCells) {
    projectile.active = false;
  }
}

function createImpact(x, y) {
  return {
    x,
    y,
    ageSeconds: 0,
    durationSeconds: 0.16,
    active: true
  };
}

function updateImpacts(impacts, deltaSeconds) {
  for (const impact of impacts) {
    if (!impact.active) {
      continue;
    }

    impact.ageSeconds += deltaSeconds;
    if (impact.ageSeconds >= impact.durationSeconds) {
      impact.active = false;
    }
  }
}
