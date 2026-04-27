import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { createPickup } from "../src/game/pickups.js";
import { createTarget } from "../src/game/targets.js";

const step = 1 / 60;

test("repair pickup restores HP without exceeding max", () => {
  const harness = createHarness({
    playerHp: 2,
    pickups: [
      createPickup({ id: "repair", type: "repair", gridX: 2, gridY: 1, amount: 5 })
    ]
  });

  harness.moveRightOneCell();

  const state = harness.debugState();
  assert.equal(state.player.hp, 3);
  assert.equal(state.pickups[0].active, false);
});

test("pickup amount must be positive", () => {
  assert.throws(
    () => createPickup({ id: "bad-repair", type: "repair", gridX: 2, gridY: 1, amount: 0 }),
    /positive integer amount/
  );
});

test("pickup is consumed once", () => {
  const harness = createHarness({
    playerHp: 1,
    pickups: [
      createPickup({ id: "repair", type: "repair", gridX: 2, gridY: 1, amount: 1 })
    ]
  });

  harness.moveRightOneCell();
  assert.equal(harness.debugState().player.hp, 2);

  harness.moveLeftOneCell();
  harness.moveRightOneCell();

  const state = harness.debugState();
  assert.equal(state.player.hp, 2);
  assert.equal(state.pickups[0].active, false);
});

test("ammo pickup increases reserve without limiting shooting", () => {
  const harness = createHarness({
    pickups: [
      createPickup({ id: "ammo", type: "ammo", gridX: 2, gridY: 1, amount: 4 })
    ]
  });

  harness.moveRightOneCell();
  harness.keyDown("Space");
  harness.advance(0.1);

  const state = harness.debugState();
  assert.equal(state.player.ammoReserve, 4);
  assert.equal(state.projectiles.length, 1);
});

test("shield pickup blocks one enemy hit", () => {
  const harness = createHarness({
    pickups: [
      createPickup({ id: "shield", type: "shield", gridX: 2, gridY: 1, amount: 1 })
    ],
    targets: [
      createTarget({
        id: "sentry",
        gridX: 4,
        gridY: 1,
        lineOfSightRangeCells: 4
      })
    ],
    validateSpawn: false
  });

  harness.moveRightOneCell();
  harness.advance(1.2);

  const state = harness.debugState();
  assert.equal(state.player.hp, 3);
  assert.equal(state.player.shieldCharges, 0);
  assert.ok(state.player.invulnerabilityRemaining > 0);
});

test("pickup collection happens only when movement reaches the cell boundary", () => {
  const harness = createHarness({
    playerHp: 2,
    pickups: [
      createPickup({ id: "repair", type: "repair", gridX: 2, gridY: 1, amount: 1 })
    ]
  });

  harness.keyDown("ArrowRight");
  harness.advance(0.1);

  let state = harness.debugState();
  assert.equal(state.player.gridX, 1);
  assert.equal(state.player.hp, 2);
  assert.equal(state.pickups[0].active, true);

  harness.advance(0.2);

  state = harness.debugState();
  assert.equal(state.player.gridX, 2);
  assert.equal(state.player.hp, 3);
  assert.equal(state.pickups[0].active, false);
});

function createHarness({
  playerHp = 3,
  pickups = [],
  targets = [],
  validateSpawn = true
} = {}) {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createGame({
    level: createOpenLevel(),
    playerSpawn: { x: 1, y: 1 },
    facing: "right",
    speedCellsPerSecond: 4,
    targets,
    pickups,
    playerHp,
    validateSpawn
  });

  return {
    keyDown(code, { repeat = false } = {}) {
      target.dispatchEvent(keyEvent("keydown", code, repeat));
    },

    keyUp(code) {
      target.dispatchEvent(keyEvent("keyup", code));
    },

    advance(seconds) {
      const steps = Math.ceil(seconds / step);
      for (let index = 0; index < steps; index += 1) {
        game.update(step, input);
      }
    },

    moveRightOneCell() {
      this.keyDown("ArrowRight");
      this.keyUp("ArrowRight");
      this.advance(0.3);
    },

    moveLeftOneCell() {
      this.keyDown("ArrowLeft");
      this.keyUp("ArrowLeft");
      this.advance(0.3);
    },

    debugState() {
      return game.debugState();
    }
  };
}

function keyEvent(type, code, repeat = false) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: repeat }
  });
  return event;
}

function createOpenLevel() {
  return {
    width: 7,
    height: 5,
    tiles: [
      "#######",
      "#.....#",
      "#.....#",
      "#.....#",
      "#######"
    ],
    playerSpawn: { x: 1, y: 1 }
  };
}
