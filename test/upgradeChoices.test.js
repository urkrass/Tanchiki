import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpgradeChoiceState,
  getEligibleUpgradeChoices,
  hasPendingUpgradeChoice
} from "../src/game/upgradeChoices.js";

test("eligible upgrade choices are deterministic and limited", () => {
  const choices = getEligibleUpgradeChoices({
    xp: 100,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {}
  });

  assert.deepEqual(choices.map((choice) => choice.id), [
    "armor",
    "repair",
    "reload"
  ]);
  assert.deepEqual(choices[0], {
    id: "armor",
    label: "Reinforced armor",
    description: "Increase max armor by 1 per rank.",
    currentRank: 0,
    nextRank: 1,
    maxRank: 2,
    rankLabel: "Current rank 0 -> 1/2",
    effectLabel: "Next: max armor +1"
  });
});

test("eligible upgrade choices expose concise effect context", () => {
  const choices = getEligibleUpgradeChoices({
    xp: 300,
    level: 4,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 1,
      repair: 1
    }
  }, { limit: 5 });

  assert.deepEqual(choices.map((choice) => ({
    id: choice.id,
    rankLabel: choice.rankLabel,
    effectLabel: choice.effectLabel
  })), [
    {
      id: "armor",
      rankLabel: "Current rank 1 -> 2/2",
      effectLabel: "Next: max armor +1"
    },
    {
      id: "repair",
      rankLabel: "Current rank 1 -> 2/2",
      effectLabel: "Next: repair pickup +1 armor"
    },
    {
      id: "reload",
      rankLabel: "Current rank 0 -> 1/3",
      effectLabel: "Next: shell cooldown -0.1s"
    },
    {
      id: "shellRange",
      rankLabel: "Current rank 0 -> 1/2",
      effectLabel: "Next: shell range +1 cell"
    },
    {
      id: "shieldCapacity",
      rankLabel: "Current rank 0 -> 1/2",
      effectLabel: "Next: shield capacity +1"
    }
  ]);
});

test("max-rank upgrades are not offered", () => {
  const choices = getEligibleUpgradeChoices({
    xp: 300,
    level: 4,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 2,
      repair: 2
    }
  }, { limit: 5 });

  assert.deepEqual(choices.map((choice) => choice.id), [
    "reload",
    "shellRange",
    "shieldCapacity"
  ]);
});

test("fully maxed upgrade state remains ungated with no choices", () => {
  assert.deepEqual(createUpgradeChoiceState({
    xp: 900,
    level: 10,
    availableUpgradePoints: 2,
    appliedUpgrades: {
      armor: 2,
      repair: 2,
      reload: 3,
      shellRange: 2,
      shieldCapacity: 2
    }
  }), {
    pending: false,
    availableUpgradePoints: 2,
    choices: []
  });
});

test("display metadata matches the same upgrade id selected by gameplay", () => {
  const [choice] = getEligibleUpgradeChoices({
    xp: 100,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {}
  });

  assert.equal(choice.id, "armor");
  assert.equal(choice.nextRank, 1);
  assert.equal(choice.rankLabel, "Current rank 0 -> 1/2");
  assert.equal(choice.effectLabel, "Next: max armor +1");
});

test("upgrade choice state is pending only when a point can be spent", () => {
  assert.deepEqual(createUpgradeChoiceState({
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  }), {
    pending: false,
    availableUpgradePoints: 0,
    choices: []
  });

  assert.equal(hasPendingUpgradeChoice({
    xp: 100,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {}
  }), true);
});
