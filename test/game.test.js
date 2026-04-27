import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game.js";
import { createInput } from "../src/input.js";
import { createBase, createTarget, damageTarget } from "../src/game/targets.js";

const step = 1 / 60;

test("tap right from 1,8 ends at 2,8 only", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.keyUp("ArrowRight");
  harness.advance(1);

  assert.equal(harness.player().gridX, 2);
  assert.equal(harness.player().gridY, 8);
});

test("single left, up, and down taps each move exactly one unblocked cell", () => {
  const cases = [
    { key: "ArrowLeft", facing: "left", start: { x: 2, y: 8 }, end: { x: 1, y: 8 } },
    { key: "ArrowUp", facing: "up", start: { x: 1, y: 8 }, end: { x: 1, y: 7 } },
    { key: "ArrowDown", facing: "down", start: { x: 1, y: 8 }, end: { x: 1, y: 9 } }
  ];

  for (const scenario of cases) {
    const harness = createHarness({
      x: scenario.start.x,
      y: scenario.start.y,
      facing: scenario.facing
    });

    harness.keyDown(scenario.key);
    harness.keyUp(scenario.key);
    harness.advance(1);

    assert.equal(harness.player().gridX, scenario.end.x);
    assert.equal(harness.player().gridY, scenario.end.y);
  }
});

test("holding right continues cell-by-cell without jumping directly to 3,8", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advance(0.1);
  let player = harness.player();
  assert.equal(player.gridX, 1);
  assert.equal(player.toX, 2);
  assert.ok(player.visual.x > 1 && player.visual.x < 2);

  harness.advance(0.2);
  player = harness.player();
  assert.equal(player.gridX, 2);
  assert.equal(player.toX, 3);
  assert.ok(player.visual.x >= 2 && player.visual.x <= 3);

  harness.advance(0.27);
  player = harness.player();
  assert.equal(player.gridX, 3);
  assert.equal(player.gridY, 8);
});

test("held direction does not start the next cell in the same update that arrival completes", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advanceSteps(17);

  let player = harness.player();
  assert.equal(player.gridX, 2);
  assert.equal(player.gridY, 8);
  assert.equal(player.isMoving, false);
  assert.equal(player.toX, 2);

  harness.advanceSteps(1);
  player = harness.player();
  assert.equal(player.gridX, 2);
  assert.equal(player.toX, 3);
  assert.equal(player.isMoving, true);
});

test("holding right does not move faster than configured movement speed", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advance(0.49);

  assert.equal(harness.player().gridX, 2);
  assert.ok(harness.player().visual.x < 3);
});

test("key repeat while holding does not create acceleration", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advance(0.1);
  harness.keyDown("ArrowRight", { repeat: true });
  harness.keyDown("ArrowRight", { repeat: true });
  harness.keyDown("ArrowRight", { repeat: true });
  harness.advance(0.39);

  assert.equal(harness.player().gridX, 2);
  assert.ok(harness.player().visual.x < 3);
  assert.equal(harness.player().gridY, 8);
});

test("changing held direction while moving applies only at the next cell boundary", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advance(0.1);
  harness.keyDown("ArrowDown");
  harness.keyUp("ArrowRight");

  let player = harness.player();
  assert.equal(player.gridX, 1);
  assert.equal(player.gridY, 8);
  assert.equal(player.facing, "right");
  assert.equal(player.toX, 2);
  assert.equal(player.toY, 8);

  harness.advance(0.2);
  player = harness.player();
  assert.equal(player.gridX, 2);
  assert.equal(player.facing, "down");
  assert.ok(player.visual.y >= 8);
});

test("space shooting during held movement does not affect speed, facing, or target cell", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.advance(0.1);
  harness.keyDown("Space");
  harness.advance(0.39);

  const player = harness.player();
  assert.equal(player.gridX, 2);
  assert.equal(player.gridY, 8);
  assert.equal(player.facing, "right");
  assert.equal(player.toX, 3);
  assert.equal(player.toY, 8);
  assert.ok(player.visual.x < 3);
  assert.equal(harness.snapshot().projectiles.length, 1);
});

