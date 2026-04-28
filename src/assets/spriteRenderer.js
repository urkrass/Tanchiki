import { SPRITE_STATUS } from "./spriteManifest.js";

export function drawManifestSprite(context, spriteFrame, size) {
  if (!isReadySpriteFrame(spriteFrame)) {
    return false;
  }

  const { frame, imageElement } = spriteFrame;
  context.drawImage(
    imageElement,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -size / 2,
    -size / 2,
    size,
    size
  );
  return true;
}

export function isReadySpriteFrame(spriteFrame) {
  return Boolean(
    spriteFrame
    && spriteFrame.status === SPRITE_STATUS.READY
    && spriteFrame.imageElement
    && spriteFrame.frame
  );
}
