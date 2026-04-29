import { createCampaignGame } from "./game.js";
import { createInput } from "./input.js";
import { renderGame } from "./render.js";
import { createSpriteAssetStore } from "./assets/spriteLoader.js";
import {
  renderUpgradePanel,
  upgradeChoiceIndexForKey
} from "./upgradePanel.js";

const canvas = document.querySelector("#game");
const status = document.querySelector("#status");
const upgradePanel = document.querySelector("#upgrade-panel");
const upgradeContext = document.querySelector("#upgrade-context");
const upgradeChoices = document.querySelector("#upgrade-choices");
const context = canvas.getContext("2d");
const input = createInput(window);
const game = createCampaignGame();
const spriteAssets = createSpriteAssetStore({
  manifestUrl: new URL("../assets/sprites/manifest.json", import.meta.url)
});
const iconGlyphs = {
  hp: "+",
  enemy: "X",
  base: "#",
  mission: "I"
};
spriteAssets.load().then(renderCurrentState);

const fixedStep = 1 / 60;
let previousTime = performance.now();
let accumulator = 0;
let deterministicMode = false;

function frame(time) {
  if (deterministicMode) {
    requestAnimationFrame(frame);
    return;
  }

  const deltaSeconds = Math.min(0.1, (time - previousTime) / 1000);
  previousTime = time;
  accumulator += deltaSeconds;

  while (accumulator >= fixedStep) {
    game.update(fixedStep, input);
    accumulator -= fixedStep;
  }

  renderCurrentState();
  requestAnimationFrame(frame);
}

renderCurrentState();
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    game.restartLevel();
    resetTimingAndRender();
    return;
  }

  const choiceIndex = upgradeChoiceIndexForKey(event.code);
  if (choiceIndex !== null && chooseUpgradeByIndex(choiceIndex)) {
    resetTimingAndRender();
    return;
  }

  if (event.code === "KeyN" || event.code === "Enter") {
    if (game.advanceLevel()) {
      resetTimingAndRender();
    }
  }
});
window.advanceTime = (milliseconds) => {
  deterministicMode = true;
  const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
  for (let index = 0; index < steps; index += 1) {
    game.update(fixedStep, input);
  }
  renderCurrentState();
};
window.render_game_to_text = () => JSON.stringify(game.debugState());
requestAnimationFrame(frame);

upgradeChoices.addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade-id]");
  if (!button) {
    return;
  }

  if (chooseUpgrade(button.dataset.upgradeId)) {
    resetTimingAndRender();
  }
});

function resetTimingAndRender() {
  accumulator = 0;
  previousTime = performance.now();
  deterministicMode = false;
  renderCurrentState();
}

function renderCurrentState() {
  const snapshot = game.snapshot();
  renderGame(context, snapshot, { spriteAssets });
  renderMissionStatus(snapshot, game.statusText(input));
  renderUpgradePanel({
    panel: upgradePanel,
    contextElement: upgradeContext,
    choicesContainer: upgradeChoices,
    snapshot
  });
}

function chooseUpgradeByIndex(index) {
  const choice = game.snapshot().upgradeChoice?.choices[index];
  return choice ? chooseUpgrade(choice.id) : false;
}

function chooseUpgrade(upgradeId) {
  return game.applyUpgrade(upgradeId).applied;
}

function renderMissionStatus(snapshot, statusText) {
  const enemyBase = snapshot.targets.find((target) => (
    target.type === "base"
    && target.team === "enemy"
  ));
  const liveEnemyTanks = snapshot.targets.filter((target) => (
    target.type === "dummy"
    && target.team === "enemy"
    && target.alive
  )).length;
  const missionNumber = snapshot.levelNumber ?? ((snapshot.currentLevelIndex ?? 0) + 1);
  const levelCount = snapshot.levelCount ?? 1;
  const cooldownMs = Math.ceil((snapshot.cooldownRemaining ?? 0) * 1000);
  const shieldCharges = snapshot.player?.shieldCharges ?? 0;
  const missionState = snapshot.missionStatus ?? "playing";
  const missionLabel = `Mission ${missionState}`;
  const pickupBadges = shieldCharges > 0
    ? [{ glyph: "S", label: `Shield x${shieldCharges}` }]
    : [
        { glyph: "+", label: "Repair" },
        { glyph: "A", label: "Ammo" },
        { glyph: "S", label: "Shield" }
      ];

  status.replaceChildren(
    createElement("span", "status__summary", statusText),
    createElement("div", "status__header", [
      createElement("span", "status__kicker", `Mission ${missionNumber}/${levelCount}`),
      createElement("strong", "status__title", missionLabel),
      createElement("span", "status__objective", "Destroy enemy base")
    ]),
    createElement("div", "status__chips", [
      createStatusChip("hp", "HP", `${snapshot.player.hp}/${snapshot.player.maxHp}`),
      createStatusChip("enemy", "Enemies", String(liveEnemyTanks)),
      createStatusChip(
        "base",
        "Base",
        enemyBase ? enemyBase.destroyed ? "Destroyed" : `${enemyBase.hp}/${enemyBase.maxHp}` : "Missing"
      ),
      createStatusChip("mission", "Level", `${missionNumber}/${levelCount}`)
    ]),
    createElement("div", "status__lower", [
      createElement("span", "status__cue", cooldownMs > 0 ? `Reload ${cooldownMs}ms` : "Space to fire"),
      createElement("div", "status__badges", pickupBadges.map((badge) => (
        createElement("span", "status__badge", [
          createElement("span", "status__badge-glyph", badge.glyph),
          createElement("span", "status__badge-label", badge.label)
        ])
      )))
    ])
  );
  status.setAttribute("aria-label", statusText);
}

function createStatusChip(icon, label, value) {
  return createElement("span", `status-chip status-chip--${icon}`, [
    createElement("span", "status-chip__icon", iconGlyphs[icon] ?? "?"),
    createElement("span", "status-chip__label", label),
    createElement("strong", "status-chip__value", value)
  ]);
}

function createElement(tagName, className, content) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (Array.isArray(content)) {
    element.append(...content);
  } else if (content !== undefined) {
    element.textContent = content;
  }
  return element;
}
