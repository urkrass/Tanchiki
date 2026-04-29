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
      { label: "Upgrade points", value: "1 point available" },
      { label: "Next step", value: "Choose one upgrade for Level 2" }
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
    },
    canAdvanceLevel: true
  }), {
    rows: [
      { label: "XP earned", value: "+100 XP" },
      { label: "Upgrade points", value: "2 points unspent - all upgrades maxed" },
      { label: "Next step", value: "Continue to Level 2" }
    ]
  });
});

test("progression feedback uses progression points when choice state is absent", () => {
  assert.deepEqual(createProgressionFeedback({
    missionSummary: {
      result: "campaign complete"
    },
    lastMissionReward: {
      xp: 130
    },
    progression: {
      availableUpgradePoints: 2
    }
  }), {
    rows: [
      { label: "XP earned", value: "+130 XP" },
      { label: "Upgrade points", value: "2 points available" }
    ]
  });
});

test("progression feedback avoids fake XP rows when no reward was recorded", () => {
  assert.deepEqual(createProgressionFeedback({
    missionSummary: {
      result: "victory"
    },
    lastMissionReward: null,
    progression: {
      availableUpgradePoints: 0
    }
  }), {
    rows: [
      { label: "Upgrade points", value: "None available" }
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
