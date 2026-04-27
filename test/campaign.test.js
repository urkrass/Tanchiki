import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createCampaignGame } from "../src/game.js";
import {
  createCampaignMission,
  getCampaignLevelCount,
  validateCampaignMissions
} from "../src/game/level.js";
import { createInput } from "../src/input.js";
import { damageTarget } from "../src/game/targets.js";

const step = 1 / 60;

test("campaign level 1 can be loaded", () => {
  const mission = createCampaignMission(0);

  assert.equal(mission.level.id, "test-mission");
  assert.equal(mission.targets.some(isLiveEnemyBase), true);
});

test("campaign level 2 can be loaded", () => {
  const mission = createCampaignMission(1);

  assert.equal(mission.level.id, "checkpoint-mission");
  assert.equal(mission.targets.some(isLiveEnemyBase), true);
});

test("all campaign levels pass validation", () => {
  assert.doesNotThrow(() => validateCampaignMissions());

  for (let index = 0; index < getCampaignLevelCount(); index += 1) {
    const mission = createCampaignMission(index);
    assert.equal(mission.targets.some(isLiveEnemyBase), true);
  }
});

test("victory on a non-final level enables next-level transition", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  assert.equal(harness.game.debugState().missionStatus, "won");
  assert.equal(harness.game.debugState().canAdvanceLevel, true);
  assert.equal(harness.game.advanceLevel(), true);
  assert.equal(harness.game.debugState().currentLevelIndex, 1);
  assert.equal(harness.game.debugState().missionStatus, "playing");
});

test("victory summary contains level, result, and next action data", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const summary = harness.game.snapshot().missionSummary;
  assert.equal(summary.result, "victory");
  assert.equal(summary.levelLabel, "Level 1/3");
  assert.equal(summary.levelId, "test-mission");
  assert.equal(summary.enemyBaseStatus, "Destroyed");
  assert.equal(summary.nextAction, "Press N or Enter for next level");
});

test("campaign does not advance while the current level is still playing", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  assert.equal(harness.game.advanceLevel(), false);
  assert.equal(harness.game.debugState().currentLevelIndex, 0);
  assert.equal(harness.game.debugState().missionStatus, "playing");
});

test("victory on the final level sets campaign-complete state", () => {
  const harness = createCampaignHarness({ levelIndex: getCampaignLevelCount() - 1 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const state = harness.game.debugState();
  assert.equal(state.missionStatus, "campaign-complete");
  assert.equal(state.canAdvanceLevel, false);
});

test("campaign-complete summary appears after final level victory", () => {
  const harness = createCampaignHarness({ levelIndex: getCampaignLevelCount() - 1 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const summary = harness.game.snapshot().missionSummary;
  assert.equal(summary.result, "campaign complete");
  assert.equal(summary.title, "Campaign complete");
  assert.equal(summary.levelLabel, "Level 3/3");
  assert.equal(summary.nextAction, "Press R to replay the final level");
  assert.equal(harness.game.advanceLevel(), false);
});

test("loss summary contains failure reason and restart action data", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });

  harness.advanceStep();

  const summary = harness.game.snapshot().missionSummary;
  assert.equal(summary.result, "failed");
  assert.equal(summary.failureReason, "Player tank destroyed");
  assert.equal(summary.hpRemaining, 0);
  assert.equal(summary.nextAction, "Press R to restart current level");
});

test("loss does not advance the current level", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });

  harness.advanceStep();

  assert.equal(harness.game.debugState().missionStatus, "lost");
  assert.equal(harness.game.advanceLevel(), false);
  assert.equal(harness.game.debugState().currentLevelIndex, 0);
});

test("loss summary remains separate from victory and continue actions", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });

  harness.advanceStep();

  const state = harness.game.debugState();
  const summary = harness.game.snapshot().missionSummary;

  assert.equal(state.missionStatus, "lost");
  assert.equal(state.canAdvanceLevel, false);
  assert.equal(summary.result, "failed");
  assert.equal(summary.title, "Mission failed");
  assert.equal(summary.nextAction, "Press R to restart current level");
  assert.notEqual(summary.result, "victory");
  assert.doesNotMatch(summary.nextAction, /next level/i);
});

