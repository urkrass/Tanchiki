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
  status.textContent = game.statusText(input);
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
  status.textContent = game.statusText(input);
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
  status.textContent = game.statusText(input);
}

function renderCurrentState() {
  const snapshot = game.snapshot();
  renderGame(context, snapshot, { spriteAssets });
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
