import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertQaDemoSnapshot,
  createQaDemoSnapshot
} from "../scripts/qa-demo-snapshot.js";

test("QA demo snapshot exposes deterministic campaign flow evidence", () => {
  const snapshot = createQaDemoSnapshot();

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.flow.opening.level.id, "test-mission");
  assert.equal(snapshot.flow.opening.campaign.currentLevelIndex, 0);
  assert.equal(snapshot.flow.opening.mission.status, "playing");
  assert.deepEqual(snapshot.flow.opening.player, {
    gridX: 1,
    gridY: 1,
    facing: "right",
    hp: 3,
    maxHp: 3,
    isMoving: false,
    moveProgress: 0,
    ammoReserve: 0,
    shieldCharges: 0
  });
  assert.deepEqual(snapshot.flow.opening.progression, {
    xp: 0,
    level: 1,
    availableUpgradePoints: 0,
    appliedUpgrades: {}
  });

  assert.equal(snapshot.flow.victory.mission.status, "won");
  assert.equal(snapshot.flow.victory.mission.summary.result, "victory");
  assert.equal(snapshot.flow.victory.mission.summary.nextAction, "Choose one upgrade to continue");
  assert.equal(snapshot.flow.victory.upgradeChoice.pending, true);
  assert.deepEqual(snapshot.flow.victory.upgradeChoice.choices.map((choice) => choice.id), [
    "armor",
    "repair",
    "reload"
  ]);

  assert.equal(snapshot.flow.afterUpgrade.upgrade.applied, true);
  assert.equal(snapshot.flow.afterUpgrade.campaign.canAdvanceLevel, true);
  assert.deepEqual(snapshot.flow.afterUpgrade.progression.appliedUpgrades, {
    armor: 1
  });

  assert.equal(snapshot.flow.nextLevel.advanced, true);
  assert.equal(snapshot.flow.nextLevel.campaign.currentLevelIndex, 1);
  assert.equal(snapshot.flow.nextLevel.level.id, "checkpoint-mission");
  assert.equal(snapshot.flow.nextLevel.mission.status, "playing");
  assert.equal(snapshot.flow.nextLevel.player.hp, 4);
  assert.equal(snapshot.spriteAssets.manifest.status, "ready");
  assert.ok(snapshot.spriteAssets.manifest.spriteCount > 0);
});

test("QA demo snapshot output is stable for the same scripted flow", () => {
  assert.deepEqual(createQaDemoSnapshot(), createQaDemoSnapshot());
});

test("QA demo snapshot validator names missing required fields", () => {
  assert.throws(
    () => assertQaDemoSnapshot({ schemaVersion: 1, flow: { opening: {} } }),
    /QA demo snapshot is missing required field\(s\): flow\.opening\.level\.id/
  );
});

test("QA demo snapshot CLI prints valid JSON evidence", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/qa-demo-snapshot.js"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(result.stdout);
  assertQaDemoSnapshot(snapshot);
  assert.equal(snapshot.flow.nextLevel.level.id, "checkpoint-mission");
});
