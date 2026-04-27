export function renderGame(context, snapshot) {
  const { level, player, projectiles, impacts, targets, missionStatus, tileSize } = snapshot;
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
  drawMissionMessage(context, missionStatus, width, height);
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

    const centerX = (target.gridX + 0.5) * tileSize;
    const centerY = (target.gridY + 0.5) * tileSize;
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
    const centerX = (target.gridX + 0.5) * tileSize;
    const centerY = (target.gridY + 0.5) * tileSize;

    context.save();
    context.translate(centerX, centerY);
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

function colorForTarget(target) {
  if (target.type === "base") {
    return "#6f2f2b";
  }

  return "#8d3e34";
}

function drawMissionMessage(context, missionStatus, width, height) {
  if (missionStatus !== "won" && missionStatus !== "lost") {
    return;
  }

  context.fillStyle = "rgba(247, 244, 234, 0.86)";
  context.fillRect(0, height / 2 - 48, width, 96);
  context.fillStyle = "#1f241d";
  context.font = "700 34px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(missionStatus === "won" ? "Mission complete" : "Mission failed", width / 2, height / 2 - 4);
  context.font = "16px system-ui, sans-serif";
  context.fillText(missionStatus === "won" ? "Enemy base destroyed" : "Player tank destroyed", width / 2, height / 2 + 26);
  context.fillText("Press R to restart", width / 2, height / 2 + 50);
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
