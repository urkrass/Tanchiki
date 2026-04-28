export const UPGRADE_EFFECT_KEYS = Object.freeze([
  "maxHp",
  "repairAmount",
  "fireCooldownSeconds",
  "projectileMaxRangeCells",
  "shieldCapacity"
]);

export const UPGRADE_CATALOG = Object.freeze([
  createUpgradeDefinition({
    id: "armor",
    label: "Reinforced armor",
    description: "Increase max armor by 1 per rank.",
    maxRank: 2,
    effects: [
      { key: "maxHp", amount: 1 }
    ]
  }),
  createUpgradeDefinition({
    id: "repair",
    label: "Field repairs",
    description: "Repair pickups restore 1 extra armor per rank.",
    maxRank: 2,
    effects: [
      { key: "repairAmount", amount: 1 }
    ]
  }),
  createUpgradeDefinition({
    id: "reload",
    label: "Faster reload",
    description: "Reduce shell cooldown by 0.1 seconds per rank.",
    maxRank: 3,
    effects: [
      { key: "fireCooldownSeconds", amount: -0.1 }
    ]
  }),
  createUpgradeDefinition({
    id: "shellRange",
    label: "Longer shell range",
    description: "Increase shell travel range by 1 cell per rank.",
    maxRank: 2,
    effects: [
      { key: "projectileMaxRangeCells", amount: 1 }
    ]
  }),
  createUpgradeDefinition({
    id: "shieldCapacity",
    label: "Shield rack",
    description: "Carry 1 extra shield charge per rank.",
    maxRank: 2,
    effects: [
      { key: "shieldCapacity", amount: 1 }
    ]
  })
]);

export const DEFAULT_PROGRESSION_STATE = Object.freeze({
  xp: 0,
  level: 1,
  availableUpgradePoints: 0,
  appliedUpgrades: Object.freeze({})
});

export const MISSION_XP_REWARD = Object.freeze({
  completion: 100,
  enemyDestroyed: 10
});

export const XP_PER_LEVEL = 100;

validateUpgradeCatalog(UPGRADE_CATALOG);

const UPGRADE_BY_ID = createUpgradeIndex(UPGRADE_CATALOG);

export function createProgressionState(overrides = {}) {
  validateProgressionSource(overrides);

  return {
    xp: normalizeNonNegativeInteger(overrides.xp ?? DEFAULT_PROGRESSION_STATE.xp, "xp"),
    level: normalizePositiveInteger(overrides.level ?? DEFAULT_PROGRESSION_STATE.level, "level"),
    availableUpgradePoints: normalizeNonNegativeInteger(
      overrides.availableUpgradePoints ?? DEFAULT_PROGRESSION_STATE.availableUpgradePoints,
      "availableUpgradePoints"
    ),
    appliedUpgrades: normalizeAppliedUpgrades(
      overrides.appliedUpgrades ?? DEFAULT_PROGRESSION_STATE.appliedUpgrades
    )
  };
}

export function cloneProgressionState(progressionState) {
  return createProgressionState(progressionState);
}

export function resetProgressionState() {
  return createProgressionState();
}

export function calculateMissionXpReward(missionSummary) {
  if (!missionSummary || typeof missionSummary !== "object" || Array.isArray(missionSummary)) {
    throw new Error("Mission summary must be an object.");
  }

  if (missionSummary.result === "failed") {
    return 0;
  }

  if (missionSummary.result !== "victory" && missionSummary.result !== "campaign complete") {
    return 0;
  }

  const enemiesDestroyed = normalizeNonNegativeInteger(
    missionSummary.enemiesDestroyed ?? 0,
    "missionSummary.enemiesDestroyed"
  );
  return MISSION_XP_REWARD.completion + (enemiesDestroyed * MISSION_XP_REWARD.enemyDestroyed);
}

export function calculateLevelForXp(xp) {
  const normalizedXp = normalizeNonNegativeInteger(xp, "xp");
  return Math.floor(normalizedXp / XP_PER_LEVEL) + 1;
}

export function awardProgressionXp(progressionState, xp) {
  const progression = createProgressionState(progressionState);
  const awardedXp = normalizeNonNegativeInteger(xp, "xp");
  const previousLevel = progression.level;
  progression.xp += awardedXp;
  progression.level = Math.max(progression.level, calculateLevelForXp(progression.xp));
  progression.availableUpgradePoints += Math.max(0, progression.level - previousLevel);
  return progression;
}

export function applyProgressionUpgrade(progressionState, upgradeId) {
  const progression = createProgressionState(progressionState);
  let upgrade;
  try {
    upgrade = getUpgradeDefinition(upgradeId);
  } catch {
    return {
      applied: false,
      reason: "unknown-upgrade",
      progression
    };
  }

  if (progression.availableUpgradePoints <= 0) {
    return {
      applied: false,
      reason: "no-points",
      progression
    };
  }

  const currentRank = progression.appliedUpgrades[upgrade.id] ?? 0;
  if (currentRank >= upgrade.maxRank) {
    return {
      applied: false,
      reason: "max-rank",
      progression
    };
  }

  progression.availableUpgradePoints -= 1;
  progression.appliedUpgrades[upgrade.id] = currentRank + 1;
  return {
    applied: true,
    reason: null,
    progression
  };
}

