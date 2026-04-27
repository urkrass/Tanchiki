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
      solid: true
    },
    {
      id: "dummy-2",
      type: "dummy",
      team: "enemy",
      gridX: 8,
      gridY: 3,
      hp: 2,
      solid: true
    },
    {
      id: "dummy-3",
      type: "dummy",
      team: "enemy",
      gridX: 10,
      gridY: 9,
      hp: 2,
      solid: true,
      patrolRoute: [
        { x: 10, y: 9 },
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 9, y: 9 }
      ]
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

export const CHECKPOINT_MISSION_SCHEMA = {
  id: "checkpoint-mission",
  width: 15,
  height: 11,
  tiles: [
    "###############",
    "#P....#.......#",
    "#.##..#.#####.#",
    "#...#...#.....#",
    "###.#.###.###.#",
    "#...#.....#...#",
    "#.###.#####.#.#",
    "#.....#.....#.#",
    "#.###.#.###.#.#",
    "#.....#.......#",
    "###############"
  ],
  playerSpawn: { x: 1, y: 1 },
  entities: [
    {
      id: "checkpoint-sentry-1",
      type: "dummy",
      team: "enemy",
      gridX: 8,
      gridY: 3,
      hp: 2,
      solid: true
    },
    {
      id: "checkpoint-sentry-2",
      type: "dummy",
      team: "enemy",
      gridX: 4,
      gridY: 7,
      hp: 2,
      solid: true,
      pursuitTarget: "player"
    },
    {
      id: "checkpoint-base",
      type: "base",
      team: "enemy",
      gridX: 12,
      gridY: 9,
      hp: 6,
      solid: true
    }
  ]
};

export const BASE_APPROACH_MISSION_SCHEMA = {
  id: "base-approach-mission",
  width: 15,
  height: 11,
  tiles: [
    "###############",
    "#P....#.......#",
    "#.###.#.###.#.#",
    "#...#...#...#.#",
    "###.#####.#.#.#",
    "#...#.....#...#",
    "#.#.###.###.###",
    "#.#...#.......#",
    "#.###.#.#####.#",
    "#.....#.......#",
    "###############"
  ],
  playerSpawn: { x: 1, y: 1 },
  entities: [
    {
      id: "approach-sentry-1",
      type: "dummy",
      team: "enemy",
      gridX: 7,
      gridY: 5,
      hp: 2,
      solid: true
    },
    {
      id: "approach-sentry-2",
      type: "dummy",
      team: "enemy",
      gridX: 12,
      gridY: 3,
      hp: 2,
      solid: true
    },
    {
      id: "approach-sentry-3",
      type: "dummy",
      team: "enemy",
      gridX: 3,
      gridY: 9,
      hp: 2,
      solid: true
    },
    {
      id: "approach-base",
      type: "base",
      team: "enemy",
      gridX: 12,
      gridY: 9,
      hp: 6,
      solid: true
    }
  ]
};

export const CAMPAIGN_LEVEL_SCHEMAS = [
  TEST_MISSION_SCHEMA,
  CHECKPOINT_MISSION_SCHEMA,
  BASE_APPROACH_MISSION_SCHEMA
];