test("visual position never interpolates over more than one cell for a single input", () => {
  const harness = createHarness({ x: 1, y: 8, facing: "right" });

  harness.keyDown("ArrowRight");
  harness.keyUp("ArrowRight");
  harness.advance(0.1);

  const player = harness.player();
  assert.equal(player.fromX, 1);
  assert.equal(player.toX, 2);
  assert.equal(player.fromY, 8);
  assert.equal(player.toY, 8);
  assert.ok(Math.abs(player.toX - player.fromX) <= 1);
  assert.ok(Math.abs(player.toY - player.fromY) <= 1);
  assert.ok(player.visual.x >= 1 && player.visual.x <= 2);
});

test("mission status becomes won when enemy base is destroyed", () => {
  const base = createBase({ id: "enemy-base", gridX: 3, gridY: 1, hp: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [base]
  });

  harness.keyDown("Space");
  harness.advance(0.5);

  const state = harness.debugState();
  assert.equal(state.missionStatus, "won");
  assert.equal(state.targets[0].destroyed, true);
});

test("alive enemy entities block movement", () => {
  const target = createTarget({ id: "blocker", gridX: 2, gridY: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [target],
    validateSpawn: false
  });

  harness.keyDown("ArrowRight");
  harness.keyUp("ArrowRight");
  harness.advance(0.5);

  assert.equal(harness.player().gridX, 1);
  assert.equal(harness.player().gridY, 1);
});

test("destroyed entities no longer block movement", () => {
  const target = createTarget({ id: "blocker", gridX: 2, gridY: 1, hp: 1 });
  damageTarget(target);
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [target]
  });

  harness.keyDown("ArrowRight");
  harness.keyUp("ArrowRight");
  harness.advance(0.5);

  assert.equal(harness.player().gridX, 2);
  assert.equal(harness.player().gridY, 1);
});

test("player projectiles do not damage player-team entities in game integration", () => {
  const playerBase = createBase({
    id: "player-base",
    gridX: 3,
    gridY: 1,
    hp: 3,
    team: "player"
  });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [playerBase]
  });

  harness.keyDown("Space");
  harness.advance(0.5);

  const state = harness.debugState();
  assert.equal(state.targets[0].hp, 3);
  assert.equal(state.targets[0].alive, true);
  assert.equal(state.missionStatus, "playing");
});

test("walls and destroyed non-base entities do not trigger mission win", () => {
  const target = createTarget({ id: "wreck", gridX: 3, gridY: 1, hp: 1 });
  damageTarget(target);
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [target]
  });

  harness.keyDown("Space");
  harness.advance(0.5);

  assert.equal(harness.debugState().missionStatus, "playing");
});

test("enemy projectile damages player", () => {
  const sentry = createTarget({ id: "sentry", gridX: 3, gridY: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [sentry],
    validateSpawn: false
  });

  harness.advance(1.2);

  assert.equal(harness.debugState().player.hp, 2);
});

test("status text calls out sentry warning and player invulnerability", () => {
  const sentry = createTarget({ id: "sentry", gridX: 3, gridY: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [sentry],
    validateSpawn: false
  });

  harness.advance(0.1);
  assert.match(harness.statusText(), /Sentry warning/);

  harness.advance(1);
  assert.match(harness.statusText(), /Invulnerable/);
});

test("debug state exposes combat fairness tuning", () => {
  const harness = createHarness({ x: 1, y: 1, facing: "right" });

  assert.deepEqual(harness.debugState().combatTuning, {
    enemyProjectileDamage: 1,
    enemyProjectileSpeedCellsPerSecond: 3,
    enemyFireCooldownSeconds: 1.45,
    enemyFireWindupSeconds: 0.6,
    playerInvulnerabilitySeconds: 0.7,
    playerDamageFlashSeconds: 0.24
  });
});

