import test from "node:test";
import assert from "node:assert/strict";
import { SPRITE_STATUS, getSpriteFrame, listSpriteImages } from "../src/assets/spriteManifest.js";
import { createSpriteAssetStore } from "../src/assets/spriteLoader.js";

const directionalManifest = {
  meta: { tileSize: 48 },
  sheets: {
    player_tank: {
      image: "sprites/tanks/player.png",
      frameWidth: 48,
      frameHeight: 48,
      animations: {
        idle: {
          up: [[0, 0]],
          right: [[48, 0]],
          down: [[96, 0]],
          left: [[144, 0]]
        },
        destroyed: {
          any: [[0, 48], [48, 48]]
        }
      }
    }
  }
};

test("sprite manifest lookup returns directional frame coordinates", () => {
  assert.deepEqual(getSpriteFrame(directionalManifest, "player_tank", "idle", "right"), {
    status: SPRITE_STATUS.READY,
    spriteId: "player_tank",
    animation: "idle",
    direction: "right",
    image: "sprites/tanks/player.png",
    frame: {
      x: 48,
      y: 0,
      width: 48,
      height: 48
    }
  });
});

test("sprite manifest lookup wraps frame indexes and falls back to any direction", () => {
  assert.deepEqual(getSpriteFrame(directionalManifest, "player_tank", "destroyed", "left", 3).frame, {
    x: 48,
    y: 48,
    width: 48,
    height: 48
  });
});

test("sprite manifest lookup reports missing sprites without throwing", () => {
  assert.deepEqual(getSpriteFrame(directionalManifest, "enemy_tank", "idle", "up"), {
    status: SPRITE_STATUS.MISSING,
    spriteId: "enemy_tank",
    reason: "sprite"
  });
});

test("sprite loader reports ready image state when the image factory loads", async () => {
  const store = createSpriteAssetStore({
    manifest: directionalManifest,
    baseUrl: "https://example.test/assets/manifest.json",
    imageFactory: createFakeImageFactory("load")
  });

  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.MISSING);

  await store.load();

  const frame = store.getFrame("player_tank", "idle", "up");
  assert.equal(frame.status, SPRITE_STATUS.READY);
  assert.equal(frame.imageElement.src, "https://example.test/assets/sprites/tanks/player.png");
});

test("sprite loader reports failed images so rendering can keep primitive fallback", async () => {
  const store = createSpriteAssetStore({
    manifest: directionalManifest,
    baseUrl: "https://example.test/assets/manifest.json",
    imageFactory: createFakeImageFactory("error")
  });

  await store.load();

  const frame = store.getFrame("player_tank", "idle", "up");
  assert.equal(frame.status, SPRITE_STATUS.ERROR);
  assert.ok(frame.error instanceof Error);
});

test("sprite loader converts image factory failures into fallback-safe errors", async () => {
  const store = createSpriteAssetStore({
    manifest: directionalManifest,
    imageFactory: () => {
      throw new Error("image constructor unavailable");
    }
  });

  await store.load();

  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.ERROR);
});

test("sprite loader converts invalid asset urls into fallback-safe errors", async () => {
  const store = createSpriteAssetStore({
    manifest: directionalManifest,
    baseUrl: "not a url",
    imageFactory: createFakeImageFactory("load")
  });

  await store.load();

  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.ERROR);
});

test("sprite loader can fetch an empty runtime manifest without requesting images", async () => {
  const store = createSpriteAssetStore({
    manifestUrl: "https://example.test/assets/sprites/manifest.json",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({ meta: { tileSize: 48 }, sheets: {} })
    }),
    imageFactory: () => {
      throw new Error("No images should be requested for an empty manifest");
    }
  });

  await store.load();

  assert.equal(store.status, SPRITE_STATUS.READY);
  assert.deepEqual(listSpriteImages(store.manifest), []);
  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.MISSING);
});

function createFakeImageFactory(result) {
  return () => {
    const image = {};
    Object.defineProperty(image, "src", {
      set(value) {
        image.currentSrc = value;
        queueMicrotask(() => {
          if (result === "load") {
            image.onload();
          } else {
            image.onerror(new Error("missing sprite"));
          }
        });
      },
      get() {
        return image.currentSrc;
      }
    });
    return image;
  };
}
