import test from "node:test";
import assert from "node:assert/strict";
import { isBlockedCell } from "../src/game/level.js";
import { validateMissionSpawn } from "../src/game/spawnValidation.js";
import { createTarget } from "../src/game/targets.js";

test("player spawn is not in enemy LOS", () => {
  assert.doesNotThrow(() => validateMissionSpawn(
    safeLevel(),
    { x: 1, y: 1 },
    [createTarget({ id: "sentry", gridX: 4, gridY: 3 })],
    isBlockedCell
  ));
});

test("spawn validation fails if enemy has direct LOS to spawn", () => {
  assert.throws(
    () => validateMissionSpawn(
      safeLevel(),
      { x: 1, y: 1 },
      [createTarget({ id: "sentry", gridX: 4, gridY: 1 })],
      isBlockedCell
    ),
    /line of sight/
  );
});

test("spawn validation fails if spawn is inside a wall", () => {
  assert.throws(
    () => validateMissionSpawn(safeLevel(), { x: 0, y: 0 }, [], isBlockedCell),
    /inside wall/
  );
});

test("spawn validation fails if spawn is inside a solid entity", () => {
  assert.throws(
    () => validateMissionSpawn(
      safeLevel(),
      { x: 1, y: 1 },
      [createTarget({ id: "sentry", gridX: 1, gridY: 1 })],
      isBlockedCell
    ),
    /inside entity/
  );
});

test("spawn validation fails if there is no adjacent legal move", () => {
  const level = {
    width: 3,
    height: 3,
    tiles: [
      "###",
      "#P#",
      "###"
    ],
    playerSpawn: { x: 1, y: 1 }
  };

  assert.throws(
    () => validateMissionSpawn(level, { x: 1, y: 1 }, [], isBlockedCell),
    /no legal adjacent move/
  );
});

function safeLevel() {
  return {
    width: 7,
    height: 5,
    tiles: [
      "#######",
      "#P....#",
      "#.###.#",
      "#.....#",
      "#######"
    ],
    playerSpawn: { x: 1, y: 1 }
  };
}
