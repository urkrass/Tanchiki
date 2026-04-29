import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertQaFirstDemoFlowEvidence,
  createQaFirstDemoFlowEvidence
} from "../scripts/qa-first-demo-flow.js";
import { createCampaignGame } from "../src/game.js";

test("scripted first-demo flow exposes repeatable PR evidence", () => {
  const evidence = createQaFirstDemoFlowEvidence();

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.flow.opening.level.id, "test-mission");
  assert.equal(evidence.flow.opening.campaign.currentLevelIndex, 0);
  assert.equal(evidence.flow.opening.mission.status, "playing");

  assert.equal(evidence.flow.controls.shooting.controls.action, "keydown Space");
  assert.equal(evidence.flow.controls.shooting.controls.shotAccepted, true);
  assert.equal(evidence.flow.controls.shooting.projectiles.activeCount, 1);
  assert.match(evidence.flow.controls.shooting.mission.statusText, /Shell fired\./);

  assert.equal(evidence.flow.controls.movementStarted.controls.action, "keydown ArrowRight");
  assert.equal(evidence.flow.controls.movementStarted.player.isMoving, true);
  assert.equal(evidence.flow.controls.movementStarted.player.toX, 2);
  assert.equal(evidence.flow.controls.movementStarted.player.toY, 1);

  assert.equal(evidence.flow.controls.movementArrived.player.gridX, 2);
  assert.equal(evidence.flow.controls.movementArrived.player.gridY, 1);
  assert.equal(evidence.flow.controls.movementArrived.player.isMoving, false);

  assert.equal(evidence.flow.victory.mission.status, "won");
  assert.equal(evidence.flow.victory.mission.summary.result, "victory");
  assert.equal(evidence.flow.victory.mission.summary.nextAction, "Choose one upgrade to continue");
  assert.deepEqual(evidence.flow.victory.mission.progressionFeedback.rows, [
    { label: "XP earned", value: "+100 XP" },
    { label: "Upgrade points", value: "1 point available" },
    { label: "Next step", value: "Choose one upgrade for Level 2" }
  ]);
  assert.equal(evidence.flow.victory.upgradeChoice.pending, true);
  assert.match(evidence.flow.victory.upgradeChoice.context, /Earned \+100 XP/);
  assert.match(evidence.flow.victory.upgradeChoice.context, /Level 2/);
  assert.deepEqual(evidence.flow.victory.upgradeChoice.choices.map((choice) => choice.id), [
    "armor",
    "repair",
    "reload"
  ]);

  assert.equal(evidence.flow.afterUpgrade.upgrade.applied, true);
  assert.equal(evidence.flow.afterUpgrade.campaign.canAdvanceLevel, true);
  assert.deepEqual(evidence.flow.afterUpgrade.mission.progressionFeedback.rows, [
    { label: "XP earned", value: "+100 XP" },
    { label: "Upgrade points", value: "None available" },
    { label: "Next step", value: "Continue to Level 2" }
  ]);
  assert.equal(evidence.flow.afterUpgrade.upgradeChoice.context, "");
  assert.deepEqual(evidence.flow.afterUpgrade.progression.appliedUpgrades, {
    armor: 1
  });

  assert.equal(evidence.flow.nextLevel.advanced, true);
  assert.equal(evidence.flow.nextLevel.campaign.currentLevelIndex, 1);
  assert.equal(evidence.flow.nextLevel.level.id, "checkpoint-mission");
  assert.equal(evidence.flow.nextLevel.mission.status, "playing");
});

test("scripted first-demo flow output is deterministic", () => {
  assert.deepEqual(createQaFirstDemoFlowEvidence(), createQaFirstDemoFlowEvidence());
});

test("scripted first-demo flow validator names missing required fields", () => {
  assert.throws(
    () => assertQaFirstDemoFlowEvidence({ schemaVersion: 1, flow: { opening: {} } }),
    /QA first-demo flow evidence is missing required field\(s\): flow\.opening\.level\.id/
  );
});

test("scripted first-demo flow validator names failing phase checks", () => {
  const evidence = createQaFirstDemoFlowEvidence();
  evidence.flow.controls.movementArrived.player.gridX = 1;

  assert.throws(
    () => assertQaFirstDemoFlowEvidence(evidence),
    /\[phase:move-control-arrived\] expected player\.gridX to be 2/
  );
});

test("scripted first-demo flow CLI prints valid JSON evidence", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/qa-first-demo-flow.js"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assertQaFirstDemoFlowEvidence(evidence);
  assert.equal(evidence.flow.nextLevel.level.id, "checkpoint-mission");
});

test("scripted first-demo flow helper does not mutate fresh campaign defaults", () => {
  createQaFirstDemoFlowEvidence();

  const fresh = createCampaignGame().debugState();
  assert.equal(fresh.currentLevelIndex, 0);
  assert.equal(fresh.missionStatus, "playing");
  assert.equal(fresh.player.gridX, 1);
  assert.equal(fresh.player.gridY, 1);
  assert.equal(fresh.progression.xp, 0);
  assert.deepEqual(fresh.progression.appliedUpgrades, {});
});
