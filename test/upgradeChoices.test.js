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
    maxRank: 2
  });
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
