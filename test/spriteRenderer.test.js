import test from "node:test";
import assert from "node:assert/strict";
import { SPRITE_STATUS } from "../src/assets/spriteManifest.js";
import { drawManifestSprite } from "../src/assets/spriteRenderer.js";

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
