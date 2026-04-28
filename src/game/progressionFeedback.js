export function createProgressionFeedback(snapshot) {
  if (!snapshot || !isCompletedResult(snapshot.missionSummary?.result)) {
    return null;
  }

  const rows = [];
  if (snapshot.lastMissionReward) {
    rows.push({
      label: "XP earned",
      value: `+${snapshot.lastMissionReward.xp} XP`
    });
  }

  rows.push({
    label: "Upgrade points",
    value: formatUpgradePointState(snapshot)
  });

  return { rows };
}

function formatUpgradePointState(snapshot) {
  const upgradeChoice = snapshot.upgradeChoice;
  const availableUpgradePoints = upgradeChoice?.availableUpgradePoints
    ?? snapshot.progression?.availableUpgradePoints
    ?? 0;

  if (availableUpgradePoints <= 0) {
    return "None available";
  }

  const pointLabel = availableUpgradePoints === 1 ? "point" : "points";
  if (upgradeChoice?.pending) {
    return `${availableUpgradePoints} ${pointLabel} available`;
  }

  if (Array.isArray(upgradeChoice?.choices) && upgradeChoice.choices.length === 0) {
    return `${availableUpgradePoints} ${pointLabel} unspent - all upgrades maxed`;
  }

  return `${availableUpgradePoints} ${pointLabel} available`;
}

function isCompletedResult(result) {
  return result === "victory" || result === "campaign complete";
}
