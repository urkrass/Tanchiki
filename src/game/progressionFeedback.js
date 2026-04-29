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

  const nextStep = formatNextStep(snapshot);
  if (nextStep) {
    rows.push({
      label: "Next step",
      value: nextStep
    });
  }

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

function formatNextStep(snapshot) {
  if (snapshot.upgradeChoice?.pending) {
    return `Choose one upgrade for Level ${nextLevelNumber(snapshot)}`;
  }

  if (snapshot.canAdvanceLevel) {
    return `Continue to Level ${nextLevelNumber(snapshot)}`;
  }

  return null;
}

function nextLevelNumber(snapshot) {
  if (Number.isFinite(snapshot.levelNumber)) {
    return snapshot.levelNumber + 1;
  }

  if (Number.isFinite(snapshot.currentLevelIndex)) {
    return snapshot.currentLevelIndex + 2;
  }

  return 2;
}

function isCompletedResult(result) {
  return result === "victory" || result === "campaign complete";
}
