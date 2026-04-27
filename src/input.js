const keyToDirection = new Map([
  ["ArrowUp", "up"],
  ["KeyW", "up"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["ArrowDown", "down"],
  ["KeyS", "down"],
  ["ArrowLeft", "left"],
  ["KeyA", "left"]
]);

const scrollKeys = new Set([...keyToDirection.keys(), "Space"]);

export function createInput(target) {
  const heldKeys = new Set();
  const heldDirections = new Map();
  let queuedDirection = null;
  let latestHeldCode = null;
  let shootIntent = false;

  target.addEventListener("keydown", (event) => {
    if (scrollKeys.has(event.code)) {
      event.preventDefault();
    }

    if (event.code === "Space") {
      shootIntent = true;
      return;
    }

    const direction = keyToDirection.get(event.code);
    if (!direction) {
      return;
    }

    if (event.repeat || heldKeys.has(event.code)) {
      return;
    }

    heldKeys.add(event.code);
    heldDirections.set(event.code, direction);
    latestHeldCode = event.code;
    queuedDirection = direction;
  });

  target.addEventListener("keyup", (event) => {
    if (scrollKeys.has(event.code)) {
      event.preventDefault();
    }

    const direction = keyToDirection.get(event.code);
    if (!direction) {
      return;
    }

    heldKeys.delete(event.code);
    heldDirections.delete(event.code);
    if (latestHeldCode === event.code) {
      latestHeldCode = heldKeys.values().next().value || null;
    }
  });

  target.addEventListener("blur", () => {
    heldKeys.clear();
    heldDirections.clear();
    queuedDirection = null;
    latestHeldCode = null;
  });

  return {
    consumeMoveDirection() {
      const direction = queuedDirection;
      queuedDirection = null;
      return direction;
    },

    getHeldMoveDirection() {
      if (!latestHeldCode) {
        return null;
      }

      return heldDirections.get(latestHeldCode) || null;
    },

    consumeShootIntent() {
      const intent = shootIntent;
      shootIntent = false;
      return intent;
    }
  };
}
