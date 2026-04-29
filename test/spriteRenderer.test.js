import test from "node:test";
import assert from "node:assert/strict";
import { SPRITE_STATUS } from "../src/assets/spriteManifest.js";
import { drawManifestSprite } from "../src/assets/spriteRenderer.js";
import { renderGame } from "../src/render.js";

test("drawManifestSprite draws ready frames centered at the requested size", () => {
  const calls = [];
  const context = {
    drawImage(...args) {
      calls.push(args);
    }
  };
  const imageElement = { id: "sprite" };

  assert.equal(drawManifestSprite(context, {
    status: SPRITE_STATUS.READY,
    imageElement,
    frame: {
      x: 48,
      y: 0,
      width: 48,
      height: 48
    }
  }, 40), true);

  assert.deepEqual(calls, [[imageElement, 48, 0, 48, 48, -20, -20, 40, 40]]);
});

test("drawManifestSprite reports fallback for missing, loading, and errored sprites", () => {
  const context = {
    drawImage() {
      throw new Error("fallback states should not draw images");
    }
  };

  for (const status of [SPRITE_STATUS.MISSING, SPRITE_STATUS.LOADING, SPRITE_STATUS.ERROR]) {
    assert.equal(drawManifestSprite(context, { status }, 40), false);
  }
});

test("renderGame keeps primitive fallback when sprite frames fail", () => {
  const context = createRecordingContext();
  const spriteRequests = [];

  renderGame(context, createRenderSnapshot(), {
    spriteAssets: {
      getFrame(spriteId, animation, direction) {
        spriteRequests.push({ spriteId, animation, direction });
        return { status: SPRITE_STATUS.ERROR };
      }
    }
  });

  assert.equal(context.callsByName.drawImage.length, 0);
  assert.ok(hasCall(context, "fillRect", [-14, -18, 28, 34]));
  assert.ok(hasCall(context, "strokeRect", [-13, -13, 26, 27]));
  assert.ok(hasCall(context, "fillRect", [-21, -16, 42, 32]));
  assert.ok(hasCall(context, "fillRect", [-4, -10, 8, 20]));
  assert.deepEqual(spriteRequests.map((request) => request.spriteId), [
    "sentry_tank",
    "enemy_base",
    "player_shell",
    "player_tank"
  ]);
});

test("renderGame draws ready sprites while preserving target overlays", () => {
  const context = createRecordingContext();
  const imageElement = { id: "core-sprite" };

  renderGame(context, createRenderSnapshot(), {
    spriteAssets: {
      getFrame(spriteId, animation, direction) {
        return {
          status: SPRITE_STATUS.READY,
          spriteId,
          animation,
          direction,
          imageElement,
          frame: {
            x: 0,
            y: 0,
            width: 48,
            height: 48
          }
        };
      }
    }
  });

  assert.equal(context.callsByName.drawImage.length, 4);
  assert.ok(hasCall(context, "fillRect", [-16, 20, 32, 5]));
  assert.ok(hasCall(context, "fillRect", [-20, 24, 40, 5]));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "S"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "B"));
});

test("renderGame keeps the damage flash primitive for the player tank", () => {
  const context = createRecordingContext();
  const spriteRequests = [];
  const snapshot = createRenderSnapshot({
    player: {
      damageFlashSeconds: 0.1
    },
    targets: [],
    projectiles: []
  });

  renderGame(context, snapshot, {
    spriteAssets: {
      getFrame(spriteId) {
        spriteRequests.push(spriteId);
        return {
          status: SPRITE_STATUS.READY,
          imageElement: { id: "core-sprite" },
          frame: {
            x: 0,
            y: 0,
            width: 48,
            height: 48
          }
        };
      }
    }
  });

  assert.equal(context.callsByName.drawImage.length, 0);
  assert.ok(hasCall(context, "fillRect", [-14, -18, 28, 34]));
  assert.ok(hasCall(context, "fillRect", [-4, -31, 8, 28]));
  assert.deepEqual(spriteRequests, []);
});

