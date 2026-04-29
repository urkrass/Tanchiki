import { createProgressionFeedback } from "./game/progressionFeedback.js";
import { targetReadabilityCue } from "./game/readability.js";
import { drawManifestSprite } from "./assets/spriteRenderer.js";

export function renderGame(context, snapshot, renderOptions = {}) {
  const spriteAssets = renderOptions.spriteAssets ?? null;

  const { level, player, pickups, projectiles, impacts, targets, missionSummary, tileSize } = snapshot;
  const width = level.width * tileSize;
  const height = level.height * tileSize;

  if (context.canvas.width !== width || context.canvas.height !== height) {
    context.canvas.width = width;
    context.canvas.height = height;
  }
  context.clearRect(0, 0, width, height);

  drawFloor(context, width, height);
  drawTiles(context, level, tileSize);
  drawGrid(context, level, tileSize);
  drawAimWarnings(context, targets, player, tileSize);
  drawPickups(context, pickups, tileSize, spriteAssets);
  drawTargets(context, targets, tileSize, spriteAssets);
  drawProjectiles(context, projectiles, tileSize, spriteAssets);
  drawImpacts(context, impacts, tileSize);
  drawTank(context, player, tileSize, spriteAssets);
  drawMissionSummary(context, missionSummary, createProgressionFeedback(snapshot), width, height);
}

function drawPickups(context, pickups = [], tileSize, spriteAssets = null) {
  for (const pickup of pickups) {
    if (!pickup.active) {
      continue;
    }

    const centerX = (pickup.gridX + 0.5) * tileSize;
    const centerY = (pickup.gridY + 0.5) * tileSize;

    context.save();
    context.translate(centerX, centerY);
    if (drawManifestSprite(
      context,
      spriteAssets?.getFrame(spriteIdForPickup(pickup), "idle", "any"),
      tileSize
    )) {
      context.restore();
      continue;
    }

    context.fillStyle = pickupColor(pickup.type);
    context.fillRect(-13, -13, 26, 26);
    context.strokeStyle = "#2f342d";
    context.lineWidth = 3;
    context.strokeRect(-13, -13, 26, 26);
    context.fillStyle = "#f7f4ea";
    context.font = "700 18px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(pickupGlyph(pickup.type), 0, -1);
    context.restore();
  }
}

function spriteIdForPickup(pickup) {
  if (pickup.type === "repair") {
    return "repair_pickup";
  }
  if (pickup.type === "ammo") {
    return "ammo_pickup";
  }
  return "shield_pickup";
}

function pickupColor(type) {
  if (type === "repair") {
    return "#4f7f58";
  }
  if (type === "ammo") {
    return "#8a6a2f";
  }
  return "#3f6f8f";
}

function pickupGlyph(type) {
  if (type === "repair") {
    return "+";
  }
  if (type === "ammo") {
    return "A";
  }
  return "S";
}

function drawFloor(context, width, height) {
  context.fillStyle = "#edf0e6";
  context.fillRect(0, 0, width, height);
}

function drawTiles(context, level, tileSize) {
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (level.tiles[y][x] === "#") {
        drawWall(context, x, y, tileSize);
      }
    }
  }
}

function drawWall(context, x, y, tileSize) {
  const px = x * tileSize;
  const py = y * tileSize;

  context.fillStyle = "#596051";
  context.fillRect(px, py, tileSize, tileSize);
  context.fillStyle = "#707767";
  context.fillRect(px + 5, py + 5, tileSize - 10, tileSize - 10);
}

function drawGrid(context, level, tileSize) {
  context.strokeStyle = "rgba(57, 64, 48, 0.22)";
  context.lineWidth = 1;

  for (let x = 0; x <= level.width; x += 1) {
    context.beginPath();
    context.moveTo(x * tileSize + 0.5, 0);
    context.lineTo(x * tileSize + 0.5, level.height * tileSize);
    context.stroke();
  }

  for (let y = 0; y <= level.height; y += 1) {
    context.beginPath();
    context.moveTo(0, y * tileSize + 0.5);
    context.lineTo(level.width * tileSize, y * tileSize + 0.5);
    context.stroke();
  }
}

