export const TEST_MISSION_SCHEMA = {
  id: "test-mission",
  width: 15,
  height: 11,
  tiles: [
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
  ],
  playerSpawn: { x: 1, y: 1 },
  entities: [
    {
      id: "dummy-1",
      type: "dummy",
      team: "enemy",
      gridX: 4,
      gridY: 3,
      hp: 2,
      solid: true,
      fireCooldownSeconds: 1.45,
      windupSeconds: 0.6
    },
    {
      id: "dummy-2",
      type: "dummy",
      team: "enemy",
      gridX: 8,
      gridY: 3,
      hp: 2,
      solid: true,
      fireCooldownSeconds: 1.45,
      windupSeconds: 0.6
    },
    {
      id: "dummy-3",
      type: "dummy",
      team: "enemy",
      gridX: 10,
      gridY: 9,
      hp: 2,
      solid: true,
      fireCooldownSeconds: 1.45,
      windupSeconds: 0.6
    },
    {
      id: "enemy-base",
      type: "base",
      team: "enemy",
      gridX: 12,
      gridY: 9,
      hp: 6,
      solid: true
    }
  ]
};
