const CARDINAL_STEPS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

export function findGridPath({ start, isGoal, canEnterCell }) {
  if (!isCell(start) || typeof isGoal !== "function" || typeof canEnterCell !== "function") {
    return [];
  }

  const startKey = cellKey(start.x, start.y);
  const queue = [{ x: start.x, y: start.y }];
  const cameFrom = new Map([[startKey, null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (isGoal(current.x, current.y)) {
      return reconstructPath(current, cameFrom);
    }

    for (const step of CARDINAL_STEPS) {
      const next = {
        x: current.x + step.x,
        y: current.y + step.y
      };
      const key = cellKey(next.x, next.y);

      if (cameFrom.has(key) || !canEnterCell(next.x, next.y)) {
        continue;
      }

      cameFrom.set(key, current);
      queue.push(next);
    }
  }

  return [];
}

export function findPathToCell({ start, goal, canEnterCell }) {
  if (!isCell(goal)) {
    return [];
  }

  return findGridPath({
    start,
    isGoal: (x, y) => x === goal.x && y === goal.y,
    canEnterCell
  });
}

function reconstructPath(goal, cameFrom) {
  const path = [];
  let current = goal;

  while (current) {
    path.push({ x: current.x, y: current.y });
    current = cameFrom.get(cellKey(current.x, current.y));
  }

  return path.reverse();
}

function isCell(cell) {
  return cell && Number.isInteger(cell.x) && Number.isInteger(cell.y);
}

function cellKey(x, y) {
  return `${x},${y}`;
}