function drawTank(context, player, tileSize, spriteAssets = null) {
  const centerX = (player.visual.x + 0.5) * tileSize;
  const centerY = (player.visual.y + 0.5) * tileSize;

  context.save();
  context.translate(centerX, centerY);
  if (player.damageFlashSeconds <= 0 && drawManifestSprite(
    context,
    spriteAssets?.getFrame("player_tank", "idle", player.facing),
    tileSize
  )) {
    context.restore();
    return;
  }

  context.rotate(rotationFor(player.facing));
  drawPlayerTankPrimitive(context, player.damageFlashSeconds > 0);

  context.restore();
}

function drawPlayerTankPrimitive(context, isFlashing) {
  context.fillStyle = "#243d2a";
  context.fillRect(-20, -15, 8, 30);
  context.fillRect(12, -15, 8, 30);
  context.fillStyle = isFlashing ? "#d9c56f" : "#345f3c";
  context.fillRect(-14, -18, 28, 34);
  context.strokeStyle = "#1f2d22";
  context.lineWidth = 3;
  context.strokeRect(-14, -18, 28, 34);
  context.fillStyle = isFlashing ? "#f1dfa2" : "#467c50";
  context.fillRect(-10, -15, 20, 26);
  context.fillStyle = "#d9c56f";
  context.fillRect(-4, -31, 8, 28);
  context.fillStyle = "#263728";
  context.fillRect(-9, -10, 18, 18);
  context.fillStyle = "#e6d184";
  context.beginPath();
  context.moveTo(0, -22);
  context.lineTo(8, -14);
  context.lineTo(-8, -14);
  context.fill();
}

function drawAimWarnings(context, targets, player, tileSize) {
  const playerCenterX = (player.visual.x + 0.5) * tileSize;
  const playerCenterY = (player.visual.y + 0.5) * tileSize;

  for (const target of targets) {
    if (!target.alive || !target.aimDirection || (target.aimRemainingSeconds ?? 0) <= 0) {
      continue;
    }

    const visual = entityVisual(target);
    const centerX = (visual.x + 0.5) * tileSize;
    const centerY = (visual.y + 0.5) * tileSize;
    const alpha = target.aimRemainingSeconds % 0.16 > 0.08 ? 0.75 : 0.35;

    context.strokeStyle = `rgba(166, 52, 47, ${alpha})`;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(playerCenterX, playerCenterY);
    context.stroke();
  }
}

function drawTargets(context, targets, tileSize, spriteAssets = null) {
  for (const target of targets) {
    const visual = entityVisual(target);
    const centerX = (visual.x + 0.5) * tileSize;
    const centerY = (visual.y + 0.5) * tileSize;
    const size = target.type === "base" ? 40 : 32;

    context.save();
    context.translate(centerX, centerY);
    const spriteDrawn = drawManifestSprite(
      context,
      spriteAssets?.getFrame(spriteIdForTarget(target), "idle", target.facing ?? "up"),
      tileSize
    );

    if (!spriteDrawn && target.type !== "base") {
      context.rotate(rotationFor(target.facing ?? "up"));
    }

    if (!spriteDrawn) {
      drawTargetPrimitive(context, target);
    }

    if (target.alive) {
      const hpRatio = target.hp / target.maxHp;
      context.fillStyle = "#2e2f27";
      context.fillRect(-size / 2, size / 2 + 4, size, 5);
      context.fillStyle = "#e0b64d";
      context.fillRect(-size / 2, size / 2 + 4, size * hpRatio, 5);
    } else {
      context.strokeStyle = "#2e2f27";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-12, -12);
      context.lineTo(12, 12);
      context.moveTo(12, -12);
      context.lineTo(-12, 12);
      context.stroke();
    }

    context.restore();

    drawTargetCue(context, target, centerX, centerY, size);
  }
}