test("renderGame requests manifest sprites for pickups, enemy variants, and destroyed targets", () => {
  const context = createRecordingContext();
  const spriteRequests = [];
  const snapshot = createRenderSnapshot({
    pickups: [
      { active: true, type: "repair", gridX: 0, gridY: 0 },
      { active: true, type: "ammo", gridX: 1, gridY: 0 },
      { active: true, type: "shield", gridX: 2, gridY: 0 }
    ],
    targets: [
      {
        type: "dummy",
        alive: true,
        hp: 2,
        maxHp: 3,
        gridX: 0,
        gridY: 1,
        facing: "up",
        patrolRoute: [{ x: 0, y: 1 }, { x: 1, y: 1 }]
      },
      {
        type: "dummy",
        alive: true,
        hp: 2,
        maxHp: 3,
        gridX: 1,
        gridY: 1,
        facing: "down",
        pursuitTarget: "player"
      },
      {
        type: "dummy",
        alive: false,
        hp: 0,
        maxHp: 3,
        gridX: 2,
        gridY: 1,
        facing: "left"
      },
      {
        type: "base",
        team: "enemy",
        alive: false,
        hp: 0,
        maxHp: 6,
        gridX: 3,
        gridY: 1
      }
    ],
    projectiles: []
  });

  renderGame(context, snapshot, {
    spriteAssets: {
      getFrame(spriteId, animation, direction) {
        spriteRequests.push({ spriteId, animation, direction });
        return {
          status: SPRITE_STATUS.READY,
          imageElement: { id: "sprite" },
          frame: {
            x: 0,
            y: 0,
            width: 48,
            height: 48
          }
        };
      }
    }
  });

  assert.deepEqual(spriteRequests.map((request) => request.spriteId), [
    "repair_pickup",
    "ammo_pickup",
    "shield_pickup",
    "patrol_tank",
    "pursuit_tank",
    "destroyed_tank",
    "destroyed_base",
    "player_tank"
  ]);
  assert.equal(context.callsByName.drawImage.length, 8);
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "P"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "!"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "X"));
});

test("renderGame keeps primitive fallback for pickups and destroyed targets", () => {
  const context = createRecordingContext();
  const spriteRequests = [];
  const snapshot = createRenderSnapshot({
    pickups: [
      { active: true, type: "repair", gridX: 0, gridY: 0 },
      { active: true, type: "ammo", gridX: 1, gridY: 0 },
      { active: true, type: "shield", gridX: 2, gridY: 0 }
    ],
    targets: [
      {
        type: "dummy",
        alive: false,
        hp: 0,
        maxHp: 3,
        gridX: 2,
        gridY: 1,
        facing: "left"
      },
      {
        type: "base",
        team: "enemy",
        alive: false,
        hp: 0,
        maxHp: 6,
        gridX: 3,
        gridY: 1
      }
    ],
    projectiles: []
  });

  renderGame(context, snapshot, {
    spriteAssets: {
      getFrame(spriteId, animation, direction) {
        spriteRequests.push({ spriteId, animation, direction });
        return { status: SPRITE_STATUS.MISSING };
      }
    }
  });

  assert.equal(context.callsByName.drawImage.length, 0);
  assert.deepEqual(spriteRequests.map((request) => request.spriteId), [
    "repair_pickup",
    "ammo_pickup",
    "shield_pickup",
    "destroyed_tank",
    "destroyed_base",
    "player_tank"
  ]);
  assert.ok(hasCall(context, "fillRect", [-13, -13, 26, 26]));
  assert.ok(hasCall(context, "fillRect", [-16, -16, 32, 32]));
  assert.ok(hasCall(context, "fillRect", [-20, -20, 40, 40]));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "+"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "A"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "S"));
  assert.ok(context.callsByName.fillText.some((call) => call.args[0] === "X"));
});

function createRenderSnapshot(overrides = {}) {
  return {
    level: {
      width: 4,
      height: 4,
      tiles: [
        "....",
        "....",
        "....",
        "...."
      ]
    },
    player: {
      visual: { x: 1, y: 1 },
      facing: "right",
      damageFlashSeconds: 0,
      ...overrides.player
    },
    pickups: overrides.pickups ?? [],
    projectiles: overrides.projectiles ?? [{
      active: true,
      team: "player",
      direction: "right",
      x: 2.5,
      y: 1.5
    }],
    impacts: [],
    targets: overrides.targets ?? [
      {
        type: "dummy",
        alive: true,
        hp: 2,
        maxHp: 3,
        gridX: 2,
        gridY: 1,
        facing: "left"
      },
      {
        type: "base",
        team: "enemy",
        alive: true,
        hp: 4,
        maxHp: 6,
        gridX: 3,
        gridY: 2
      }
    ],
    missionSummary: null,
    tileSize: 48
  };
}

function createRecordingContext() {
  const calls = [];
  const callsByName = new Proxy({}, {
    get(target, property) {
      if (!target[property]) {
        target[property] = [];
      }
      return target[property];
    }
  });

  const context = {
    canvas: {
      width: 0,
      height: 0
    },
    calls,
    callsByName
  };

  for (const name of [
    "arc",
    "beginPath",
    "clearRect",
    "drawImage",
    "fill",
    "fillRect",
    "fillText",
    "lineTo",
    "moveTo",
    "restore",
    "rotate",
    "save",
    "stroke",
    "strokeRect",
    "translate"
  ]) {
    context[name] = (...args) => {
      const call = { name, args };
      calls.push(call);
      callsByName[name].push(call);
    };
  }

  return context;
}

function hasCall(context, name, expectedArgs) {
  return context.callsByName[name].some((call) => (
    call.args.length === expectedArgs.length
    && call.args.every((arg, index) => Object.is(arg, expectedArgs[index]))
  ));
}
