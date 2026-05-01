import { createProgressionFeedback } from "./game/progressionFeedback.js";

export function renderUpgradePanel({
  panel,
  contextElement = null,
  choicesContainer,
  summaryContainer = null,
  emptyElement = null,
  snapshot
}) {
  const choices = snapshot.upgradeChoice?.choices ?? [];
  const pending = Boolean(snapshot.upgradeChoice?.pending && choices.length > 0);
  const feedback = renderProgressionSummary(summaryContainer, snapshot);

  if (emptyElement) {
    emptyElement.hidden = pending || Boolean(feedback);
  }

  if (!pending) {
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

export function renderProgressionSummary(container, snapshot) {
  if (!container) {
    return null;
  }

  const feedback = createProgressionFeedback(snapshot);
  const rows = feedback?.rows ?? createProgressionRows(snapshot);
  container.hidden = rows.length === 0;
  container.replaceChildren(...rows.map(createProgressionRow));
  return feedback;
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

function createProgressionRows(snapshot) {
  const progression = snapshot.progression ?? {};
  const xp = progression.xp ?? 0;
  const availableUpgradePoints = progression.availableUpgradePoints ?? 0;
  const appliedUpgradeCount = Object.values(progression.appliedUpgrades ?? {})
    .reduce((total, rank) => total + rank, 0);

  if (xp <= 0 && availableUpgradePoints <= 0 && appliedUpgradeCount <= 0) {
    return [];
  }

  return [
    {
      label: "Campaign level",
      value: `Level ${progression.level ?? 1}`
    },
    {
      label: "XP",
      value: `${xp} XP`
    },
    {
      label: "Upgrade points",
      value: formatProgressionPoints(availableUpgradePoints)
    }
  ];
}

function createProgressionRow(row) {
  const item = document.createElement("p");
  item.className = "progression-summary__row";

  const label = document.createElement("span");
  label.className = "progression-summary__label";
  label.textContent = row.label;

  const value = document.createElement("strong");
  value.className = "progression-summary__value";
  value.textContent = row.value;

  item.append(label, value);
  return item;
}

function formatProgressionPoints(points) {
  if (points <= 0) {
    return "None available";
  }

  return points === 1 ? "1 point available" : `${points} points available`;
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
