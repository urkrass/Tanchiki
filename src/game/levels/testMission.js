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
  ],
  pickups: [
    {
      id: "repair-1",
      type: "repair",
      gridX: 2,
      gridY: 1,
      amount: 1
    },
    {
      id: "ammo-1",
      type: "ammo",
      gridX: 3,
      gridY: 1,
      amount: 3
    },
    {
      id: "shield-1",
      type: "shield",
      gridX: 4,
      gridY: 1,
      amount: 1
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
  ],
  pickups: [
    {
      id: "checkpoint-repair",
      type: "repair",
      gridX: 2,
      gridY: 1,
      amount: 1
    },
    {
      id: "checkpoint-shield",
      type: "shield",
      gridX: 5,
      gridY: 2,
      amount: 1
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
  ],
  pickups: [
    {
      id: "approach-ammo",
      type: "ammo",
      gridX: 2,
      gridY: 1,
      amount: 3
    },
    {
      id: "approach-repair",
      type: "repair",
      gridX: 4,
      gridY: 9,
      amount: 1
    }
  ]
};

export const CAMPAIGN_LEVEL_SCHEMAS = [
  TEST_MISSION_SCHEMA,
  CHECKPOINT_MISSION_SCHEMA,
  BASE_APPROACH_MISSION_SCHEMA
];
