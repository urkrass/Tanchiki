import {
  createProgressionState,
  getUpgradeCatalog
} from "./progression.js";

export const DEFAULT_UPGRADE_CHOICE_LIMIT = 3;

export function createUpgradeChoiceState(
  progressionState,
  { limit = DEFAULT_UPGRADE_CHOICE_LIMIT } = {}
) {
  const progression = createProgressionState(progressionState);
  const choices = getEligibleUpgradeChoices(progression, { limit });

  return {
    pending: progression.availableUpgradePoints > 0 && choices.length > 0,
    availableUpgradePoints: progression.availableUpgradePoints,
    choices
  };
}

export function hasPendingUpgradeChoice(progressionState) {
  return createUpgradeChoiceState(progressionState).pending;
}

export function getEligibleUpgradeChoices(
  progressionState,
  { limit = DEFAULT_UPGRADE_CHOICE_LIMIT } = {}
) {
  const progression = createProgressionState(progressionState);
  if (progression.availableUpgradePoints <= 0) {
    return [];
  }

  return getUpgradeCatalog()
    .filter((upgrade) => (progression.appliedUpgrades[upgrade.id] ?? 0) < upgrade.maxRank)
    .slice(0, limit)
    .map((upgrade) => {
      const currentRank = progression.appliedUpgrades[upgrade.id] ?? 0;
      return {
        id: upgrade.id,
        label: upgrade.label,
        description: upgrade.description,
        currentRank,
        nextRank: currentRank + 1,
        maxRank: upgrade.maxRank
      };
    });
}
