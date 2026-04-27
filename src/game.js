import {
  getVisualPosition,
  createMovementState,
  requestMove,
  updateMovement
} from "./game/movement.js";
import {
  createCampaignMission,
  createTestMission,
  getCampaignLevelCount,
  isBlockedCell,
  validateCampaignMissions,
  validatePlayerSpawn
} from "./game/level.js";
import {
  FIRE_COOLDOWN_SECONDS,
  PROJECTILE_SPEED_CELLS_PER_SECOND,
  createProjectileStore,
  spawnPointFromTank,
  tryFireProjectile,
  updateProjectileStore
} from "./game/projectiles.js";
import {
  ENEMY_BASE_HP,
  PROJECTILE_DAMAGE,
  damageTarget,
  findTargetHitOnSegment,
  isEnemyBaseDestroyed,
  isSolidEntityAt
} from "./game/targets.js";
import {
  ENEMY_FIRE_COOLDOWN_SECONDS,
  ENEMY_FIRE_WINDUP_SECONDS,
  ENEMY_PROJECTILE_DAMAGE,
  ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
  PLAYER_DAMAGE_FLASH_SECONDS,
  PLAYER_MAX_HP,
  PLAYER_INVULNERABILITY_SECONDS
} from "./game/combatTuning.js";
import { updateEnemySentries } from "./game/sentries.js";
import { getPatrolVisualPosition, updateEnemyPatrols } from "./game/patrols.js";
import { getPursuitVisualPosition, updateEnemyPursuit } from "./game/pursuit.js";
import { validateMissionSpawn } from "./game/spawnValidation.js";

const tileSize = 48;

export function createCampaignGame(options = {}) {
  validateCampaignMissions();

  const levelCount = getCampaignLevelCount();
  let currentLevelIndex = normalizeLevelIndex(options.levelIndex ?? 0, levelCount);
  let levelGame = createLevelGame(options, currentLevelIndex);

  function currentStatus() {
    const missionStatus = levelGame.snapshot().missionStatus;
    if (missionStatus === "won" && currentLevelIndex === levelCount - 1) {
      return "campaign-complete";
    }
    return missionStatus;
  }

  return {
    update(deltaSeconds, input) {
      levelGame.update(deltaSeconds, input);
    },

    snapshot() {
      return addCampaignState(levelGame.snapshot(), currentLevelIndex, levelCount, currentStatus());
    },

    statusText(input) {
      const status = currentStatus();
      if (status === "campaign-complete") {
        return `Campaign complete - Level ${currentLevelIndex + 1}/${levelCount} - Press R to replay the final level.`;
      }

      const nextText = status === "won" && currentLevelIndex < levelCount - 1
        ? " Press N or Enter for next level."
        : "";
      return `Level ${currentLevelIndex + 1}/${levelCount} - ${levelGame.statusText(input)}${nextText}`;
    },

    debugState() {
      return addCampaignState(levelGame.debugState(), currentLevelIndex, levelCount, currentStatus());
    },

    restartLevel() {
      levelGame = createLevelGame(options, currentLevelIndex);
    },

    advanceLevel() {
      if (currentStatus() !== "won" || currentLevelIndex >= levelCount - 1) {
        return false;
      }

      currentLevelIndex += 1;
      levelGame = createLevelGame(options, currentLevelIndex);
      return true;
    }
  };
}

