import { fileURLToPath } from "node:url";
import { createCampaignGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { damageTarget } from "../src/game/targets.js";

const stepSeconds = 1 / 60;
const moveArrivalSeconds = 0.3;

const requiredEvidencePaths = [
  "schemaVersion",
  "flow.opening.level.id",
  "flow.opening.campaign.currentLevelIndex",
  "flow.opening.mission.status",
  "flow.controls.shooting.projectiles.activeCount",
  "flow.controls.shooting.controls.shotAccepted",
  "flow.controls.movementStarted.player.isMoving",
  "flow.controls.movementStarted.player.toX",
  "flow.controls.movementArrived.player.gridX",
  "flow.victory.mission.status",
  "flow.victory.mission.summary.nextAction",
  "flow.victory.upgradeChoice.pending",
  "flow.afterUpgrade.upgrade.applied",
  "flow.afterUpgrade.campaign.canAdvanceLevel",
  "flow.nextLevel.advanced",
  "flow.nextLevel.campaign.currentLevelIndex",
  "flow.nextLevel.mission.status"
];

export function createQaFirstDemoFlowEvidence() {
  const harness = createCampaignHarness();
  const opening = stateEvidence(harness, "start-level-1");

  harness.keydown("Space");
  harness.advanceStep();
  const shooting = stateEvidence(harness, "shoot-control-response", {
    controls: {
      action: "keydown Space",
      shotAccepted: true
    }
  });

  harness.keydown("ArrowRight");
  harness.advanceStep();
  harness.keyup("ArrowRight");
  const movementStarted = stateEvidence(harness, "move-control-started", {
    controls: {
      action: "keydown ArrowRight",
      expectedTarget: { x: 2, y: 1 }
    }
  });

  harness.advance(moveArrivalSeconds);
  const movementArrived = stateEvidence(harness, "move-control-arrived", {
    controls: {
      action: `advance ${moveArrivalSeconds}s`,
      expectedCell: { x: 2, y: 1 }
    }
  });

  destroyEnemyBase(harness.game);
  harness.advanceStep();
  const victory = stateEvidence(harness, "deterministic-victory");

  const [firstChoice] = victory.upgradeChoice.choices;
  const upgrade = harness.game.applyUpgrade(firstChoice?.id);
  const afterUpgrade = stateEvidence(harness, "upgrade-applied", { upgrade });

  const advanced = harness.game.advanceLevel();
  const nextLevel = stateEvidence(harness, "next-level-start", { advanced });

  const evidence = {
    schemaVersion: 1,
    generatedBy: "scripts/qa-first-demo-flow.js",
    purpose: "agent-visible scripted first-demo flow QA evidence",
    flow: {
      opening,
      controls: {
        shooting,
        movementStarted,
        movementArrived
      },
      victory,
      afterUpgrade,
      nextLevel
    }
  };

  assertQaFirstDemoFlowEvidence(evidence);
  return evidence;
}

export function assertQaFirstDemoFlowEvidence(evidence) {
  const missing = requiredEvidencePaths.filter((path) => valueAtPath(evidence, path) === undefined);
  if (missing.length > 0) {
    throw new Error(`QA first-demo flow evidence is missing required field(s): ${missing.join(", ")}`);
  }

  expectPhase(evidence.flow.opening, "start-level-1", (phase) => {
    expectEqual(phase.level.id, "test-mission", phase.phase, "level.id");
    expectEqual(phase.campaign.currentLevelIndex, 0, phase.phase, "campaign.currentLevelIndex");
    expectEqual(phase.mission.status, "playing", phase.phase, "mission.status");
    expectEqual(phase.player.gridX, 1, phase.phase, "player.gridX");
    expectEqual(phase.player.gridY, 1, phase.phase, "player.gridY");
    expectEqual(phase.player.facing, "right", phase.phase, "player.facing");
  });

  expectPhase(evidence.flow.controls.shooting, "shoot-control-response", (phase) => {
    expectEqual(phase.controls.shotAccepted, true, phase.phase, "controls.shotAccepted");
    expectAtLeast(phase.projectiles.activeCount, 1, phase.phase, "projectiles.activeCount");
    expectIncludes(phase.mission.statusText, "Shell fired.", phase.phase, "mission.statusText");
  });

  expectPhase(evidence.flow.controls.movementStarted, "move-control-started", (phase) => {
    expectEqual(phase.player.isMoving, true, phase.phase, "player.isMoving");
    expectEqual(phase.player.toX, 2, phase.phase, "player.toX");
    expectEqual(phase.player.toY, 1, phase.phase, "player.toY");
  });

  expectPhase(evidence.flow.controls.movementArrived, "move-control-arrived", (phase) => {
    expectEqual(phase.player.gridX, 2, phase.phase, "player.gridX");
    expectEqual(phase.player.gridY, 1, phase.phase, "player.gridY");
    expectEqual(phase.player.isMoving, false, phase.phase, "player.isMoving");
  });

  expectPhase(evidence.flow.victory, "deterministic-victory", (phase) => {
    expectEqual(phase.mission.status, "won", phase.phase, "mission.status");
    expectEqual(phase.mission.summary.result, "victory", phase.phase, "mission.summary.result");
    expectEqual(
      phase.mission.summary.nextAction,
      "Choose one upgrade to continue",
      phase.phase,
      "mission.summary.nextAction"
    );
    expectEqual(phase.upgradeChoice.pending, true, phase.phase, "upgradeChoice.pending");
    expectAtLeast(phase.upgradeChoice.choices.length, 1, phase.phase, "upgradeChoice.choices.length");
  });

  expectPhase(evidence.flow.afterUpgrade, "upgrade-applied", (phase) => {
    expectEqual(phase.upgrade.applied, true, phase.phase, "upgrade.applied");
    expectEqual(phase.campaign.canAdvanceLevel, true, phase.phase, "campaign.canAdvanceLevel");
    expectEqual(phase.upgradeChoice.pending, false, phase.phase, "upgradeChoice.pending");
  });

  expectPhase(evidence.flow.nextLevel, "next-level-start", (phase) => {
    expectEqual(phase.advanced, true, phase.phase, "advanced");
    expectEqual(phase.campaign.currentLevelIndex, 1, phase.phase, "campaign.currentLevelIndex");
    expectEqual(phase.level.id, "checkpoint-mission", phase.phase, "level.id");
    expectEqual(phase.mission.status, "playing", phase.phase, "mission.status");
    expectEqual(phase.mission.summary, null, phase.phase, "mission.summary");
  });
}

function createCampaignHarness() {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createCampaignGame();

  return {
    game,
    input,
    keydown(code) {
      target.dispatchEvent(createKeyEvent("keydown", code));
    },
    keyup(code) {
      target.dispatchEvent(createKeyEvent("keyup", code));
    },
    advance(seconds) {
      const steps = Math.ceil(seconds / stepSeconds);
      for (let index = 0; index < steps; index += 1) {
        this.advanceStep();
      }
    },
    advanceStep() {
      game.update(stepSeconds, input);
    }
  };
}

function createKeyEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  Object.defineProperty(event, "repeat", { value: false });
  return event;
}

