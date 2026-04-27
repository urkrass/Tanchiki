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
  fireCooldownSeconds = 1.2,
  fireCooldownRemaining = 0,
  windupSeconds = 0.45,
  aimDirection = null,
  aimRemainingSeconds = 0
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
    fireCooldownSeconds,
    fireCooldownRemaining,
    windupSeconds,
    aimDirection,
    aimRemainingSeconds,
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

export function createTestTargets() {
  return [
    createTarget({ id: "dummy-1", gridX: 4, gridY: 3 }),
    createTarget({ id: "dummy-2", gridX: 8, gridY: 3 }),
    createTarget({ id: "dummy-3", gridX: 10, gridY: 9 }),
    createBase({ id: "enemy-base", gridX: 12, gridY: 9 })
  ];
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
    && entity.gridX === x
    && entity.gridY === y
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