export function createGame(options = {}) {
  const testMission = options.level && options.targets ? null : createTestMission();
  const level = options.level ?? testMission.level;
  validatePlayerSpawn(level);

  const player = createMovementState({
    gridX: options.playerSpawn?.x ?? level.playerSpawn.x,
    gridY: options.playerSpawn?.y ?? level.playerSpawn.y,
    facing: options.facing ?? "right",
    speedCellsPerSecond: options.speedCellsPerSecond ?? 4
  });

  const playerTeam = "player";
  const targets = options.targets ?? testMission.targets;
  if (options.validateSpawn !== false) {
    validateMissionSpawn(level, { x: player.gridX, y: player.gridY }, targets, isBlockedCell);
  }
  const isBlocked = (x, y) => isBlockedCell(level, x, y);
  const isSolid = (x, y) => isBlocked(x, y) || isSolidEntityAt(targets, x, y);
  const canEnter = (x, y) => !isBlocked(x, y);
  const projectiles = createProjectileStore();
  const canEnterWithEntities = (x, y) => !isSolid(x, y);
  const playerState = {
    hp: options.playerHp ?? PLAYER_MAX_HP,
    maxHp: options.playerMaxHp ?? PLAYER_MAX_HP,
    damageFlashSeconds: 0,
    invulnerabilityRemaining: 0
  };
  let missionStatus = "playing";
  let lastShotAccepted = false;

  return {
    update(deltaSeconds, input) {
      lastShotAccepted = false;
      if (missionStatus === "won" || missionStatus === "lost") {
        updateProjectileStore(projectiles, deltaSeconds, isBlocked);
        input.consumeMoveDirection();
        input.consumeShootIntent();
        return;
      }

      playerState.damageFlashSeconds = Math.max(0, playerState.damageFlashSeconds - deltaSeconds);
      playerState.invulnerabilityRemaining = Math.max(
        0,
        playerState.invulnerabilityRemaining - deltaSeconds
      );
      const wasMoving = player.isMoving;
      updateMovement(player, deltaSeconds, canEnterWithEntities);
      const justFinishedMove = wasMoving && !player.isMoving;
      updateEnemyPursuit({
        level,
        entities: targets,
        player,
        deltaSeconds,
        isBlockedCell
      });
      updateEnemyPatrols({
        level,
        entities: targets,
        player,
        deltaSeconds,
        isBlockedCell
      });
      updateEnemySentries({
        level,
        entities: targets,
        player,
        projectileStore: projectiles,
        deltaSeconds
      });
      updateProjectileStore(projectiles, deltaSeconds, isBlocked, (fromX, fromY, toX, toY, projectile) => {
        if (projectile.team === "enemy" && segmentHitsPlayer(fromX, fromY, toX, toY, player)) {
          if (playerState.invulnerabilityRemaining <= 0) {
            playerState.hp = Math.max(0, playerState.hp - ENEMY_PROJECTILE_DAMAGE);
            playerState.invulnerabilityRemaining = PLAYER_INVULNERABILITY_SECONDS;
          }
          playerState.damageFlashSeconds = PLAYER_DAMAGE_FLASH_SECONDS;
          const visual = getVisualPosition(player);
          return {
            x: visual.x + 0.5,
            y: visual.y + 0.5,
            player
          };
        }

        const target = findTargetHitOnSegment(
          targets,
          fromX,
          fromY,
          toX,
          toY,
          projectile.team
        );
        if (!target) {
          return null;
        }

        damageTarget(target, PROJECTILE_DAMAGE);
        return {
          x: target.gridX + 0.5,
          y: target.gridY + 0.5,
          target
        };
      });

      if (playerState.hp <= 0) {
        missionStatus = "lost";
        input.consumeMoveDirection();
        input.consumeShootIntent();
        return;
      }

      if (isEnemyBaseDestroyed(targets)) {
        missionStatus = "won";
        input.consumeMoveDirection();
        input.consumeShootIntent();
        return;
      }

      const moveIntent = input.consumeMoveDirection();
      if (moveIntent) {
        requestMove(player, moveIntent, canEnterWithEntities);
      } else if (!player.isMoving && !justFinishedMove) {
        const heldDirection = input.getHeldMoveDirection();
        if (heldDirection) {
          requestMove(player, heldDirection, canEnterWithEntities);
        }
      }

      if (input.consumeShootIntent()) {
        lastShotAccepted = tryFireProjectile(
          projectiles,
          spawnPointFromTank({
            ...player,
            visual: getVisualPosition(player)
          })
        );
      }
    },

    snapshot() {
      const state = {
        level,
        player: {
          ...player,
          visual: getVisualPosition(player),
          hp: playerState.hp,
          maxHp: playerState.maxHp,
          damageFlashSeconds: playerState.damageFlashSeconds,
          invulnerabilityRemaining: playerState.invulnerabilityRemaining
        },
        projectiles: projectiles.projectiles,
        impacts: projectiles.impacts,
        targets: targets.map(addTargetVisual),
        missionStatus,
        cooldownRemaining: projectiles.cooldownRemaining,
        tileSize
      };
      return {
        ...state,
        missionSummary: createMissionSummary({
          ...state,
          levelNumber: 1,
          levelCount: 1,
          canAdvanceLevel: false
        })
      };
    },

    statusText(input) {
      const cooldownMs = Math.ceil(projectiles.cooldownRemaining * 1000);
      const shotText = lastShotAccepted
        ? "Shell fired."
        : `Space: fire shell (${Math.round(FIRE_COOLDOWN_SECONDS * 1000)}ms cooldown).`;
      const cooldownText = cooldownMs > 0 ? ` Cooldown ${cooldownMs}ms.` : "";
      const base = targets.find((target) => target.type === "base" && target.team === "enemy");
      const liveEnemyTanks = targets.filter((target) => (
        target.type === "dummy"
        && target.team === "enemy"
        && target.alive
      )).length;
      const baseText = base ? ` Enemy base HP ${base.hp}/${ENEMY_BASE_HP}.` : "";
      const aimingEnemy = targets.find((target) => (
        target.alive
        && target.aimDirection
        && (target.aimRemainingSeconds ?? 0) > 0
      ));
      const aimText = aimingEnemy
        ? ` Sentry warning ${Math.ceil(aimingEnemy.aimRemainingSeconds * 1000)}ms.`
        : "";
      const invulnerabilityText = playerState.invulnerabilityRemaining > 0
        ? ` Invulnerable ${Math.ceil(playerState.invulnerabilityRemaining * 1000)}ms.`
        : "";
      return `Mission ${missionStatus} - HP ${playerState.hp}/${playerState.maxHp} - Cell ${player.gridX}, ${player.gridY} - Facing ${player.facing} - Enemy tanks ${liveEnemyTanks}. ${shotText}${cooldownText}${baseText}${aimText}${invulnerabilityText}`;
    },

    debugState() {
      const state = {
        coordinateSystem: "grid units, origin top-left, x right, y down",
        level: {
          id: level.id,
          width: level.width,
          height: level.height
        },
        player: {
          gridX: player.gridX,
          gridY: player.gridY,
          facing: player.facing,
          visual: getVisualPosition(player),
          isMoving: player.isMoving,
          moveProgress: player.moveProgress,
          team: playerTeam,
          type: "tank",
          hp: playerState.hp,
          maxHp: playerState.maxHp,
          damageFlashSeconds: Number(playerState.damageFlashSeconds.toFixed(3)),
          invulnerabilityRemaining: Number(playerState.invulnerabilityRemaining.toFixed(3))
        },
        projectiles: projectiles.projectiles
          .filter((projectile) => projectile.active)
          .map((projectile) => ({
            x: Number(projectile.x.toFixed(3)),
            y: Number(projectile.y.toFixed(3)),
            direction: projectile.direction,
            team: projectile.team
          })),
        targets: targets.map(createDebugTargetSnapshot),
        missionStatus,
        cooldownRemaining: Number(projectiles.cooldownRemaining.toFixed(3)),
        projectileSpeedCellsPerSecond: PROJECTILE_SPEED_CELLS_PER_SECOND,
        combatTuning: {
          enemyProjectileDamage: ENEMY_PROJECTILE_DAMAGE,
          enemyProjectileSpeedCellsPerSecond: ENEMY_PROJECTILE_SPEED_CELLS_PER_SECOND,
          enemyFireCooldownSeconds: ENEMY_FIRE_COOLDOWN_SECONDS,
          enemyFireWindupSeconds: ENEMY_FIRE_WINDUP_SECONDS,
          playerInvulnerabilitySeconds: PLAYER_INVULNERABILITY_SECONDS,
          playerDamageFlashSeconds: PLAYER_DAMAGE_FLASH_SECONDS
        }
      };
      return {
        ...state,
        missionSummary: createMissionSummary({
          level,
          player: state.player,
          targets,
          missionStatus,
          levelNumber: 1,
          levelCount: 1,
          canAdvanceLevel: false
        })
      };
    }
  };
}

