import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayerCombatStats,
  createPlayerStateFromProgression
} from "../src/game/playerStats.js";

test("player combat stats preserve default cooldown and range without upgrades", () => {
  assert.deepEqual(createPlayerCombatStats(), {
    speedCellsPerSecond: 6,
    maxRangeCells: 5,
    cooldownSeconds: 0.4,
    team: "player"
  });
});

test("reload and shell range upgrades affect player combat stats", () => {
  assert.deepEqual(createPlayerCombatStats({
    appliedUpgrades: {
      reload: 3,
      shellRange: 2
    }
  }), {
    speedCellsPerSecond: 6,
    maxRangeCells: 7,
    cooldownSeconds: 0.1,
    team: "player"
  });
});

test("default player state preserves defensive defaults", () => {
  const { effectiveStats, playerState } = createPlayerStateFromProgression();

  assert.deepEqual(effectiveStats, {
    maxHp: 3,
    repairAmountBonus: 0
  });
  assert.equal(playerState.hp, 3);
  assert.equal(playerState.maxHp, 3);
  assert.equal(playerState.repairAmountBonus, 0);
});

test("armor upgrade increases level-start max HP", () => {
  const { effectiveStats, playerState } = createPlayerStateFromProgression({
    progression: {
      appliedUpgrades: {
        armor: 2
      }
    }
  });

  assert.deepEqual(effectiveStats, {
    maxHp: 5,
    repairAmountBonus: 0
  });
  assert.equal(playerState.hp, 5);
  assert.equal(playerState.maxHp, 5);
});

test("explicit player HP is capped by effective max HP", () => {
  const { playerState } = createPlayerStateFromProgression({
    playerHp: 9,
    progression: {
      appliedUpgrades: {
        armor: 1
      }
    }
  });

  assert.equal(playerState.hp, 4);
  assert.equal(playerState.maxHp, 4);
});
