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
        maxRank: upgrade.maxRank,
        rankLabel: `Current rank ${currentRank} -> ${currentRank + 1}/${upgrade.maxRank}`,
        effectLabel: formatUpgradeEffectLabel(upgrade.effects)
      };
    });
}

function formatUpgradeEffectLabel(effects) {
  return effects.map(formatEffect).join(", ");
}

function formatEffect(effect) {
  const amount = formatSignedAmount(effect.amount);
  if (effect.key === "maxHp") {
    return `Next: max armor ${amount}`;
  }
  if (effect.key === "repairAmount") {
    return `Next: repair pickup ${amount} armor`;
  }
  if (effect.key === "fireCooldownSeconds") {
    return `Next: shell cooldown ${formatSignedSeconds(effect.amount)}`;
  }
  if (effect.key === "projectileMaxRangeCells") {
    return `Next: shell range ${amount} cell`;
  }
  if (effect.key === "shieldCapacity") {
    return `Next: shield capacity ${amount}`;
  }
  return `Next: ${effect.key} ${amount}`;
}

function formatSignedAmount(amount) {
  return amount > 0 ? `+${amount}` : String(amount);
}

function formatSignedSeconds(amount) {
  return `${formatSignedAmount(amount)}s`;
}