function createLevelGame(options, levelIndex) {
  const mission = createCampaignMission(levelIndex);
  const {
    level,
    targets,
    playerSpawn,
    ...gameOptions
  } = options;

  return createGame({
    ...gameOptions,
    level: mission.level,
    targets: mission.targets,
    playerSpawn: mission.level.playerSpawn
  });
}

function addTargetVisual(target) {
  target.visual = target.isPursuing
    ? getPursuitVisualPosition(target)
    : getPatrolVisualPosition(target);
  return target;
}

function createDebugTargetSnapshot(target) {
  const visual = target.isPursuing
    ? getPursuitVisualPosition(target)
    : getPatrolVisualPosition(target);
  return {
    id: target.id,
    type: target.type,
    team: target.team,
    gridX: target.gridX,
    gridY: target.gridY,
    visual,
    facing: target.facing ?? "up",
    hp: target.hp,
    maxHp: target.maxHp,
    alive: target.alive,
    destroyed: target.destroyed,
    solid: target.solid,
    patrolRoute: target.patrolRoute ?? null,
    patrolTargetIndex: target.patrolTargetIndex ?? null,
    isPatrolling: target.isPatrolling ?? false,
    patrolProgress: Number((target.patrolProgress ?? 0).toFixed(3)),
    pursuitTarget: target.pursuitTarget ?? null,
    isPursuing: target.isPursuing ?? false,
    pursuitProgress: Number((target.pursuitProgress ?? 0).toFixed(3)),
    fireCooldownRemaining: Number((target.fireCooldownRemaining ?? 0).toFixed(3)),
    aimDirection: target.aimDirection ?? null,
    aimRemainingSeconds: Number((target.aimRemainingSeconds ?? 0).toFixed(3))
  };
}