function spriteIdForTarget(target) {
  if (!target.alive) {
    return target.type === "base" ? "destroyed_base" : "destroyed_tank";
  }

  if (target.type === "base") {
    return "enemy_base";
  }

  if (target.pursuitTarget === "player") {
    return "pursuit_tank";
  }

  if (Array.isArray(target.patrolRoute)) {
    return "patrol_tank";
  }

  return "sentry_tank";
}

function drawTargetPrimitive(context, target) {
  if (!target.alive) {
    drawWreckPrimitive(context, target.type === "base");
    return;
  }

  if (target.type === "base") {
    drawBasePrimitive(context);
    return;
  }

  drawEnemyTankPrimitive(context, target);
}

function drawEnemyTankPrimitive(context, target) {
  const bodyColor = colorForTarget(target);

  context.fillStyle = "#552820";
  context.fillRect(-18, -13, 7, 26);
  context.fillRect(11, -13, 7, 26);
  context.fillStyle = bodyColor;
  context.beginPath();
  context.moveTo(0, -18);
  context.lineTo(14, -12);
  context.lineTo(14, 14);
  context.lineTo(-14, 14);
  context.lineTo(-14, -12);
  context.fill();
  context.strokeStyle = "#40221f";
  context.lineWidth = 3;
  context.strokeRect(-13, -13, 26, 27);
  context.fillStyle = "#b55347";
  context.fillRect(-9, -10, 18, 20);
  context.fillStyle = "#d9c56f";
  context.fillRect(-3, -26, 6, 22);
  context.fillStyle = "#40221f";
  context.fillRect(-8, -6, 16, 12);
  context.fillStyle = "#e0b64d";
  context.fillRect(-6, -17, 12, 3);
}

function drawBasePrimitive(context) {
  context.fillStyle = "#39201c";
  context.fillRect(-22, 15, 44, 5);
  context.fillStyle = "#6f2f2b";
  context.fillRect(-21, -16, 42, 32);
  context.strokeStyle = "#40221f";
  context.lineWidth = 4;
  context.strokeRect(-21, -16, 42, 32);
  context.fillStyle = "#823832";
  context.fillRect(-16, -11, 32, 22);
  context.fillStyle = "#512520";
  context.fillRect(-13, -6, 26, 7);
  context.fillRect(-13, 5, 26, 5);
  context.fillStyle = "#d9c56f";
  context.fillRect(-5, -27, 10, 15);
  context.fillStyle = "#e0b64d";
  context.strokeStyle = "#d9c56f";
  context.lineWidth = 2;
  context.strokeRect(-10, -21, 20, 9);
}

function drawWreckPrimitive(context, isBase) {
  const size = isBase ? 40 : 32;
  context.fillStyle = "#5a554c";
  context.fillRect(-size / 2, -size / 2, size, size);
  context.strokeStyle = "#39362f";
  context.lineWidth = 4;
  context.strokeRect(-size / 2, -size / 2, size, size);
  context.fillStyle = "#777166";
  context.fillRect(-5, isBase ? -27 : -21, 10, isBase ? 16 : 12);
}

function drawTargetCue(context, target, centerX, centerY, size) {
  const cue = targetReadabilityCue(target);
  const badgeSize = 18;
  const x = centerX + (size / 2) - badgeSize + 5;
  const y = centerY - (size / 2) - 7;

  context.save();
  context.fillStyle = cue.fillStyle;
  context.fillRect(x, y, badgeSize, badgeSize);
  context.strokeStyle = "#2e2f27";
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, badgeSize - 1, badgeSize - 1);
  context.fillStyle = cue.textStyle;
  context.font = "800 12px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(cue.label, x + badgeSize / 2, y + badgeSize / 2 + 0.5);
  context.restore();
}

function entityVisual(entity) {
  return entity.visual ?? { x: entity.gridX, y: entity.gridY };
}

function colorForTarget(target) {
  if (target.type === "base") {
    return "#6f2f2b";
  }

  return "#8d3e34";
}

