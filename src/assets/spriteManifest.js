export const SPRITE_STATUS = Object.freeze({
  READY: "ready",
  LOADING: "loading",
  ERROR: "error",
  MISSING: "missing"
});

export function normalizeSpriteManifest(rawManifest = {}) {
  const source = rawManifest && typeof rawManifest === "object" ? rawManifest : {};
  const sheets = source.sheets && typeof source.sheets === "object" && !Array.isArray(source.sheets)
    ? source.sheets
    : {};

  return {
    meta: source.meta ?? {},
    sheets
  };
}

export function validateSpriteManifest(rawManifest = {}) {
  if (!rawManifest || typeof rawManifest !== "object" || Array.isArray(rawManifest)) {
    return ["Sprite manifest must be an object."];
  }

  const errors = [];
  const sheets = rawManifest.sheets;

  if (sheets === undefined) {
    return errors;
  }

  if (!sheets || typeof sheets !== "object" || Array.isArray(sheets)) {
    return ["Sprite manifest sheets must be an object."];
  }

  for (const [spriteId, sheet] of Object.entries(sheets)) {
    validateSpriteSheet(errors, spriteId, sheet);
  }

  return errors;
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

function validateSpriteSheet(errors, spriteId, sheet) {
  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
    errors.push(`Sprite ${spriteId} must be an object.`);
    return;
  }

  if (typeof sheet.image !== "string" || sheet.image.length === 0) {
    errors.push(`Sprite ${spriteId} must include a non-empty image path.`);
  }

  if (!isPositiveNumber(sheet.frameWidth) || !isPositiveNumber(sheet.frameHeight)) {
    errors.push(`Sprite ${spriteId} must include positive frameWidth and frameHeight values.`);
  }

  if (!sheet.animations || typeof sheet.animations !== "object" || Array.isArray(sheet.animations)) {
    errors.push(`Sprite ${spriteId} must include an animations object.`);
    return;
  }

  for (const [animationName, directions] of Object.entries(sheet.animations)) {
    validateAnimationDirections(errors, spriteId, animationName, directions);
  }
}

function validateAnimationDirections(errors, spriteId, animationName, directions) {
  if (!directions || typeof directions !== "object" || Array.isArray(directions)) {
    errors.push(`Sprite ${spriteId} animation ${animationName} must include direction frame arrays.`);
    return;
  }

  for (const [direction, frames] of Object.entries(directions)) {
    if (!Array.isArray(frames) || frames.length === 0) {
      errors.push(`Sprite ${spriteId} animation ${animationName} direction ${direction} must include frames.`);
      continue;
    }

    for (const frame of frames) {
      if (!isFrameCoordinate(frame)) {
        errors.push(`Sprite ${spriteId} animation ${animationName} direction ${direction} has an invalid frame.`);
        break;
      }
    }
  }
}

function isFrameCoordinate(frame) {
  return Array.isArray(frame)
    && frame.length >= 2
    && Number.isFinite(frame[0])
    && Number.isFinite(frame[1])
    && frame[0] >= 0
    && frame[1] >= 0;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function positiveModulo(value, size) {
  return ((value % size) + size) % size;
}