function normalizeLevelIndex(levelIndex, levelCount) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= levelCount) {
    throw new Error(`Invalid campaign level index ${levelIndex}.`);
  }

  return levelIndex;
}

function addCampaignState(state, currentLevelIndex, levelCount, missionStatus) {
  const campaignState = {
    ...state,
    missionStatus,
    currentLevelIndex,
    levelNumber: currentLevelIndex + 1,
    levelCount,
    canAdvanceLevel: missionStatus === "won" && currentLevelIndex < levelCount - 1
  };
  return {
    ...campaignState,
    missionSummary: createMissionSummary(campaignState)
  };
}

export function createMissionSummary({
  missionStatus,
  level,
  player,
  targets,
  levelNumber = 1,
  levelCount = 1,
  canAdvanceLevel = false
}) {
  if (missionStatus !== "won" && missionStatus !== "lost" && missionStatus !== "campaign-complete") {
    return null;
  }

  const enemyBase = targets.find((target) => target.type === "base" && target.team === "enemy");
  const hpRemaining = player.hp;
  const maxHp = player.maxHp;
  const enemiesDestroyed = targets.filter((target) => (
    target.team === "enemy"
    && target.type !== "base"
    && target.destroyed
  )).length;

  if (missionStatus === "campaign-complete") {
    return {
      result: "campaign complete",
      title: "Campaign complete",
      levelLabel: `Level ${levelNumber}/${levelCount}`,
      levelId: level?.id ?? null,
      hpRemaining,
      maxHp,
      enemyBaseStatus: describeEnemyBase(enemyBase),
      enemiesDestroyed,
      failureReason: null,
      nextAction: "Press R to replay the final level"
    };
  }

  if (missionStatus === "lost") {
    return {
      result: "failed",
      title: "Mission failed",
      levelLabel: `Level ${levelNumber}/${levelCount}`,
      levelId: level?.id ?? null,
      hpRemaining,
      maxHp,
      enemyBaseStatus: describeEnemyBase(enemyBase),
      enemiesDestroyed,
      failureReason: "Player tank destroyed",
      nextAction: "Press R to restart current level"
    };
  }

  return {
    result: "victory",
    title: "Mission complete",
    levelLabel: `Level ${levelNumber}/${levelCount}`,
    levelId: level?.id ?? null,
    hpRemaining,
    maxHp,
    enemyBaseStatus: describeEnemyBase(enemyBase),
    enemiesDestroyed,
    failureReason: null,
    nextAction: canAdvanceLevel
      ? "Press N or Enter for next level"
      : "Press R to replay the final level"
  };
}

function describeEnemyBase(enemyBase) {
  if (!enemyBase) {
    return "No enemy base";
  }

  if (enemyBase.destroyed) {
    return "Destroyed";
  }

  return `HP ${enemyBase.hp}/${enemyBase.maxHp}`;
}

function segmentHitsPlayer(fromX, fromY, toX, toY, player) {
  const visual = getVisualPosition(player);
  const gridX = Math.floor(visual.x);
  const gridY = Math.floor(visual.y);

  if (fromY === toY && fromY >= gridY && fromY < gridY + 1) {
    return (toX > fromX && fromX < gridX + 1 && toX >= gridX)
      || (toX < fromX && fromX >= gridX && toX < gridX + 1);
  }

  if (fromX === toX && fromX >= gridX && fromX < gridX + 1) {
    return (toY > fromY && fromY < gridY + 1 && toY >= gridY)
      || (toY < fromY && fromY >= gridY && toY < gridY + 1);
  }

  return false;
}
