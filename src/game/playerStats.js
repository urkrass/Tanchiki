import {
  PLAYER_MAX_HP,
  PLAYER_MIN_FIRE_COOLDOWN_SECONDS
} from "./combatTuning.js";
import {
  FIRE_COOLDOWN_SECONDS,
  PROJECTILE_MAX_RANGE_CELLS,
  PROJECTILE_SPEED_CELLS_PER_SECOND
} from "./projectiles.js";
import {
  calculateProgressionEffects,
  createProgressionState,
  derivePlayerDefensiveStats
} from "./progression.js";

export function createPlayerCombatStats(progressionState) {
  const effects = calculateProgressionEffects(progressionState);
  return {
    speedCellsPerSecond: PROJECTILE_SPEED_CELLS_PER_SECOND,
    maxRangeCells: PROJECTILE_MAX_RANGE_CELLS + effects.projectileMaxRangeCells,
    cooldownSeconds: Math.max(
      PLAYER_MIN_FIRE_COOLDOWN_SECONDS,
      FIRE_COOLDOWN_SECONDS + effects.fireCooldownSeconds
    ),
    team: "player"
  };
}

export function createPlayerStateFromProgression(options = {}) {
  const progression = createProgressionState(options.progression);
  const effectiveStats = derivePlayerDefensiveStats(progression, {
    maxHp: options.playerMaxHp ?? PLAYER_MAX_HP
  });

  return {
    progression,
    effectiveStats,
    playerState: {
      hp: Math.min(options.playerHp ?? effectiveStats.maxHp, effectiveStats.maxHp),
      maxHp: effectiveStats.maxHp,
      repairAmountBonus: effectiveStats.repairAmountBonus,
      ammoReserve: options.ammoReserve ?? 0,
      shieldCharges: options.shieldCharges ?? 0,
      damageFlashSeconds: 0,
      invulnerabilityRemaining: 0
    }
  };
}
