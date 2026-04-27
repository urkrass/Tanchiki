import test from "node:test";
import assert from "node:assert/strict";
import { findPathToCell } from "../src/game/pathfinding.js";

test("finds a path around simple walls", () => {
  const level = {
    width: 5,
    height: 5,
    tiles: [
      "#####",
      "#.#.#",
      "#...#",
      "#####",
      "#####"
    ]
  };

  const path = findPathToCell({
    start: { x: 1, y: 1 },
    goal: { x: 3, y: 1 },
    canEnterCell: (x, y) => isOpen(level, x, y)
  });

  assert.deepEqual(path, [
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 3, y: 1 }
  ]);
});

test("returns no path when blocked", () => {
  const level = {
    width: 5,
    height: 5,
    tiles: [
      "#####",
      "#.#.#",
      "#####",
      "#...#",
      "#####"
    ]
  };

  const path = findPathToCell({
    start: { x: 1, y: 1 },
    goal: { x: 3, y: 1 },
    canEnterCell: (x, y) => isOpen(level, x, y)
  });

  assert.deepEqual(path, []);
});

function isOpen(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return false;
  }

  return level.tiles[y][x] !== "#";
}

