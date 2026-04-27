export function renderGame(context, snapshot) {
  const { level, player, projectiles, impacts, targets, missionSummary, tileSize } = snapshot;
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
  drawTargets(context, targets, tileSize);
  drawProjectiles(context, projectiles, tileSize);
  drawImpacts(context, impacts, tileSize);
  drawTank(context, player, tileSize);
  drawMissionSummary(context, missionSummary, width, height);
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

function drawTank(context, player, tileSize) {
  const centerX = (player.visual.x + 0.5) * tileSize;
  const centerY = (player.visual.y + 0.5) * tileSize;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotationFor(player.facing));

  context.fillStyle = player.damageFlashSeconds > 0 ? "#d9c56f" : "#345f3c";
  context.fillRect(-15, -18, 30, 36);
  context.fillStyle = "#243d2a";
  context.fillRect(-19, -16, 7, 32);
  context.fillRect(12, -16, 7, 32);
  context.fillStyle = "#d9c56f";
  context.fillRect(-5, -28, 10, 24);
  context.fillStyle = "#263728";
  context.fillRect(-9, -10, 18, 18);

  context.restore();
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

function drawTargets(context, targets, tileSize) {
  for (const target of targets) {
    const visual = entityVisual(target);
    const centerX = (visual.x + 0.5) * tileSize;
    const centerY = (visual.y + 0.5) * tileSize;

    context.save();
    context.translate(centerX, centerY);
    if (target.type !== "base") {
      context.rotate(rotationFor(target.facing ?? "up"));
    }
    const size = target.type === "base" ? 40 : 32;
    context.fillStyle = target.alive ? colorForTarget(target) : "#5a554c";
    context.fillRect(-size / 2, -size / 2, size, size);
    context.strokeStyle = target.alive ? "#40221f" : "#39362f";
    context.lineWidth = 4;
    context.strokeRect(-size / 2, -size / 2, size, size);
    context.fillStyle = target.alive ? "#d9c56f" : "#777166";
    context.fillRect(-5, target.type === "base" ? -31 : -25, 10, target.type === "base" ? 20 : 16);

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
  }
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

function drawMissionSummary(context, summary, width, height) {
  if (!summary) {
    return;
  }

  const panelWidth = Math.min(width - 72, 520);
  const panelHeight = summary.failureReason ? 268 : 244;
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

function drawProjectiles(context, projectiles, tileSize) {
  for (const projectile of projectiles) {
    if (!projectile.active) {
      continue;
    }

    const x = projectile.x * tileSize;
    const y = projectile.y * tileSize;

    context.save();
    context.translate(x, y);
    context.rotate(rotationFor(projectile.direction));
    context.fillStyle = projectile.team === "enemy" ? "#a6342f" : "#1f241d";
    context.fillRect(-4, -10, 8, 20);
    context.fillStyle = projectile.team === "enemy" ? "#f0b06a" : "#e7d37c";
    context.fillRect(-3, -13, 6, 5);
    context.restore();
  }
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
