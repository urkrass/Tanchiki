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
import { createProgressionFeedback } from "../src/game/progressionFeedback.js";
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

test("campaign pickups do not overlap spawn, walls, or solid enemies", () => {
  for (let index = 0; index < getCampaignLevelCount(); index += 1) {
    const mission = createCampaignMission(index);
    const solidEnemyCells = new Set(
      mission.targets
        .filter((target) => target.alive && target.solid)
        .map((target) => `${target.gridX},${target.gridY}`)
    );

    for (const pickup of mission.pickups) {
      assert.notDeepEqual(
        { x: pickup.gridX, y: pickup.gridY },
        mission.level.playerSpawn,
        `${mission.level.id} pickup ${pickup.id} overlaps player spawn`
      );
      assert.notEqual(
        mission.level.tiles[pickup.gridY][pickup.gridX],
        "#",
        `${mission.level.id} pickup ${pickup.id} is inside a wall`
      );
      assert.equal(
        solidEnemyCells.has(`${pickup.gridX},${pickup.gridY}`),
        false,
        `${mission.level.id} pickup ${pickup.id} overlaps a solid enemy`
      );
    }
  }
});

test("victory on a non-final level waits for the pending upgrade choice", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  assert.equal(harness.game.debugState().missionStatus, "won");
  assert.equal(harness.game.debugState().canAdvanceLevel, false);
  assert.equal(harness.game.advanceLevel(), false);

  const upgradeResult = harness.game.applyUpgrade("armor");
  assert.equal(upgradeResult.applied, true);
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
  assert.equal(summary.nextAction, "Choose one upgrade to continue");
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
  assert.equal(harness.game.applyUpgrade("armor").applied, true);
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
  assert.equal(harness.game.snapshot().lastMissionReward, null);
  assert.equal(harness.game.debugState().lastMissionReward, null);
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
  assert.equal(harness.game.applyUpgrade("repair").applied, true);
  assert.equal(harness.game.advanceLevel(), true);

  harness.game.restartLevel();
  const state = harness.game.debugState();

  assert.equal(state.currentLevelIndex, 1);
  assert.deepEqual(state.progression, {
    xp: 150,
    level: 2,
    availableUpgradePoints: 0,
    appliedUpgrades: {
      armor: 1,
      repair: 1
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

test("campaign victory awards deterministic XP once", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });
  const state = harness.game.snapshot();
  const firstSentry = state.targets.find((target) => target.id === "dummy-1");
  const secondSentry = state.targets.find((target) => target.id === "dummy-2");

  damageTarget(firstSentry, firstSentry.hp);
  damageTarget(secondSentry, secondSentry.hp);
  destroyEnemyBase(harness.game);
  harness.advanceStep();

  let snapshot = harness.game.snapshot();
  assert.equal(snapshot.progression.xp, 120);
  assert.deepEqual(snapshot.lastMissionReward, {
    levelIndex: 0,
    levelId: "test-mission",
    xp: 120,
    enemiesDestroyed: 2
  });

  harness.advanceStep();
  harness.advanceStep();
  snapshot = harness.game.snapshot();
  assert.equal(snapshot.progression.xp, 120);
  assert.equal(snapshot.progression.level, 2);
  assert.equal(snapshot.progression.availableUpgradePoints, 1);
  assert.equal(snapshot.lastMissionReward.xp, 120);
});

test("campaign victory exposes stable progression feedback display data", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  let feedback = createProgressionFeedback(harness.game.snapshot());
  assert.deepEqual(feedback.rows, [
    { label: "XP earned", value: "+100 XP" },
    { label: "Upgrade points", value: "1 point available" },
    { label: "Next step", value: "Choose one upgrade for Level 2" }
  ]);

  harness.advanceStep();
  harness.advanceStep();

  feedback = createProgressionFeedback(harness.game.snapshot());
  assert.deepEqual(feedback.rows, [
    { label: "XP earned", value: "+100 XP" },
    { label: "Upgrade points", value: "1 point available" },
    { label: "Next step", value: "Choose one upgrade for Level 2" }
  ]);
});

test("campaign applies chosen upgrades before advancing to the next level", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const [displayedChoice] = harness.game.snapshot().upgradeChoice.choices;
  assert.equal(displayedChoice.id, "armor");
  assert.equal(displayedChoice.rankLabel, "Current rank 0 -> 1/2");
  assert.equal(displayedChoice.effectLabel, "Next: max armor +1");

  const upgradeResult = harness.game.applyUpgrade(displayedChoice.id);
  assert.equal(upgradeResult.applied, true);
  assert.equal(upgradeResult.reason, null);
  assert.deepEqual(upgradeResult.progression.appliedUpgrades, {
    armor: 1
  });
  assert.equal(upgradeResult.progression.availableUpgradePoints, 0);

  assert.equal(harness.game.advanceLevel(), true);

  const state = harness.game.debugState();
  assert.equal(state.currentLevelIndex, 1);
  assert.equal(state.player.maxHp, 4);
  assert.equal(state.player.hp, 4);
  assert.deepEqual(state.progression.appliedUpgrades, {
    armor: 1
  });
});

test("campaign snapshots expose deterministic post-victory upgrade choices", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const snapshot = harness.game.snapshot();
  assert.deepEqual(snapshot.upgradeChoice.choices.map((choice) => choice.id), [
    "armor",
    "repair",
    "reload"
  ]);
  assert.equal(snapshot.upgradeChoice.pending, true);
  assert.equal(snapshot.upgradeChoice.availableUpgradePoints, 1);
});

test("campaign advance is ungated when no eligible upgrades remain", () => {
  const harness = createCampaignHarness({
    levelIndex: 0,
    progression: {
      xp: 900,
      level: 10,
      availableUpgradePoints: 1,
      appliedUpgrades: {
        armor: 2,
        repair: 2,
        reload: 3,
        shellRange: 2,
        shieldCapacity: 2
      }
    }
  });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  assert.deepEqual(harness.game.snapshot().upgradeChoice, {
    pending: false,
    availableUpgradePoints: 2,
    choices: []
  });
  assert.deepEqual(createProgressionFeedback(harness.game.snapshot()).rows, [
    { label: "XP earned", value: "+100 XP" },
    { label: "Upgrade points", value: "2 points unspent - all upgrades maxed" },
    { label: "Next step", value: "Continue to Level 2" }
  ]);
  assert.equal(harness.game.debugState().canAdvanceLevel, true);
  assert.equal(harness.game.advanceLevel(), true);
});

test("campaign upgrade choices fail deterministically when invalid", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  assert.deepEqual(harness.game.applyUpgrade("unknown"), {
    applied: false,
    reason: "unknown-upgrade",
    progression: {
      xp: 0,
      level: 1,
      availableUpgradePoints: 0,
      appliedUpgrades: {}
    }
  });
  assert.equal(harness.game.applyUpgrade("armor").reason, "no-points");
});

test("campaign loss grants no XP reward", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });

  harness.advanceStep();

  const state = harness.game.debugState();
  assert.equal(state.missionStatus, "lost");
  assert.equal(state.progression.xp, 0);
  assert.equal(state.lastMissionReward, null);
});

test("last mission reward snapshots are detached from game state", () => {
  const harness = createCampaignHarness({ levelIndex: 0 });

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  const snapshot = harness.game.snapshot();
  snapshot.lastMissionReward.xp = 999;

  const nextSnapshot = harness.game.snapshot();
  assert.equal(nextSnapshot.progression.xp, 100);
  assert.equal(nextSnapshot.lastMissionReward.xp, 100);
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
