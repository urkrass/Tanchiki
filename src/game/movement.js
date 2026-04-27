export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 })
});

const VALID_DIRECTIONS = new Set(Object.keys(DIRECTIONS));

export function createMovementState({
  gridX,
  gridY,
  facing = "up",
  speedCellsPerSecond = 3
}) {
  assertDirection(facing);

  return {
    gridX,
    gridY,
    facing,
    speedCellsPerSecond,
    isMoving: false,
    fromX: gridX,
    fromY: gridY,
    toX: gridX,
    toY: gridY,
    moveProgress: 0,
    bufferedDirection: null
  };
}

export function requestMove(state, direction, canEnter = () => true) {
  assertDirection(direction);

  if (state.isMoving) {
    state.bufferedDirection = direction;
    return false;
  }

  if (state.facing !== direction) {
    state.facing = direction;
    state.bufferedDirection = null;
    return false;
  }

  return startMove(state, direction, canEnter);
}

export function updateMovement(state, deltaSeconds, canEnter = () => true) {
  if (!state.isMoving || deltaSeconds <= 0) {
    return;
  }

  state.moveProgress = Math.min(
    1,
    state.moveProgress + deltaSeconds * state.speedCellsPerSecond
  );

  if (state.moveProgress < 1) {
    return;
  }

  // gridX/gridY are the only canonical logical position and change only on arrival.
  state.gridX = state.toX;
  state.gridY = state.toY;
  state.fromX = state.gridX;
  state.fromY = state.gridY;
  state.toX = state.gridX;
  state.toY = state.gridY;
  state.moveProgress = 0;
  state.isMoving = false;

  const nextDirection = state.bufferedDirection;
  state.bufferedDirection = null;

  if (nextDirection) {
    requestMove(state, nextDirection, canEnter);
  }
}

export function getVisualPosition(state) {
  if (!state.isMoving) {
    return { x: state.gridX, y: state.gridY };
  }

  return {
    x: lerp(state.fromX, state.toX, state.moveProgress),
    y: lerp(state.fromY, state.toY, state.moveProgress)
  };
}

function startMove(state, direction, canEnter) {
  const offset = DIRECTIONS[direction];
  const targetX = state.gridX + offset.x;
  const targetY = state.gridY + offset.y;

  if (!canEnter(targetX, targetY)) {
    return false;
  }

  state.fromX = state.gridX;
  state.fromY = state.gridY;
  state.toX = targetX;
  state.toY = targetY;
  state.moveProgress = 0;
  state.isMoving = true;
  state.bufferedDirection = null;
  return true;
}

function assertDirection(direction) {
  if (!VALID_DIRECTIONS.has(direction)) {
    throw new Error(`Invalid direction: ${direction}`);
  }
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}