function stateEvidence(harness, phase, extra = {}) {
  const debug = harness.game.debugState();
  const snapshot = harness.game.snapshot();

  return {
    phase,
    level: {
      id: debug.level.id,
      width: debug.level.width,
      height: debug.level.height
    },
    campaign: {
      currentLevelIndex: debug.currentLevelIndex,
      levelNumber: debug.currentLevelIndex + 1,
      levelCount: debug.levelCount,
      canAdvanceLevel: debug.canAdvanceLevel
    },
    mission: {
      status: debug.missionStatus,
      statusText: harness.game.statusText(harness.input),
      summary: debug.missionSummary
        ? {
            result: debug.missionSummary.result,
            levelId: debug.missionSummary.levelId,
            hpRemaining: debug.missionSummary.hpRemaining,
            maxHp: debug.missionSummary.maxHp,
            enemyBaseStatus: debug.missionSummary.enemyBaseStatus,
            enemiesDestroyed: debug.missionSummary.enemiesDestroyed,
            nextAction: debug.missionSummary.nextAction
          }
        : null
    },
    player: {
      gridX: snapshot.player.gridX,
      gridY: snapshot.player.gridY,
      toX: snapshot.player.toX,
      toY: snapshot.player.toY,
      visual: {
        x: Number(snapshot.player.visual.x.toFixed(3)),
        y: Number(snapshot.player.visual.y.toFixed(3))
      },
      facing: snapshot.player.facing,
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      isMoving: snapshot.player.isMoving,
      moveProgress: Number(snapshot.player.moveProgress.toFixed(3))
    },
    projectiles: {
      activeCount: debug.projectiles.length,
      cooldownRemaining: debug.cooldownRemaining
    },
    upgradeChoice: {
      pending: snapshot.upgradeChoice.pending,
      availableUpgradePoints: snapshot.upgradeChoice.availableUpgradePoints,
      choices: snapshot.upgradeChoice.choices.map((choice) => ({
        id: choice.id,
        rankLabel: choice.rankLabel,
        effectLabel: choice.effectLabel
      }))
    },
    progression: {
      xp: debug.progression.xp,
      level: debug.progression.level,
      availableUpgradePoints: debug.progression.availableUpgradePoints,
      appliedUpgrades: debug.progression.appliedUpgrades
    },
    targets: {
      enemyBase: enemyBaseEvidence(debug.targets),
      liveEnemyTanks: debug.targets.filter((target) => (
        target.team === "enemy"
        && target.type === "dummy"
        && target.alive
      )).length
    },
    ...extra
  };
}

function destroyEnemyBase(game) {
  const base = game.snapshot().targets.find((target) => (
    target.type === "base"
    && target.team === "enemy"
    && target.alive
  ));

  if (!base) {
    throw new Error("[phase:deterministic-victory] expected a live enemy base");
  }

  damageTarget(base, base.hp);
}

function enemyBaseEvidence(targets) {
  const base = targets.find((target) => target.type === "base" && target.team === "enemy");
  if (!base) {
    return null;
  }

  return {
    id: base.id,
    hp: base.hp,
    maxHp: base.maxHp,
    alive: base.alive,
    destroyed: base.destroyed
  };
}

function expectPhase(phase, phaseName, inspect) {
  if (phase?.phase !== phaseName) {
    throw new Error(`[phase:${phaseName}] expected phase marker ${phaseName}`);
  }
  inspect(phase);
}

function expectEqual(actual, expected, phase, field) {
  if (actual !== expected) {
    throw new Error(`[phase:${phase}] expected ${field} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectAtLeast(actual, minimum, phase, field) {
  if (actual < minimum) {
    throw new Error(`[phase:${phase}] expected ${field} to be at least ${minimum}, got ${actual}`);
  }
}

function expectIncludes(actual, expected, phase, field) {
  if (!String(actual).includes(expected)) {
    throw new Error(`[phase:${phase}] expected ${field} to include ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function valueAtPath(source, path) {
  return path.split(".").reduce((value, segment) => (
    value && typeof value === "object" ? value[segment] : undefined
  ), source);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`${JSON.stringify(createQaFirstDemoFlowEvidence(), null, 2)}\n`);
}
