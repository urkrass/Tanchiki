import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createCampaignGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { createProgressionFeedback } from "../src/game/progressionFeedback.js";
import { damageTarget } from "../src/game/targets.js";
import { describeUpgradePanelContext } from "../src/upgradePanel.js";
import {
  listSpriteImages,
  normalizeSpriteManifest,
  validateSpriteManifest
} from "../src/assets/spriteManifest.js";

const stepSeconds = 1 / 60;
const requiredSnapshotPaths = [
  "schemaVersion",
  "flow.opening.level.id",
  "flow.opening.campaign.currentLevelIndex",
  "flow.opening.mission.status",
  "flow.opening.player.gridX",
  "flow.opening.player.gridY",
  "flow.opening.player.facing",
  "flow.opening.player.hp",
  "flow.opening.player.maxHp",
  "flow.opening.progression.xp",
  "flow.victory.mission.status",
  "flow.victory.mission.summary.nextAction",
  "flow.victory.mission.progressionFeedback.rows",
  "flow.victory.upgradeChoice.pending",
  "flow.victory.upgradeChoice.context",
  "flow.afterUpgrade.upgrade.applied",
  "flow.afterUpgrade.campaign.canAdvanceLevel",
  "flow.afterUpgrade.mission.progressionFeedback.rows",
  "flow.nextLevel.campaign.currentLevelIndex",
  "flow.nextLevel.mission.status",
  "spriteAssets.manifest.status"
];

export function createQaDemoSnapshot({
  manifestUrl = new URL("../assets/sprites/manifest.json", import.meta.url)
} = {}) {
  const harness = createCampaignHarness();
  const opening = stateEvidence(harness.game, harness.input);

  destroyEnemyBase(harness.game);
  harness.advanceStep();
  const victory = stateEvidence(harness.game, harness.input);
  const [firstChoice] = victory.upgradeChoice.choices;
  const upgrade = harness.game.applyUpgrade(firstChoice?.id);
  const afterUpgrade = stateEvidence(harness.game, harness.input, { upgrade });

  const advanced = harness.game.advanceLevel();
  const nextLevel = stateEvidence(harness.game, harness.input, { advanced });

  const snapshot = {
    schemaVersion: 1,
    generatedBy: "scripts/qa-demo-snapshot.js",
    purpose: "agent-visible deterministic Tanchiki demo QA evidence",
    flow: {
      opening,
      victory,
      afterUpgrade,
      nextLevel
    },
    spriteAssets: inspectSpriteManifest(manifestUrl)
  };

  assertQaDemoSnapshot(snapshot);
  return snapshot;
}

export function assertQaDemoSnapshot(snapshot) {
  const missing = requiredSnapshotPaths.filter((path) => valueAtPath(snapshot, path) === undefined);
  if (missing.length > 0) {
    throw new Error(`QA demo snapshot is missing required field(s): ${missing.join(", ")}`);
  }
}

function createCampaignHarness() {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createCampaignGame();

  return {
    game,
    input,
    advanceStep() {
      game.update(stepSeconds, input);
    }
  };
}

function stateEvidence(game, input, extra = {}) {
  const debug = game.debugState();
  const snapshot = game.snapshot();
  const progressionFeedback = createProgressionFeedback(snapshot);

  return {
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
      statusText: game.statusText(input),
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
        : null,
      progressionFeedback
    },
    player: {
      gridX: debug.player.gridX,
      gridY: debug.player.gridY,
      facing: debug.player.facing,
      hp: debug.player.hp,
      maxHp: debug.player.maxHp,
      isMoving: debug.player.isMoving,
      moveProgress: debug.player.moveProgress,
      ammoReserve: debug.player.ammoReserve,
      shieldCharges: debug.player.shieldCharges
    },
    progression: {
      xp: debug.progression.xp,
      level: debug.progression.level,
      availableUpgradePoints: debug.progression.availableUpgradePoints,
      appliedUpgrades: debug.progression.appliedUpgrades
    },
    upgradeChoice: {
      pending: snapshot.upgradeChoice.pending,
      availableUpgradePoints: snapshot.upgradeChoice.availableUpgradePoints,
      context: snapshot.upgradeChoice.pending
        ? describeUpgradePanelContext(snapshot)
        : "",
      choices: snapshot.upgradeChoice.choices.map((choice) => ({
        id: choice.id,
        rankLabel: choice.rankLabel,
        effectLabel: choice.effectLabel
      }))
    },
    projectiles: {
      activeCount: debug.projectiles.length,
      cooldownRemaining: debug.cooldownRemaining
    },
    targets: {
      liveEnemyTanks: debug.targets.filter((target) => (
        target.team === "enemy"
        && target.type === "dummy"
        && target.alive
      )).length,
      enemyBase: enemyBaseEvidence(debug.targets)
    },
    ...extra
  };
}

function inspectSpriteManifest(manifestUrl) {
  try {
    const rawManifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
    const errors = validateSpriteManifest(rawManifest);
    const manifest = normalizeSpriteManifest(rawManifest);
    return {
      manifest: {
        status: errors.length === 0 ? "ready" : "error",
        spriteCount: Object.keys(manifest.sheets).length,
        imageCount: listSpriteImages(manifest).length,
        errors
      },
      browserImagesLoaded: false,
      browserImagesLoadedReason: "Node snapshot validates manifest shape only; browser smoke covers image decode."
    };
  } catch (error) {
    return {
      manifest: {
        status: "error",
        spriteCount: 0,
        imageCount: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      },
      browserImagesLoaded: false,
      browserImagesLoadedReason: "Sprite manifest could not be read in Node snapshot."
    };
  }
}

function destroyEnemyBase(game) {
  const base = game.snapshot().targets.find((target) => (
    target.type === "base"
    && target.team === "enemy"
    && target.alive
  ));

  if (!base) {
    throw new Error("QA demo flow could not find a live enemy base to complete the mission.");
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

function valueAtPath(source, path) {
  return path.split(".").reduce((value, segment) => (
    value && typeof value === "object" ? value[segment] : undefined
  ), source);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`${JSON.stringify(createQaDemoSnapshot(), null, 2)}\n`);
}
