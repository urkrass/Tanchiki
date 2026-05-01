import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCampaignGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { damageTarget } from "../src/game/targets.js";
import { describeUpgradePanelContext } from "../src/upgradePanel.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const step = 1 / 60;

test("first public demo page keeps objective, controls, and live status visible", () => {
  assert.match(html, /Destroy the enemy base, then choose one upgrade before the next fight\./);
  assert.match(html, /<div class="demo-brief" aria-label="Demo quick start">/);
  assert.match(html, /<strong>Move<\/strong> WASD or Arrow keys/);
  assert.match(html, /<strong>Fire<\/strong> Space/);
  assert.match(html, /<strong>Continue<\/strong> N or Enter/);
  assert.match(html, /<strong>Restart<\/strong> R/);
  assert.match(html, /<div class="status-bar" aria-label="Live mission status">/);
  assert.match(html, /<div id="status" class="status" aria-live="polite"><\/div>/);
  assert.match(html, /<div id="progression-summary" class="progression-summary" aria-label="Campaign progression"><\/div>/);
  assert.match(html, /<p id="upgrade-context" class="upgrade-panel__context"><\/p>/);
});

test("side-panel shell keeps controls, mission HUD, and progression in separate zones", () => {
  assert.match(html, /<section class="game-screen" aria-labelledby="title">/);
  assert.match(html, /<aside class="side-panel controls-panel game-copy" aria-label="Controls and quick start">/);
  assert.match(html, /<section class="play-panel" aria-label="Mission playfield">/);
  assert.match(html, /<aside class="side-panel progression-panel" aria-label="Upgrades and rewards">/);
  assert.match(html, /<p id="progression-empty" class="progression-panel__empty">Win the mission to choose an upgrade\.<\/p>/);

  const controlsPanel = html.slice(
    html.indexOf("<aside class=\"side-panel controls-panel game-copy\""),
    html.indexOf("</aside>", html.indexOf("<aside class=\"side-panel controls-panel game-copy\""))
  );
  const playPanel = html.slice(
    html.indexOf("<section class=\"play-panel\""),
    html.indexOf("</section>", html.indexOf("<section class=\"play-panel\""))
  );
  const progressionPanel = html.slice(
    html.indexOf("<aside class=\"side-panel progression-panel\""),
    html.indexOf("</aside>", html.indexOf("<aside class=\"side-panel progression-panel\""))
  );

  assert.doesNotMatch(controlsPanel, /status-bar|id="status"|upgrade-panel|upgrade-context/);
  assert.match(playPanel, /status-bar/);
  assert.match(playPanel, /<canvas id="game"/);
  assert.match(progressionPanel, /id="progression-summary"/);
  assert.match(progressionPanel, /id="upgrade-panel"/);
  assert.match(progressionPanel, /progression-panel__empty/);
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

test("right panel renderer owns progression summary and empty-state visibility", () => {
  assert.match(mainSource, /const progressionSummary = document\.querySelector\("#progression-summary"\);/);
  assert.match(mainSource, /const progressionEmpty = document\.querySelector\("#progression-empty"\);/);
  assert.match(mainSource, /summaryContainer: progressionSummary,/);
  assert.match(mainSource, /emptyElement: progressionEmpty,/);
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

test("HUD renderer keeps mission status in compact panel semantics", () => {
  assert.match(mainSource, /function renderMissionStatus\(snapshot, statusText\)/);
  assert.match(mainSource, /status\.replaceChildren\(/);
  assert.match(mainSource, /createElement\("span", "status__summary", statusText\)/);
  assert.match(mainSource, /createElement\("div", "status__header"/);
  assert.match(mainSource, /createElement\("span", "status__kicker", `Mission \$\{missionNumber\}\/\$\{levelCount\}`\)/);
  assert.match(mainSource, /createElement\("strong", "status__title", missionLabel\)/);
  assert.match(mainSource, /createElement\("span", "status__objective", "Destroy enemy base"\)/);
  assert.match(mainSource, /createElement\("div", "status__chips"/);
  assert.match(mainSource, /createStatusChip\("hp", "HP", `\$\{snapshot\.player\.hp\}\/\$\{snapshot\.player\.maxHp\}`\)/);
  assert.match(mainSource, /createStatusChip\("enemy", "Enemies", String\(liveEnemyTanks\)\)/);
  assert.match(mainSource, /createStatusChip\(\s*"base",\s*"Base"/);
  assert.match(mainSource, /createStatusChip\("mission", "Level", `\$\{missionNumber\}\/\$\{levelCount\}`\)/);
  assert.match(mainSource, /cooldownMs > 0 \? `Reload \$\{cooldownMs\}ms` : "Space to fire"/);
  assert.match(mainSource, /createElement\("div", "status__badges"/);
});

test("HUD styles preserve chip layout and narrow-screen readability hooks", () => {
  assert.match(stylesSource, /\.status__summary\s*\{[\s\S]*position: absolute;[\s\S]*width: 1px;/);
  assert.match(stylesSource, /\.status__header\s*\{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) auto;/);
  assert.match(stylesSource, /\.status__chips\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(stylesSource, /\.status-chip\s*\{[\s\S]*grid-template-columns: 22px 1fr;/);
  assert.match(stylesSource, /\.status-chip--hp \.status-chip__icon/);
  assert.match(stylesSource, /\.status-chip--enemy \.status-chip__icon/);
  assert.match(stylesSource, /\.status-chip--base \.status-chip__icon/);
  assert.match(stylesSource, /\.status__badges\s*\{[\s\S]*flex-wrap: wrap;/);
  assert.match(stylesSource, /@media \(max-width: 560px\) \{[\s\S]*\.status__chips\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("layout styles provide desktop side panels and a playfield-first fallback", () => {
  assert.match(stylesSource, /\.game-screen\s*\{[\s\S]*grid-template-columns: minmax\(180px, 220px\) minmax\(0, 720px\) minmax\(220px, 280px\);/);
  assert.match(stylesSource, /\.side-panel\s*\{[\s\S]*border: 3px solid var\(--panel-dark\);/);
  assert.match(stylesSource, /\.progression-panel\s*\{[\s\S]*display: grid;[\s\S]*gap: 16px;/);
  assert.match(stylesSource, /\.progression-summary__row\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(stylesSource, /\.play-panel\s*\{[\s\S]*display: grid;[\s\S]*gap: 12px;/);
  assert.match(stylesSource, /@media \(max-width: 1180px\) \{[\s\S]*\.play-panel\s*\{[\s\S]*grid-row: 1;/);
  assert.match(stylesSource, /@media \(max-width: 760px\) \{[\s\S]*\.game-screen\s*\{[\s\S]*grid-template-columns: 1fr;/);
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
