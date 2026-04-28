import test from "node:test";
import assert from "node:assert/strict";
import { targetReadabilityCue } from "../src/game/readability.js";

test("target readability cues identify the enemy base", () => {
  assert.deepEqual(targetReadabilityCue({
    type: "base",
    alive: true
  }), {
    label: "B",
    name: "Enemy base",
    fillStyle: "#6f2f2b",
    textStyle: "#f7f4ea"
  });
});

test("target readability cues distinguish pursuit, patrol, and sentry enemies", () => {
  assert.deepEqual(targetReadabilityCue({
    type: "dummy",
    alive: true,
    pursuitTarget: "player"
  }), {
    label: "!",
    name: "Pursuit enemy",
    fillStyle: "#a6342f",
    textStyle: "#fff7df"
  });

  assert.deepEqual(targetReadabilityCue({
    type: "dummy",
    alive: true,
    patrolRoute: [{ x: 1, y: 1 }, { x: 2, y: 1 }]
  }), {
    label: "P",
    name: "Patrol enemy",
    fillStyle: "#8a5a2f",
    textStyle: "#fff7df"
  });

  assert.deepEqual(targetReadabilityCue({
    type: "dummy",
    alive: true
  }), {
    label: "S",
    name: "Sentry enemy",
    fillStyle: "#8d3e34",
    textStyle: "#fff7df"
  });
});

test("target readability cues identify destroyed targets without changing target state", () => {
  const target = {
    type: "dummy",
    alive: false,
    destroyed: true
  };

  assert.equal(targetReadabilityCue(target).label, "X");
  assert.deepEqual(target, {
    type: "dummy",
    alive: false,
    destroyed: true
  });
});
