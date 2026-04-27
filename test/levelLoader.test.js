import test from "node:test";
import assert from "node:assert/strict";
import { loadLevelSchema } from "../src/game/levelLoader.js";
import { TEST_MISSION_SCHEMA } from "../src/game/levels/testMission.js";

test("loads the test mission schema into level and entity runtime state", () => {
  const mission = loadLevelSchema(TEST_MISSION_SCHEMA);

  assert.equal(mission.level.id, "test-mission");
  assert.equal(mission.level.width, 15);
  assert.equal(mission.level.height, 11);
  assert.deepEqual(mission.level.playerSpawn, { x: 1, y: 1 });
  assert.equal(mission.level.tiles[1], "#P....#.......#");
  assert.equal(mission.targets.length, 4);
  assert.equal(mission.pickups.length, 3);
  assert.deepEqual(
    mission.targets.map((target) => [target.id, target.type, target.team, target.gridX, target.gridY, target.hp, target.solid]),
    [
      ["dummy-1", "dummy", "enemy", 4, 3, 2, true],
      ["dummy-2", "dummy", "enemy", 8, 3, 2, true],
      ["dummy-3", "dummy", "enemy", 10, 9, 2, true],
      ["enemy-base", "base", "enemy", 12, 9, 6, true]
    ]
  );
  assert.deepEqual(
    mission.pickups.map((pickup) => [pickup.id, pickup.type, pickup.gridX, pickup.gridY, pickup.amount, pickup.active]),
    [
      ["repair-1", "repair", 2, 1, 1, true],
      ["ammo-1", "ammo", 3, 1, 3, true],
      ["shield-1", "shield", 4, 1, 1, true]
    ]
  );
});

test("loads patrol route schema into entity runtime state", () => {
  const mission = loadLevelSchema({
    id: "patrol-route",
    tiles: [
      "#####",
      "#P..#",
      "#####"
    ],
    entities: [
      {
        id: "patrol",
        gridX: 2,
        gridY: 1,
        patrolRoute: [
          { x: 2, y: 1 },
          { x: 3, y: 1 }
        ],
        patrolSpeedCellsPerSecond: 2
      }
    ]
  });

  assert.deepEqual(mission.targets[0].patrolRoute, [
    { x: 2, y: 1 },
    { x: 3, y: 1 }
  ]);
  assert.equal(mission.targets[0].patrolSpeedCellsPerSecond, 2);
});

test("derives player spawn from P tile when playerSpawn is omitted", () => {
  const mission = loadLevelSchema({
    id: "spawn-from-tile",
    tiles: [
      "###",
      "#P#",
      "###"
    ]
  });

  assert.deepEqual(mission.level.playerSpawn, { x: 1, y: 1 });
});

test("rejects tile rows that do not match declared width", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-width",
      width: 3,
      height: 2,
      tiles: [
        "###",
        "##"
      ]
    }),
    /rows must all match width/
  );
});

test("rejects player spawn inside a wall", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-spawn",
      tiles: [
        "###",
        "#.#",
        "###"
      ],
      playerSpawn: { x: 0, y: 0 }
    }),
    /spawn is inside a wall/
  );
});

test("rejects entities outside level bounds", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-entity",
      tiles: [
        "###",
        "#P#",
        "###"
      ],
      entities: [
        { id: "blocked", gridX: 3, gridY: 1 }
      ]
    }),
    /entity blocked is outside level bounds/
  );
});

test("rejects pickups inside walls", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-pickup",
      tiles: [
        "###",
        "#P#",
        "###"
      ],
      pickups: [
        { id: "repair", type: "repair", gridX: 0, gridY: 0 }
      ]
    }),
    /pickup repair is inside a wall/
  );
});

test("rejects pickups overlapping player spawn", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "spawn-pickup",
      tiles: [
        "###",
        "#P#",
        "###"
      ],
      pickups: [
        { id: "repair", type: "repair", gridX: 1, gridY: 1 }
      ]
    }),
    /overlaps the player spawn/
  );
});

test("rejects pickups overlapping solid entities", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "entity-pickup",
      tiles: [
        "#####",
        "#P..#",
        "#####"
      ],
      entities: [
        { id: "blocker", gridX: 2, gridY: 1 }
      ],
      pickups: [
        { id: "repair", type: "repair", gridX: 2, gridY: 1 }
      ]
    }),
    /overlaps a solid entity/
  );
});

test("rejects patrol routes that enter walls", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-patrol",
      tiles: [
        "#####",
        "#P#.#",
        "#####"
      ],
      entities: [
        {
          id: "patrol",
          gridX: 1,
          gridY: 1,
          patrolRoute: [
            { x: 1, y: 1 },
            { x: 2, y: 1 }
          ]
        }
      ]
    }),
    /patrolRoute enters a wall/
  );
});

test("rejects patrol routes with diagonal loop segments", () => {
  assert.throws(
    () => loadLevelSchema({
      id: "bad-patrol-loop",
      tiles: [
        "######",
        "#P...#",
        "#....#",
        "######"
      ],
      entities: [
        {
          id: "patrol",
          gridX: 2,
          gridY: 1,
          patrolRoute: [
            { x: 2, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 2 }
          ]
        }
      ]
    }),
    /segments must be orthogonal/
  );
});
