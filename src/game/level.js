const tiles = [
  "###############",
  "#P....#.......#",
  "#.###.#.#####.#",
  "#...#...#.....#",
  "###.#.###.###.#",
  "#...#.....#...#",
  "#.#####.###.#.#",
  "#.....#.....#.#",
  "#.###.#####.#.#",
  "#...#.........#",
  "###############"
];

export function createTestLevel() {
  const playerSpawn = findPlayerSpawn(tiles);

  return {
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    playerSpawn
  };
}

export function isBlockedCell(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return true;
  }

  return level.tiles[y][x] === "#";
}

export function validatePlayerSpawn(level) {
  const { x, y } = level.playerSpawn;

  if (isBlockedCell(level, x, y)) {
    throw new Error(`Invalid player spawn at ${x}, ${y}`);
  }
}

function findPlayerSpawn(sourceTiles) {
  for (let y = 0; y < sourceTiles.length; y += 1) {
    const x = sourceTiles[y].indexOf("P");
    if (x !== -1) {
      return { x, y };
    }
  }

  throw new Error("Test level must include a player spawn tile.");
}
