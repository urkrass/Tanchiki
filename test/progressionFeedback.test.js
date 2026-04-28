import test from "node:test";
import assert from "node:assert/strict";
import { createProgressionFeedback } from "../src/game/progressionFeedback.js";

test("progression feedback shows deterministic XP reward and pending upgrade points", () => {
  assert.deepEqual(createProgressionFeedback({
    missionSummary: {
      result: "victory"
    },
    lastMissionReward: {
      xp: 120
    },
    upgradeChoice: {
      pending: true,
      availableUpgradePoints: 1,
      choices: [{ id: "armor" }]
    }
  }), {
    rows: [
      { label: "XP earned", value: "+120 XP" },
      { label: "Upgrade points", value: "1 point available" }
    ]
  });
});

test("progression feedback explains no-upgrade state without gating continuation", () => {
  assert.deepEqual(createProgressionFeedback({
    missionSummary: {
      result: "victory"
    },
    lastMissionReward: {
      xp: 100
    },
    upgradeChoice: {
      pending: false,
      availableUpgradePoints: 2,
      choices: []
    }
  }), {
    rows: [
      { label: "XP earned", value: "+100 XP" },
      { label: "Upgrade points", value: "2 points unspent - all upgrades maxed" }
    ]
  });
});

test("progression feedback stays hidden for failed missions", () => {
  assert.equal(createProgressionFeedback({
    missionSummary: {
      result: "failed"
    },
    lastMissionReward: null,
    progression: {
      availableUpgradePoints: 0
    }
  }), null);
});
