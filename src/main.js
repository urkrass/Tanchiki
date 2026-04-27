import { createCampaignGame } from "./game.js";
import { createInput } from "./input.js";
import { renderGame } from "./render.js";

const canvas = document.querySelector("#game");
const status = document.querySelector("#status");
const context = canvas.getContext("2d");
const input = createInput(window);
const game = createCampaignGame();

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

  renderGame(context, game.snapshot());
  status.textContent = game.statusText(input);
  requestAnimationFrame(frame);
}

renderGame(context, game.snapshot());
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    game.restartLevel();
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
  renderGame(context, game.snapshot());
  status.textContent = game.statusText(input);
};
window.render_game_to_text = () => JSON.stringify(game.debugState());
requestAnimationFrame(frame);

function resetTimingAndRender() {
  accumulator = 0;
  previousTime = performance.now();
  deterministicMode = false;
  renderGame(context, game.snapshot());
  status.textContent = game.statusText(input);
}