test("snapshot exposes interpolated patrol target visual position", () => {
  const patrol = createTarget({
    id: "patrol",
    gridX: 1,
    gridY: 1,
    patrolRoute: [
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 2
  });
  const harness = createHarness({
    x: 5,
    y: 3,
    facing: "left",
    targets: [patrol]
  });

  harness.advance(0.13);

  const [target] = harness.snapshot().targets;
  assert.equal(target.gridX, 1);
  assert.ok(target.visual.x > 1 && target.visual.x < 2);
  assert.equal(target.visual.y, 1);
});

test("player cannot move into a patrol enemy reserved target cell", () => {
  const patrol = createTarget({
    id: "patrol",
    gridX: 3,
    gridY: 1,
    patrolRoute: [
      { x: 3, y: 1 },
      { x: 2, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 1
  });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [patrol],
    validateSpawn: false
  });

  harness.advance(0.1);
  harness.keyDown("ArrowRight");
  harness.keyUp("ArrowRight");
  harness.advance(0.5);

  assert.equal(harness.player().gridX, 1);
  assert.equal(harness.player().gridY, 1);
});

test("patrol enemy waits when the player occupies the next route cell", () => {
  const patrol = createTarget({
    id: "patrol",
    gridX: 2,
    gridY: 1,
    patrolRoute: [
      { x: 2, y: 1 },
      { x: 1, y: 1 }
    ],
    patrolSpeedCellsPerSecond: 2
  });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [patrol],
    validateSpawn: false
  });

  harness.advance(0.5);

  const [target] = harness.snapshot().targets;
  assert.equal(target.gridX, 2);
  assert.equal(target.isPatrolling, false);
});

test("player HP reaching zero sets mission status to lost", () => {
  const sentry = createTarget({ id: "sentry", gridX: 3, gridY: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [sentry],
    playerHp: 1,
    validateSpawn: false
  });

  harness.advance(1.2);

  assert.equal(harness.debugState().player.hp, 0);
  assert.equal(harness.debugState().missionStatus, "lost");
});

test("movement and player shooting stop after loss", () => {
  const sentry = createTarget({ id: "sentry", gridX: 3, gridY: 1 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [sentry],
    playerHp: 1,
    validateSpawn: false
  });

  harness.advance(1.2);
  harness.keyDown("ArrowDown");
  harness.keyDown("Space");
  harness.advance(0.5);

  const state = harness.debugState();
  assert.equal(state.missionStatus, "lost");
  assert.equal(state.player.gridX, 1);
  assert.equal(state.player.gridY, 1);
  assert.equal(state.projectiles.length, 0);
});

test("player invulnerability prevents rapid multi-hit damage", () => {
  const first = createTarget({ id: "first", gridX: 3, gridY: 1 });
  const second = createTarget({ id: "second", gridX: 4, gridY: 1, solid: false });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [first, second],
    validateSpawn: false
  });

  harness.advance(1.2);

  const state = harness.debugState();
  assert.equal(state.player.hp, 2);
  assert.ok(state.player.invulnerabilityRemaining > 0);
});

test("victory condition still works when enemy projectiles exist", () => {
  const base = createBase({ id: "enemy-base", gridX: 3, gridY: 1, hp: 1 });
  const sentry = createTarget({ id: "sentry", gridX: 5, gridY: 5 });
  const harness = createHarness({
    x: 1,
    y: 1,
    facing: "right",
    targets: [base, sentry]
  });

  harness.keyDown("Space");
  harness.advance(0.5);

  assert.equal(harness.debugState().missionStatus, "won");
});

function createHarness({ x, y, facing, targets = [], playerHp, validateSpawn = true }) {
  const target = new EventTarget();
  const input = createInput(target);
  const game = createGame({
    level: createOpenLevel(),
    playerSpawn: { x, y },
    facing,
    speedCellsPerSecond: 4,
    targets,
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
      this.advanceSteps(steps);
    },

    advanceSteps(steps) {
      for (let index = 0; index < steps; index += 1) {
        game.update(step, input);
      }
    },

    player() {
      return game.snapshot().player;
    },

    snapshot() {
      return game.snapshot();
    },

    debugState() {
      return game.debugState();
    },

    statusText() {
      return game.statusText(input);
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
  const tiles = [
    "#######",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#.....#",
    "#######"
  ];

  return {
    width: 7,
    height: 11,
    tiles,
    playerSpawn: { x: 1, y: 8 }
  };
}
