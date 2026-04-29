export function renderUpgradePanel({
  panel,
  contextElement = null,
  choicesContainer,
  snapshot
}) {
  const choices = snapshot.upgradeChoice?.choices ?? [];
  if (!snapshot.upgradeChoice?.pending || choices.length === 0) {
    panel.hidden = true;
    if (contextElement) {
      contextElement.textContent = "";
    }
    choicesContainer.replaceChildren();
    return;
  }

  panel.hidden = false;
  if (contextElement) {
    contextElement.textContent = describeUpgradePanelContext(snapshot);
  }
  choicesContainer.replaceChildren(...choices.map(createUpgradeChoiceButton));
}

export function describeUpgradePanelContext(snapshot) {
  const rewardText = formatRewardText(snapshot);
  const pointText = formatPointText(snapshot);
  const levelText = `Level ${nextLevelNumber(snapshot)}`;
  const prefix = [rewardText, pointText].filter(Boolean).join(" and ");

  if (prefix) {
    return `${prefix}. Pick one upgrade now; it starts on ${levelText}.`;
  }

  return `Pick one upgrade now; it starts on ${levelText}.`;
}

export function upgradeChoiceIndexForKey(code) {
  if (code === "Digit1" || code === "Numpad1") {
    return 0;
  }
  if (code === "Digit2" || code === "Numpad2") {
    return 1;
  }
  if (code === "Digit3" || code === "Numpad3") {
    return 2;
  }
  return null;
}

function formatRewardText(snapshot) {
  const xp = snapshot.lastMissionReward?.xp;
  return Number.isFinite(xp) ? `Earned +${xp} XP` : "";
}

function formatPointText(snapshot) {
  const points = snapshot.upgradeChoice?.availableUpgradePoints
    ?? snapshot.progression?.availableUpgradePoints
    ?? 0;

  if (points <= 0) {
    return "";
  }

  return points === 1 ? "1 upgrade point" : `${points} upgrade points`;
}

function nextLevelNumber(snapshot) {
  if (Number.isFinite(snapshot.levelNumber)) {
    return snapshot.levelNumber + 1;
  }

  if (Number.isFinite(snapshot.currentLevelIndex)) {
    return snapshot.currentLevelIndex + 2;
  }

  return 2;
}

function createUpgradeChoiceButton(choice, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "upgrade-choice";
  button.dataset.upgradeId = choice.id;
  button.setAttribute(
    "aria-label",
    `${choice.label}, ${choice.rankLabel ?? `rank ${choice.nextRank} of ${choice.maxRank}`}, ${choice.effectLabel ?? choice.description}`
  );

  const key = document.createElement("span");
  key.className = "upgrade-choice__key";
  key.textContent = String(index + 1);

  const content = document.createElement("span");
  content.className = "upgrade-choice__content";

  const title = document.createElement("span");
  title.className = "upgrade-choice__title";
  title.textContent = choice.label;

  const meta = document.createElement("span");
  meta.className = "upgrade-choice__meta";
  meta.textContent = choice.rankLabel ?? `Rank ${choice.nextRank}/${choice.maxRank}`;

  const effect = document.createElement("span");
  effect.className = "upgrade-choice__effect";
  effect.textContent = choice.effectLabel ?? "";

  const description = document.createElement("span");
  description.className = "upgrade-choice__description";
  description.textContent = choice.description;

  content.append(title, meta, effect, description);
  button.append(key, content);
  return button;
}
