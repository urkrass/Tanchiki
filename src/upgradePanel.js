export function renderUpgradePanel({ panel, choicesContainer, snapshot }) {
  const choices = snapshot.upgradeChoice?.choices ?? [];
  if (!snapshot.upgradeChoice?.pending || choices.length === 0) {
    panel.hidden = true;
    choicesContainer.replaceChildren();
    return;
  }

  panel.hidden = false;
  choicesContainer.replaceChildren(...choices.map(createUpgradeChoiceButton));
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

function createUpgradeChoiceButton(choice, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "upgrade-choice";
  button.dataset.upgradeId = choice.id;
  button.setAttribute(
    "aria-label",
    `${choice.label}, rank ${choice.nextRank} of ${choice.maxRank}`
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
  meta.textContent = `Rank ${choice.nextRank}/${choice.maxRank}`;

  const description = document.createElement("span");
  description.className = "upgrade-choice__description";
  description.textContent = choice.description;

  content.append(title, meta, description);
  button.append(key, content);
  return button;
}
