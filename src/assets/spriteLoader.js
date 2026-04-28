import {
  SPRITE_STATUS,
  getSpriteFrame,
  listSpriteImages,
  normalizeSpriteManifest
} from "./spriteManifest.js";

export function createSpriteAssetStore({
  manifest = null,
  manifestUrl = null,
  fetchFn = globalThis.fetch?.bind(globalThis),
  imageFactory = createBrowserImage,
  baseUrl = manifestUrl ?? import.meta.url
} = {}) {
  const imageStates = new Map();
  let manifestState = manifest
    ? { status: SPRITE_STATUS.READY, data: normalizeSpriteManifest(manifest) }
    : { status: SPRITE_STATUS.MISSING, data: normalizeSpriteManifest() };

  return {
    get status() {
      return manifestState.status;
    },

    get manifest() {
      return manifestState.data;
    },

    getImageState(imagePath) {
      return imageStates.get(imagePath) ?? { status: SPRITE_STATUS.MISSING };
    },

    getFrame(spriteId, animation, direction = "any", frameIndex = 0) {
      const frame = getSpriteFrame(manifestState.data, spriteId, animation, direction, frameIndex);
      if (frame.status !== SPRITE_STATUS.READY) {
        return frame;
      }

      const imageState = imageStates.get(frame.image);
      if (!imageState) {
        return { ...frame, status: SPRITE_STATUS.MISSING, reason: "image-state" };
      }

      return {
        ...frame,
        status: imageState.status,
        imageElement: imageState.image ?? null,
        error: imageState.error ?? null
      };
    },

    async load() {
      if (manifestUrl) {
        manifestState = await loadManifest(manifestUrl, fetchFn);
      }

      if (manifestState.status !== SPRITE_STATUS.READY) {
        return manifestState;
      }

      const imagePaths = listSpriteImages(manifestState.data);
      for (const imagePath of imagePaths) {
        imageStates.set(imagePath, { status: SPRITE_STATUS.LOADING });
      }

      const loadedStates = await Promise.all(imagePaths.map(async (imagePath) => {
        const imageState = await loadImage(imagePath, imageFactory, baseUrl);
        return [imagePath, imageState];
      }));

      for (const [imagePath, imageState] of loadedStates) {
        imageStates.set(imagePath, imageState);
      }

      return manifestState;
    }
  };
}

async function loadManifest(manifestUrl, fetchFn) {
  if (!fetchFn) {
    return {
      status: SPRITE_STATUS.ERROR,
      data: normalizeSpriteManifest(),
      error: new Error("Sprite manifest fetch is unavailable")
    };
  }

  try {
    const response = await fetchFn(manifestUrl);
    if (!response.ok) {
      return {
        status: SPRITE_STATUS.ERROR,
        data: normalizeSpriteManifest(),
        error: new Error(`Sprite manifest request failed with ${response.status}`)
      };
    }

    return {
      status: SPRITE_STATUS.READY,
      data: normalizeSpriteManifest(await response.json())
    };
  } catch (error) {
    return {
      status: SPRITE_STATUS.ERROR,
      data: normalizeSpriteManifest(),
      error
    };
  }
}

function loadImage(imagePath, imageFactory, baseUrl) {
  let image;
  try {
    image = imageFactory();
  } catch (error) {
    return Promise.resolve({ status: SPRITE_STATUS.ERROR, error });
  }

  if (!image) {
    return Promise.resolve({ status: SPRITE_STATUS.MISSING });
  }

  return new Promise((resolve) => {
    image.onload = () => resolve({ status: SPRITE_STATUS.READY, image });
    image.onerror = (error) => resolve({ status: SPRITE_STATUS.ERROR, image, error });
    try {
      image.src = new URL(imagePath, baseUrl).href;
    } catch (error) {
      resolve({ status: SPRITE_STATUS.ERROR, image, error });
    }
  });
}

function createBrowserImage() {
  if (typeof Image === "undefined") {
    return null;
  }

  return new Image();
}