function drawMissionSummary(context, summary, progressionFeedback, width, height) {
  if (!summary) {
    return;
  }

  const progressionRows = progressionFeedback?.rows ?? [];
  const panelWidth = Math.min(width - 72, 520);
  const panelHeight = (summary.failureReason ? 268 : 244) + (progressionRows.length * 28);
  const panelX = (width - panelWidth) / 2;
  const panelY = (height - panelHeight) / 2;

  context.fillStyle = "rgba(247, 244, 234, 0.94)";
  context.fillRect(panelX, panelY, panelWidth, panelHeight);
  context.strokeStyle = "rgba(31, 36, 29, 0.22)";
  context.lineWidth = 2;
  context.strokeRect(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);

  context.fillStyle = "#1f241d";
  context.font = "700 30px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(summary.title, width / 2, panelY + 44);

  const rows = [
    ["Result", summary.result],
    ["Level", formatLevel(summary)],
    ["HP remaining", `${summary.hpRemaining}/${summary.maxHp}`],
    ["Enemy base", summary.enemyBaseStatus],
    ["Enemies destroyed", String(summary.enemiesDestroyed)]
  ];

  if (summary.failureReason) {
    rows.push(["Reason", summary.failureReason]);
  }
  rows.push(...progressionRows.map((row) => [row.label, row.value]));

  context.textAlign = "left";
  context.font = "15px system-ui, sans-serif";
  let rowY = panelY + 82;
  for (const [label, value] of rows) {
    drawSummaryRow(context, label, value, panelX + 54, panelX + 204, rowY);
    rowY += 28;
  }

  context.fillStyle = "#345f3c";
  context.font = "700 17px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(summary.nextAction, width / 2, panelY + panelHeight - 28);
}

function drawSummaryRow(context, label, value, labelX, valueX, y) {
  context.fillStyle = "rgba(31, 36, 29, 0.62)";
  context.font = "14px system-ui, sans-serif";
  context.fillText(label, labelX, y);
  context.fillStyle = "#1f241d";
  context.font = "600 15px system-ui, sans-serif";
  context.fillText(value, valueX, y);
}

function formatLevel(summary) {
  if (!summary.levelId) {
    return summary.levelLabel;
  }

  return `${summary.levelLabel} (${summary.levelId})`;
}

function drawProjectiles(context, projectiles, tileSize, spriteAssets = null) {
  for (const projectile of projectiles) {
    if (!projectile.active) {
      continue;
    }

    const x = projectile.x * tileSize;
    const y = projectile.y * tileSize;

    context.save();
    context.translate(x, y);
    if (drawManifestSprite(
      context,
      spriteAssets?.getFrame(spriteIdForProjectile(projectile), "shell", projectile.direction),
      tileSize
    )) {
      context.restore();
      continue;
    }

    context.rotate(rotationFor(projectile.direction));
    context.fillStyle = projectile.team === "enemy" ? "#a6342f" : "#1f241d";
    context.fillRect(-4, -10, 8, 20);
    context.fillStyle = projectile.team === "enemy" ? "#f0b06a" : "#e7d37c";
    context.fillRect(-3, -13, 6, 5);
    context.restore();
  }
}

function spriteIdForProjectile(projectile) {
  return projectile.team === "enemy" ? "enemy_shell" : "player_shell";
}

function drawImpacts(context, impacts, tileSize) {
  for (const impact of impacts) {
    if (!impact.active) {
      continue;
    }

    const progress = impact.ageSeconds / impact.durationSeconds;
    const radius = 5 + progress * 12;
    context.beginPath();
    context.arc(impact.x * tileSize, impact.y * tileSize, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(226, 178, 81, ${1 - progress})`;
    context.fill();
  }
}

function rotationFor(direction) {
  if (direction === "right") {
    return Math.PI / 2;
  }
  if (direction === "down") {
    return Math.PI;
  }
  if (direction === "left") {
    return -Math.PI / 2;
  }
  return 0;
}