test("enemy destroyed count and HP remaining are tracked in the summary", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 2 });
  const state = harness.game.snapshot();
  const firstSentry = state.targets.find((target) => target.id === "dummy-1");
  const secondSentry = state.targets.find((target) => target.id === "dummy-2");

  damageTarget(firstSentry, firstSentry.hp);
  damageTarget(secondSentry, secondSentry.hp);
  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const summary = harness.game.snapshot().missionSummary;
  assert.equal(summary.enemiesDestroyed, 2);
  assert.equal(summary.hpRemaining, 2);
  assert.equal(summary.maxHp, 3);
});

test("advance remains limited to non-final victory states", () => {
  const lossHarness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });
  lossHarness.advanceStep();

  assert.equal(lossHarness.game.advanceLevel(), false);
  assert.equal(lossHarness.game.debugState().currentLevelIndex, 0);

  const finalHarness = createCampaignHarness({ levelIndex: getCampaignLevelCount() - 1 });
  destroyEnemyBase(finalHarness.game);
  finalHarness.advanceStep();

  assert.equal(finalHarness.game.advanceLevel(), false);
  assert.equal(finalHarness.game.debugState().currentLevelIndex, getCampaignLevelCount() - 1);
});

test("R-style restart resets the current level without rewinding campaign progress", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();
  assert.equal(harness.game.advanceLevel(), true);

  const baseBeforeRestart = enemyBase(harness.game);
  damageTarget(baseBeforeRestart, 1);
  assert.equal(baseBeforeRestart.hp, baseBeforeRestart.maxHp - 1);

  harness.game.restartLevel();
  const state = harness.game.debugState();
  const baseAfterRestart = enemyBase(harness.game);

  assert.equal(state.currentLevelIndex, 1);
  assert.equal(state.missionStatus, "playing");
  assert.equal(state.missionSummary, null);
  assert.equal(baseAfterRestart.hp, baseAfterRestart.maxHp);
  assert.equal(baseAfterRestart.alive, true);
});

test("campaign snapshots expose default progression state", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  assert.deepEqual(harness.game.snapshot().progression, {
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  });
  assert.deepEqual(harness.game.debugState().progression, {
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  });
});

test("campaign progression snapshots are detached from game state", () => {
  const harness = createCampaignHarness({
    progression: {
      xp: 50,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: {
        armor: 1
      }
    }
  });

  const snapshot = harness.game.snapshot();
  snapshot.progression.xp = 999;
  snapshot.progression.appliedUpgrades.armor = 99;

  const nextSnapshot = harness.game.snapshot();
  assert.equal(nextSnapshot.progression.xp, 50);
  assert.equal(nextSnapshot.progression.appliedUpgrades.armor, 1);
});

test("restarting the current level preserves in-memory campaign progression", () => {
  const harness = createCampaignHarness({
    levelIndex: 0,
    progression: {
      xp: 50,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: {
        armor: 1
      }
    }
  });

  destroyEnemyBase(harness.game);
  harness.advanceStep();
  assert.equal(harness.game.advanceLevel(), true);

  harness.game.restartLevel();
  const state = harness.game.debugState();

  assert.equal(state.currentLevelIndex, 1);
  assert.deepEqual(state.progression, {
    xp: 50,
    level: 2,
    availableUpgradePoints: 1,
    appliedUpgrades: {
      armor: 1
    }
  });
});

test("creating a new campaign game starts with clean progression", () => {
  const progressed = createCampaignHarness({
    progression: {
      xp: 50,
      level: 2,
      availableUpgradePoints: 1,
      appliedUpgrades: {
        armor: 1
      }
    }
  });
  const fresh = createCampaignHarness();

  assert.equal(progressed.game.snapshot().progression.xp, 50);
  assert.deepEqual(fresh.game.snapshot().progression, {
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  });
});

test("movement.js remains unchanged for campaign progression", () => {
  const diff = spawnSync("git", ["diff", "--exit-code", "HEAD", "--", "src/game/movement.js"], {
    encoding: "utf8"
  });

  assert.equal(diff.status, 0, diff.stdout || diff.stderr);
});

function createCampaignHarness(options = {}) {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createCampaignGame(options);

  return {
    game,
    advanceStep() {
      game.update(step, input);
    }
  };
}

function destroyEnemyBase(game) {
  const base = enemyBase(game);
  damageTarget(base, base.hp);
}

function enemyBase(game) {
  return game.snapshot().targets.find(isLiveEnemyBase);
}

function isLiveEnemyBase(target) {
  return target.type === "base" && target.team === "enemy" && target.alive;
}
