import test from "node:test";
import assert from "node:assert/strict";
import {
  addCampaignState,
  createCampaignRewardTracker
} from "../src/game/campaignProgression.js";

test("campaign reward tracker awards completed levels once", () => {
  const tracker = createCampaignRewardTracker();
  const summary = {
    result: "victory",
    levelId: "test-mission",
    enemiesDestroyed: 2
  };

  assert.deepEqual(tracker.awardLevel({ currentLevelIndex: 0, summary }), {
    levelIndex: 0,
    levelId: "test-mission",
    xp: 120,
    enemiesDestroyed: 2
  });
  assert.equal(tracker.awardLevel({ currentLevelIndex: 0, summary }), null);
  assert.deepEqual(tracker.lastMissionReward(), {
    levelIndex: 0,
    levelId: "test-mission",
    xp: 120,
    enemiesDestroyed: 2
  });
});

test("campaign reward tracker skips failed or missing summaries", () => {
  const tracker = createCampaignRewardTracker();

  assert.equal(tracker.awardLevel({
    currentLevelIndex: 0,
    summary: {
      result: "failed",
      levelId: "test-mission",
      enemiesDestroyed: 4
    }
  }), null);
  assert.equal(tracker.awardLevel({ currentLevelIndex: 0, summary: null }), null);
  assert.equal(tracker.lastMissionReward(), null);
});

test("campaign state snapshots clone progression and reward data", () => {
  const state = addCampaignState(
    {
      missionSummary: null,
      level: { id: "test-mission" },
      player: { hp: 3, maxHp: 3 },
      targets: [],
      missionStatus: "playing"
    },
    0,
    3,
    "playing",
    {
      xp: 50,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: { armor: 1 }
    },
    {
      levelIndex: 0,
      levelId: "test-mission",
      xp: 100,
      enemiesDestroyed: 0
    },
    () => null
  );

  state.progression.xp = 999;
  state.lastMissionReward.xp = 999;

  assert.equal(state.currentLevelIndex, 0);
  assert.equal(state.levelNumber, 1);
  assert.equal(state.levelCount, 3);
  assert.equal(state.canAdvanceLevel, false);
  assert.equal(state.missionSummary, null);
});

test("campaign state exposes display-ready upgrade choice metadata only after victory", () => {
  const wonState = addCampaignState(
    {
      missionSummary: null,
      level: { id: "test-mission" },
      player: { hp: 3, maxHp: 3 },
      targets: [],
      missionStatus: "won"
    },
    0,
    3,
    "won",
    {
      xp: 100,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: {}
    },
    {
      levelIndex: 0,
      levelId: "test-mission",
      xp: 100,
      enemiesDestroyed: 0
    },
    () => null
  );

  assert.equal(wonState.upgradeChoice.pending, true);
  assert.deepEqual(wonState.upgradeChoice.choices[0], {
    id: "armor",
    label: "Reinforced armor",
    description: "Increase max armor by 1 per rank.",
    currentRank: 0,
    nextRank: 1,
    maxRank: 2,
    rankLabel: "Current rank 0 -> 1/2",
    effectLabel: "Next: max armor +1"
  });

  const lostState = addCampaignState(
    {
      missionSummary: null,
      level: { id: "test-mission" },
      player: { hp: 0, maxHp: 3 },
      targets: [],
      missionStatus: "lost"
    },
    0,
    3,
    "lost",
    {
      xp: 100,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: {}
    },
    null,
    () => null
  );

  assert.deepEqual(lostState.upgradeChoice, {
    pending: false,
    availableUpgradePoints: 0,
    choices: []
  });
});
