import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROGRESSION_STATE,
  cloneProgressionState,
  createProgressionState,
  resetProgressionState
} from "../src/game/progression.js";

test("default progression state is empty and deterministic", () => {
  assert.deepEqual(createProgressionState(), {
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  });
  assert.deepEqual(resetProgressionState(), DEFAULT_PROGRESSION_STATE);
});

test("progression state accepts explicit serializable values", () => {
  const progression = createProgressionState({
    xp: 120,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 1,
      reload: 2
    }
  });

  assert.deepEqual(progression, {
    xp: 120,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 1,
      reload: 2
    }
  });
});

test("cloneProgressionState returns a detached copy", () => {
  const original = createProgressionState({
    xp: 40,
    level: 1,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 1
    }
  });

  const clone = cloneProgressionState(original);
  clone.appliedUpgrades.armor = 3;
  clone.xp = 999;

  assert.equal(original.xp, 40);
  assert.equal(original.appliedUpgrades.armor, 1);
});

test("progression state rejects invalid values", () => {
  assert.throws(() => createProgressionState(null), /must be an object/);
  assert.throws(() => createProgressionState({ xp: -1 }), /xp must be a non-negative integer/);
  assert.throws(() => createProgressionState({ level: 0 }), /level must be a positive integer/);
  assert.throws(
    () => createProgressionState({ availableUpgradePoints: 1.5 }),
    /availableUpgradePoints must be a non-negative integer/
  );
  assert.throws(
    () => createProgressionState({ appliedUpgrades: [] }),
    /appliedUpgrades must be an object/
  );
  assert.throws(
    () => createProgressionState({ appliedUpgrades: { armor: -1 } }),
    /appliedUpgrades\.armor must be a non-negative integer/
  );
});
