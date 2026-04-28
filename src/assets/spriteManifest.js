export const SPRITE_STATUS = Object.freeze({
  READY: "ready",
  LOADING: "loading",
  ERROR: "error",
  MISSING: "missing"
});

export function normalizeSpriteManifest(rawManifest = {}) {
  const sheets = rawManifest.sheets && typeof rawManifest.sheets === "object"
    ? rawManifest.sheets
    : {};

  return {
    meta: rawManifest.meta ?? {},
    sheets
  };
}

export function listSpriteImages(manifest) {
  return [...new Set(Object.values(normalizeSpriteManifest(manifest).sheets)
    .map((sheet) => sheet.image)
    .filter((image) => typeof image === "string" && image.length > 0))];
}

export function getSpriteFrame(manifest, spriteId, animation, direction = "any", frameIndex = 0) {
  const normalized = normalizeSpriteManifest(manifest);
  const sheet = normalized.sheets[spriteId];

  if (!sheet) {
    return missingFrame(spriteId, "sprite");
  }

  if (!sheet.image) {
    return missingFrame(spriteId, "image");
  }

  const animations = sheet.animations ?? {};
  const animationFrames = animations[animation];
  if (!animationFrames) {
    return missingFrame(spriteId, "animation");
  }

  const frames = animationFrames[direction] ?? animationFrames.any;
  if (!Array.isArray(frames) || frames.length === 0) {
    return missingFrame(spriteId, "direction");
  }

  const frame = frames[positiveModulo(frameIndex, frames.length)];
  if (!Array.isArray(frame) || frame.length < 2) {
    return missingFrame(spriteId, "frame");
  }

  const frameWidth = sheet.frameWidth;
  const frameHeight = sheet.frameHeight;
  if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight)) {
    return missingFrame(spriteId, "size");
  }

  return {
    status: SPRITE_STATUS.READY,
    spriteId,
    animation,
    direction,
    image: sheet.image,
    frame: {
      x: frame[0],
      y: frame[1],
      width: frameWidth,
      height: frameHeight
    }
  };
}

function missingFrame(spriteId, reason) {
  return {
    status: SPRITE_STATUS.MISSING,
    spriteId,
    reason
  };
}

function positiveModulo(value, size) {
  return ((value % size) + size) % size;
}