export function derivePlayerDefensiveStats(progressionState, baseStats) {
  const progression = createProgressionState(progressionState);
  if (!baseStats || typeof baseStats !== "object" || Array.isArray(baseStats)) {
    throw new Error("Base defensive stats must be an object.");
  }
  const maxHp = normalizePositiveInteger(baseStats.maxHp, "baseStats.maxHp");
  const repairAmountBonus = normalizeNonNegativeInteger(
    baseStats.repairAmountBonus ?? 0,
    "baseStats.repairAmountBonus"
  );
  const stats = {
    maxHp,
    repairAmountBonus
  };

  for (const [upgradeId, rank] of Object.entries(progression.appliedUpgrades)) {
    const upgrade = getUpgradeDefinition(upgradeId);
    for (const effect of upgrade.effects) {
      if (effect.key === "maxHp") {
        stats.maxHp += effect.amount * rank;
      }
      if (effect.key === "repairAmount") {
        stats.repairAmountBonus += effect.amount * rank;
      }
    }
  }

  return {
    maxHp: normalizePositiveInteger(stats.maxHp, "derived maxHp"),
    repairAmountBonus: normalizeNonNegativeInteger(
      stats.repairAmountBonus,
      "derived repairAmountBonus"
    )
  };
}

export function getUpgradeCatalog() {
  return UPGRADE_CATALOG;
}

export function getUpgradeDefinition(upgradeId) {
  if (typeof upgradeId !== "string" || upgradeId.length === 0) {
    throw new Error("Upgrade id must be a non-empty string.");
  }

  const upgrade = UPGRADE_BY_ID.get(upgradeId);
  if (!upgrade) {
    throw new Error(`Unknown upgrade id ${upgradeId}.`);
  }
  return upgrade;
}

export function calculateProgressionEffects(progressionState = DEFAULT_PROGRESSION_STATE) {
  const progression = createProgressionState(progressionState);
  const effects = Object.fromEntries(UPGRADE_EFFECT_KEYS.map((key) => [key, 0]));

  for (const [upgradeId, rank] of Object.entries(progression.appliedUpgrades)) {
    if (rank === 0) {
      continue;
    }

    const upgrade = getUpgradeDefinition(upgradeId);
    for (const effect of upgrade.effects) {
      effects[effect.key] += effect.amount * rank;
    }
  }

  return effects;
}

export function validateUpgradeCatalog(catalog) {
  if (!Array.isArray(catalog)) {
    throw new Error("Upgrade catalog must be an array.");
  }

  const seenIds = new Set();
  for (const upgrade of catalog) {
    validateUpgradeDefinition(upgrade);
    if (seenIds.has(upgrade.id)) {
      throw new Error(`Upgrade catalog contains duplicate upgrade id ${upgrade.id}.`);
    }
    seenIds.add(upgrade.id);
  }

  return catalog;
}

function validateProgressionSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("Progression state must be an object.");
  }
}

function normalizeAppliedUpgrades(appliedUpgrades) {
  if (!appliedUpgrades || typeof appliedUpgrades !== "object" || Array.isArray(appliedUpgrades)) {
    throw new Error("Progression appliedUpgrades must be an object.");
  }

  const normalized = {};
  for (const [upgradeId, rank] of Object.entries(appliedUpgrades)) {
    if (!upgradeId) {
      throw new Error("Progression appliedUpgrades cannot include an empty id.");
    }
    const upgrade = getUpgradeDefinition(upgradeId);
    const normalizedRank = normalizeNonNegativeInteger(rank, `appliedUpgrades.${upgradeId}`);
    if (normalizedRank > upgrade.maxRank) {
      throw new Error(`Progression appliedUpgrades.${upgradeId} cannot exceed max rank ${upgrade.maxRank}.`);
    }
    normalized[upgradeId] = normalizedRank;
  }
  return normalized;
}

function createUpgradeDefinition({
  id,
  label,
  description,
  maxRank,
  effects
}) {
  return Object.freeze({
    id,
    label,
    description,
    maxRank,
    effects: Object.freeze(effects.map((effect) => Object.freeze({ ...effect })))
  });
}

function createUpgradeIndex(catalog) {
  return new Map(catalog.map((upgrade) => [upgrade.id, upgrade]));
}

function validateUpgradeDefinition(upgrade) {
  if (!upgrade || typeof upgrade !== "object" || Array.isArray(upgrade)) {
    throw new Error("Upgrade definition must be an object.");
  }

  validateNonEmptyString(upgrade.id, "id");
  validateNonEmptyString(upgrade.label, "label");
  validateNonEmptyString(upgrade.description, "description");
  normalizePositiveInteger(upgrade.maxRank, `upgrade ${upgrade.id} maxRank`);

  if (!Array.isArray(upgrade.effects) || upgrade.effects.length === 0) {
    throw new Error(`Upgrade ${upgrade.id} effects must be a non-empty array.`);
  }

  for (const effect of upgrade.effects) {
    validateUpgradeEffect(upgrade.id, effect);
  }
}

function validateUpgradeEffect(upgradeId, effect) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    throw new Error(`Upgrade ${upgradeId} effect must be an object.`);
  }

  if (!UPGRADE_EFFECT_KEYS.includes(effect.key)) {
    throw new Error(`Upgrade ${upgradeId} has unknown effect key ${effect.key}.`);
  }

  if (typeof effect.amount !== "number" || !Number.isFinite(effect.amount) || effect.amount === 0) {
    throw new Error(`Upgrade ${upgradeId} effect amount must be a non-zero finite number.`);
  }
}

function validateNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Upgrade ${fieldName} must be a non-empty string.`);
  }
}

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Progression ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Progression ${fieldName} must be a non-negative integer.`);
  }
  return value;
}
