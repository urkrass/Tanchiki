import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROGRESSION_STATE,
  UPGRADE_CATALOG,
  UPGRADE_EFFECT_KEYS,
  calculateMissionXpReward,
  calculateProgressionEffects,
  cloneProgressionState,
  createProgressionState,
  getUpgradeCatalog,
  getUpgradeDefinition,
  resetProgressionState,
  validateUpgradeCatalog
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

test("mission XP rewards are deterministic for completed summaries", () => {
  assert.equal(calculateMissionXpReward({
    result: "victory",
    enemiesDestroyed: 0
  }), 100);
  assert.equal(calculateMissionXpReward({
    result: "victory",
    enemiesDestroyed: 3
  }), 130);
  assert.equal(calculateMissionXpReward({
    result: "campaign complete",
    enemiesDestroyed: 2
  }), 120);
});

test("mission XP rewards reject losses and invalid summary data", () => {
  assert.equal(calculateMissionXpReward({
    result: "failed",
    enemiesDestroyed: 5
  }), 0);
  assert.equal(calculateMissionXpReward({
    result: "playing",
    enemiesDestroyed: 5
  }), 0);
  assert.throws(() => calculateMissionXpReward(null), /Mission summary must be an object/);
  assert.throws(
    () => calculateMissionXpReward({ result: "victory", enemiesDestroyed: -1 }),
    /missionSummary\.enemiesDestroyed must be a non-negative integer/
  );
});

test("upgrade catalog defines small deterministic upgrades", () => {
  assert.equal(getUpgradeCatalog(), UPGRADE_CATALOG);
  assert.equal(UPGRADE_CATALOG.length, 5);

  const ids = UPGRADE_CATALOG.map((upgrade) => upgrade.id);
  assert.deepEqual(ids, [
    "armor",
    "repair",
    "reload",
    "shellRange",
    "shieldCapacity"
  ]);

  for (const upgrade of UPGRADE_CATALOG) {
    assert.equal(typeof upgrade.id, "string");
    assert.equal(typeof upgrade.label, "string");
    assert.equal(typeof upgrade.description, "string");
    assert.ok(upgrade.maxRank > 0);
    assert.ok(upgrade.effects.length > 0);

    for (const effect of upgrade.effects) {
      assert.ok(UPGRADE_EFFECT_KEYS.includes(effect.key));
      assert.equal(typeof effect.amount, "number");
    }
  }
});

test("upgrade definitions are looked up by known id only", () => {
  assert.equal(getUpgradeDefinition("armor").label, "Reinforced armor");
  assert.throws(() => getUpgradeDefinition("unknown"), /Unknown upgrade id unknown/);
  assert.throws(() => getUpgradeDefinition(""), /non-empty string/);
});

test("progression effects sum applied upgrade ranks", () => {
  assert.deepEqual(calculateProgressionEffects({
    appliedUpgrades: {
      armor: 1,
      reload: 2,
      shellRange: 2
    }
  }), {
    maxHp: 1,
    repairAmount: 0,
    fireCooldownSeconds: -0.2,
    projectileMaxRangeCells: 2,
    shieldCapacity: 0
  });
});

test("progression state rejects unknown upgrade ids and ranks above max", () => {
  assert.throws(
    () => createProgressionState({ appliedUpgrades: { unknown: 1 } }),
    /Unknown upgrade id unknown/
  );
  assert.throws(
    () => createProgressionState({ appliedUpgrades: { armor: 3 } }),
    /armor cannot exceed max rank 2/
  );
});

test("upgrade catalog validation rejects duplicate ids and invalid definitions", () => {
  assert.equal(validateUpgradeCatalog(UPGRADE_CATALOG), UPGRADE_CATALOG);
  assert.throws(
    () => validateUpgradeCatalog([
      ...UPGRADE_CATALOG,
      {
        ...UPGRADE_CATALOG[0],
        effects: [...UPGRADE_CATALOG[0].effects]
      }
    ]),
    /duplicate upgrade id armor/
  );
  assert.throws(() => validateUpgradeCatalog({}), /must be an array/);
  assert.throws(
    () => validateUpgradeCatalog([
      {
        id: "bad",
        label: "Bad",
        description: "Invalid test upgrade.",
        maxRank: 0,
        effects: [
          { key: "maxHp", amount: 1 }
        ]
      }
    ]),
    /maxRank must be a positive integer/
  );
  assert.throws(
    () => validateUpgradeCatalog([
      {
        id: "bad",
        label: "Bad",
        description: "Invalid test upgrade.",
        maxRank: 1,
        effects: [
          { key: "mystery", amount: 1 }
        ]
      }
    ]),
    /unknown effect key mystery/
  );
});
