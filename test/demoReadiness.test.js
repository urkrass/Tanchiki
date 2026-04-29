import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCampaignGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { damageTarget } from "../src/game/targets.js";
import { describeUpgradePanelContext } from "../src/upgradePanel.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const step = 1 / 60;

test("first public demo page keeps objective, controls, and live status visible", () => {
  assert.match(html, /Level 1 starts with a single job: reach and destroy the enemy base, then choose one upgrade before the next fight\./);
  assert.match(html, /<div class="demo-brief" aria-label="Demo quick start">/);
  assert.match(html, /<strong>Move<\/strong> WASD or Arrow keys/);
  assert.match(html, /<strong>Fire<\/strong> Space/);
  assert.match(html, /<strong>Continue<\/strong> N or Enter/);
  assert.match(html, /<strong>Restart<\/strong> R/);
  assert.match(html, /<div class="status-bar" aria-label="Live mission status">/);
  assert.match(html, /<div id="status" class="status" aria-live="polite"><\/div>/);
  assert.match(html, /<p id="upgrade-context" class="upgrade-panel__context"><\/p>/);
});

test("demo campaign preserves victory to upgrade to next-level flow", () => {
  const harness = createCampaignHarness();

  destroyEnemyBase(harness.game);
  harness.advanceStep();

  let snapshot = harness.game.snapshot();
  assert.equal(snapshot.missionStatus, "won");
  assert.equal(snapshot.missionSummary.nextAction, "Choose one upgrade to continue");
  assert.equal(snapshot.upgradeChoice.pending, true);
  assert.equal(snapshot.canAdvanceLevel, false);

  assert.equal(harness.game.applyUpgrade(snapshot.upgradeChoice.choices[0].id).applied, true);
  assert.equal(harness.game.advanceLevel(), true);

  snapshot = harness.game.snapshot();
  assert.equal(snapshot.currentLevelIndex, 1);
  assert.equal(snapshot.missionStatus, "playing");
  assert.equal(snapshot.missionSummary, null);
});

test("upgrade panel context connects the reward to the next level", () => {
  assert.equal(describeUpgradePanelContext({
    levelNumber: 1,
    lastMissionReward: {
      xp: 100
    },
    upgradeChoice: {
      pending: true,
      availableUpgradePoints: 1
    }
  }), "Earned +100 XP and 1 upgrade point. Pick one upgrade now; it starts on Level 2.");
});

test("demo campaign exposes readable mission status for the opening minute", () => {
  const harness = createCampaignHarness();
  const status = harness.game.statusText(harness.input);

  assert.match(status, /Level 1\/3/);
  assert.match(status, /Mission playing\./);
  assert.match(status, /Objective: destroy the enemy base/);
  assert.match(status, /HP 3\/3/);
  assert.match(status, /Enemy tanks left 3/);
  assert.match(status, /Space fires in the direction you face/);
  assert.match(status, /Enemy base HP 6\/6/);
  assert.match(status, /Collect \+, A, and S pickups when safe/);
});

function createCampaignHarness(options = {}) {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createCampaignGame(options);

  return {
    game,
    input,
    advanceStep() {
      game.update(step, input);
    }
  };
}

function destroyEnemyBase(game) {
  const base = game.snapshot().targets.find((target) => (
    target.type === "base"
    && target.team === "enemy"
    && target.alive
  ));
  damageTarget(base, base.hp);
}
