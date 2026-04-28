import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SPRITE_STATUS,
  getSpriteFrame,
  listSpriteImages,
  validateSpriteManifest
} from "../src/assets/spriteManifest.js";
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

const runtimeManifest = JSON.parse(readFileSync(
  new URL("../assets/sprites/manifest.json", import.meta.url),
  "utf8"
));

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

test("runtime sprite manifest exposes the first core entity slice", () => {
  assert.deepEqual(listSpriteImages(runtimeManifest).sort(), [
    "core/enemy_base.svg",
    "core/enemy_tank.svg",
    "core/enemy_variants.svg",
    "core/pickups.svg",
    "core/player_tank.svg",
    "core/shells.svg",
    "core/wrecks.svg"
  ]);

  assert.deepEqual(validateSpriteManifest(runtimeManifest), []);
  assert.equal(getSpriteFrame(runtimeManifest, "player_tank", "idle", "left").status, SPRITE_STATUS.READY);
  assert.equal(getSpriteFrame(runtimeManifest, "enemy_tank", "idle", "up").status, SPRITE_STATUS.READY);
  assert.equal(getSpriteFrame(runtimeManifest, "enemy_base", "idle", "down").status, SPRITE_STATUS.READY);
  assert.equal(getSpriteFrame(runtimeManifest, "player_shell", "shell", "right").status, SPRITE_STATUS.READY);
  assert.equal(getSpriteFrame(runtimeManifest, "enemy_shell", "shell", "left").status, SPRITE_STATUS.READY);
});

test("runtime sprite manifest exposes placeholder variant and pickup sprites", () => {
  assert.equal(getSpriteFrame(runtimeManifest, "sentry_tank", "idle", "up").status, SPRITE_STATUS.READY);
  assert.equal(getSpriteFrame(runtimeManifest, "patrol_tank", "idle", "right").frame.x, 48);
  assert.equal(getSpriteFrame(runtimeManifest, "patrol_tank", "idle", "right").frame.y, 48);
  assert.equal(getSpriteFrame(runtimeManifest, "pursuit_tank", "idle", "down").frame.y, 96);
  assert.equal(getSpriteFrame(runtimeManifest, "repair_pickup", "idle", "any").frame.x, 0);
  assert.equal(getSpriteFrame(runtimeManifest, "ammo_pickup", "idle", "any").frame.x, 48);
  assert.equal(getSpriteFrame(runtimeManifest, "shield_pickup", "idle", "any").frame.x, 96);
  assert.equal(getSpriteFrame(runtimeManifest, "destroyed_tank", "idle", "any").frame.x, 0);
  assert.equal(getSpriteFrame(runtimeManifest, "destroyed_base", "idle", "any").frame.x, 48);
});

test("sprite manifest validation reports malformed sprite sheets", () => {
  assert.deepEqual(validateSpriteManifest(null), [
    "Sprite manifest must be an object."
  ]);

  assert.deepEqual(validateSpriteManifest({
    sheets: {
      broken_tank: {
        image: "",
        frameWidth: 0,
        frameHeight: 48,
        animations: {
          idle: {
            up: [[0]]
          }
        }
      }
    }
  }), [
    "Sprite broken_tank must include a non-empty image path.",
    "Sprite broken_tank must include positive frameWidth and frameHeight values.",
    "Sprite broken_tank animation idle direction up has an invalid frame."
  ]);
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

test("sprite loader reports missing image state when image construction is unavailable", async () => {
  const store = createSpriteAssetStore({
    manifest: directionalManifest,
    imageFactory: () => null
  });

  await store.load();

  assert.equal(store.getImageState("sprites/tanks/player.png").status, SPRITE_STATUS.MISSING);
  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.MISSING);
});

test("sprite loader clears stale image states when a fetched manifest changes", async () => {
  const manifests = [
    directionalManifest,
    { meta: { tileSize: 48 }, sheets: {} }
  ];
  const store = createSpriteAssetStore({
    manifestUrl: "https://example.test/assets/sprites/manifest.json",
    fetchFn: async () => ({
      ok: true,
      json: async () => manifests.shift()
    }),
    baseUrl: "https://example.test/assets/sprites/manifest.json",
    imageFactory: createFakeImageFactory("load")
  });

  await store.load();
  assert.equal(store.getImageState("sprites/tanks/player.png").status, SPRITE_STATUS.READY);

  await store.load();
  assert.equal(store.getImageState("sprites/tanks/player.png").status, SPRITE_STATUS.MISSING);
  assert.equal(store.getFrame("player_tank", "idle", "up").status, SPRITE_STATUS.MISSING);
});

test("sprite loader converts invalid provided manifests into fallback-safe errors", async () => {
  const store = createSpriteAssetStore({
    manifest: {
      sheets: {
        broken_tank: {
          image: "sprites/tanks/broken.png",
          frameWidth: 48,
          frameHeight: 48,
          animations: {
            idle: {
              up: []
            }
          }
        }
      }
    },
    imageFactory: () => {
      throw new Error("Invalid manifests should not request images");
    }
  });

  assert.equal(store.status, SPRITE_STATUS.ERROR);
  assert.equal(store.getFrame("broken_tank", "idle", "up").status, SPRITE_STATUS.ERROR);

  const manifestState = await store.load();
  assert.equal(manifestState.status, SPRITE_STATUS.ERROR);
  assert.equal(store.getImageState("sprites/tanks/broken.png").status, SPRITE_STATUS.MISSING);
});

test("sprite loader converts fetched invalid manifests into fallback-safe errors", async () => {
  const store = createSpriteAssetStore({
    manifestUrl: "https://example.test/assets/sprites/manifest.json",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        sheets: {
          broken_tank: {
            image: "sprites/tanks/broken.png",
            frameWidth: 48,
            frameHeight: 48,
            animations: {
              idle: {
                up: [["x", 0]]
              }
            }
          }
        }
      })
    }),
    imageFactory: () => {
      throw new Error("Invalid fetched manifests should not request images");
    }
  });

  const manifestState = await store.load();
  assert.equal(manifestState.status, SPRITE_STATUS.ERROR);
  assert.equal(store.status, SPRITE_STATUS.ERROR);
  assert.equal(store.getFrame("broken_tank", "idle", "up").reason, "manifest");
  assert.equal(store.getImageState("sprites/tanks/broken.png").status, SPRITE_STATUS.MISSING);
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
