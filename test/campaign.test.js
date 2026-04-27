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

test("loss does not advance the current level", () => {
  const harness = createCampaignHarness({ levelIndex: 0, playerHp: 0 });

  harness.advanceStep();

  assert.equal(harness.game.debugState().missionStatus, "lost");
  assert.equal(harness.game.advanceLevel(), false);
  assert.equal(harness.game.debugState().currentLevelIndex, 0);
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
  assert.equal(baseAfterRestart.hp, baseAfterRestart.maxHp);
  assert.equal(baseAfterRestart.alive, true);
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
