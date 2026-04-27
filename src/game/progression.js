export const DEFAULT_PROGRESSION_STATE = Object.freeze({
  xp: 0,
  level: 1,
  availableUpgradePoints: 0,
  appliedUpgrades: Object.freeze({})
});

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
    normalized[upgradeId] = normalizeNonNegativeInteger(rank, `appliedUpgrades.${upgradeId}`);
  }
  return normalized;
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
