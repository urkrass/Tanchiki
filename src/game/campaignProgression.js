import {
  applyProgressionUpgrade,
  awardProgressionXp,
  calculateMissionXpReward,
  cloneProgressionState
} from "./progression.js";

export function createCampaignRewardTracker() {
  const rewardedLevelIndexes = new Set();
  let lastMissionReward = null;

  return {
    awardLevel({ currentLevelIndex, summary }) {
      if (!shouldAwardReward(summary, currentLevelIndex, rewardedLevelIndexes)) {
        return null;
      }

      const xp = calculateMissionXpReward(summary);
      rewardedLevelIndexes.add(currentLevelIndex);
      lastMissionReward = {
        levelIndex: currentLevelIndex,
        levelId: summary.levelId,
        xp,
        enemiesDestroyed: summary.enemiesDestroyed
      };
      return lastMissionReward;
    },

    lastMissionReward() {
      return cloneMissionReward(lastMissionReward);
    }
  };
}

export function addCampaignState(
  state,
  currentLevelIndex,
  levelCount,
  missionStatus,
  progression,
  lastMissionReward,
  createMissionSummary
) {
  const campaignState = {
    ...state,
    missionStatus,
    currentLevelIndex,
    levelNumber: currentLevelIndex + 1,
    levelCount,
    canAdvanceLevel: missionStatus === "won" && currentLevelIndex < levelCount - 1,
    progression: cloneProgressionState(progression),
    lastMissionReward: cloneMissionReward(lastMissionReward)
  };
  return {
    ...campaignState,
    missionSummary: createMissionSummary(campaignState)
  };
}

export function applyCampaignReward(progression, reward) {
  if (!reward) {
    return cloneProgressionState(progression);
  }

  Object.assign(progression, awardProgressionXp(progression, reward.xp));
  return cloneProgressionState(progression);
}

export function applyCampaignUpgrade(progression, upgradeId) {
  const result = applyProgressionUpgrade(progression, upgradeId);
  if (result.applied) {
    Object.assign(progression, result.progression);
  }

  return {
    applied: result.applied,
    reason: result.reason,
    progression: cloneProgressionState(progression)
  };
}

function shouldAwardReward(summary, currentLevelIndex, rewardedLevelIndexes) {
  return Boolean(
    summary
    && (summary.result === "victory" || summary.result === "campaign complete")
    && !rewardedLevelIndexes.has(currentLevelIndex)
  );
}

function cloneMissionReward(missionReward) {
  return missionReward ? { ...missionReward } : null;
}
