import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  decideConductorStep,
  formatDecision,
  main,
  parseArgs,
} from "../scripts/conductor-step.js";

const root = process.cwd();
const activeProject = "Tanchiki - Playable Tank RPG Prototype";

function makeState(overrides = {}) {
  return {
    activeProject,
    reviewCadence: "paired-review",
    issues: [],
    prs: [],
    ...overrides,
  };
}

function producer(overrides = {}) {
  return {
    id: "MAR-328",
    labels: ["role:coder", "type:harness", "risk:medium", "validation:harness"],
    status: "In Review",
    title: "Conductor implementation",
    ...overrides,
  };
}

function reviewer(overrides = {}) {
  return {
    blockedBy: ["MAR-328"],
    id: "MAR-329",
    labels: ["role:reviewer", "type:harness", "risk:medium", "validation:harness"],
    producerId: "MAR-328",
    status: "Backlog",
    title: "Reviewer: paired-review PR for Conductor v1",
    ...overrides,
  };
}

function release(overrides = {}) {
  return {
    id: "MAR-330",
    labels: ["role:release", "type:docs", "risk:low", "validation:docs"],
    status: "Backlog",
    title: "Conductor release summary",
    ...overrides,
  };
}

function readyPr(overrides = {}) {
  return {
    checks: "passing",
    draft: false,
    labels: [],
    linkedIssueIds: ["MAR-328"],
    merged: false,
    metadata: "passing",
    number: 144,
    state: "open",
    url: "https://github.com/urkrass/Tanchiki/pull/144",
    ...overrides,
  };
}

test("conductor step stops when no eligible issue exists", () => {
  const decision = decideConductorStep(makeState());

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "no-eligible-issue");
  assert.match(formatDecision(decision), /Active project:/);
  assert.match(formatDecision(decision), /No eligible Conductor transition/);
});

test("conductor step promotes one paired reviewer after producer PR is ready", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr()],
  }));

  assert.equal(decision.decision, "promote");
  assert.equal(decision.transition, "producer-pr-ready");
  assert.equal(decision.targetIssue.id, "MAR-329");
  assert.deepEqual(decision.proposedMutation, {
    addLabels: ["automation-ready"],
    comment: "Promoted as paired-review Reviewer for open PR #144.",
    issueId: "MAR-329",
    state: "Todo",
  });
  assert.match(formatDecision(decision), /PR is open, non-draft, unmerged/);
});

test("conductor step stops when multiple reviewer promotions are eligible", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer(),
      producer({ id: "MAR-331", title: "Second producer" }),
      reviewer({ blockedBy: ["MAR-331"], id: "MAR-332", producerId: "MAR-331" }),
    ],
    prs: [
      readyPr(),
      readyPr({ linkedIssueIds: ["MAR-331"], number: 145 }),
    ],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "multiple-eligible-transitions");
  assert.match(formatDecision(decision), /MAR-329/);
  assert.match(formatDecision(decision), /MAR-332/);
});

for (const scenario of [
  {
    name: "draft PR",
    pr: readyPr({ draft: true }),
    expected: /still Draft/,
  },
  {
    name: "failing checks",
    pr: readyPr({ checks: "failing" }),
    expected: /checks are not passing/,
  },
  {
    name: "PR stop label",
    pr: readyPr({ labels: ["merge:do-not-merge"] }),
    expected: /stop labels/,
  },
]) {
  test(`conductor step stops for ${scenario.name}`, () => {
    const decision = decideConductorStep(makeState({
      issues: [producer(), reviewer()],
      prs: [scenario.pr],
    }));

    assert.equal(decision.decision, "stop");
    assert.equal(decision.reason, "blocked-transition");
    assert.match(formatDecision(decision), scenario.expected);
  });
}

test("conductor step safely stops when merged PR and review are recorded but Done mutation is not implemented", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "APPROVED FOR MERGE", status: "In Review" }),
    ],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "merged-pr-done-transition-not-implemented");
  assert.match(formatDecision(decision), /does not implement Linear Done transitions/);
  assert.match(decision.nextAction, /Mark producer\/reviewer Done/);
});

test("conductor step promotes release when upstream outcomes are terminal", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer({ status: "Done" }),
      reviewer({ reviewResult: "APPROVED FOR MERGE", status: "Done" }),
      release(),
    ],
  }));

  assert.equal(decision.decision, "promote");
  assert.equal(decision.transition, "release-ready");
  assert.equal(decision.targetIssue.id, "MAR-330");
  assert.deepEqual(decision.proposedMutation.addLabels, ["automation-ready"]);
});

test("conductor step records reviewer result without merging", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "CHANGES REQUESTED", status: "In Review" }),
    ],
    prs: [readyPr()],
  }));

  assert.equal(decision.decision, "comment");
  assert.equal(decision.transition, "reviewer-completed");
  assert.equal(decision.proposedMutation.state, "");
  assert.match(formatDecision(decision), /does not merge/);
});

test("conductor step CLI requires explicit active project outside fixture mode", () => {
  const stdout = [];
  const exitCode = main({
    argv: [],
    env: {},
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(stdout.join("\n"), /missing-active-project/);
});

test("conductor step CLI makes live mutation deferral explicit", () => {
  const stdout = [];
  const exitCode = main({
    argv: ["--active-project", activeProject],
    env: {},
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  const output = stdout.join("\n");
  assert.match(output, /standalone-mutation-not-implemented/);
  assert.match(output, /Standalone Linear\/GitHub mutation is not implemented/);
});

test("conductor step CLI prints required fields from a fixture", () => {
  const fixturePath = join(tmpdir(), `conductor-step-${Date.now()}.json`);
  writeFileSync(
    fixturePath,
    JSON.stringify(makeState({
      issues: [producer(), reviewer()],
      prs: [readyPr()],
    })),
  );

  const output = execFileSync(process.execPath, ["scripts/conductor-step.js", "--fixture", fixturePath], {
    cwd: root,
    encoding: "utf8",
  });

  for (const expected of [
    "Active project:",
    "Decision:",
    "Reason:",
    "Evidence:",
    "Proposed mutation:",
    "Next action:",
  ]) {
    assert.match(output, new RegExp(escapeRegExp(expected)));
  }
});

test("conductor step parser rejects ambiguous input sources", () => {
  assert.throws(
    () => parseArgs(["--fixture", "a.json", "--json", "{}"]),
    /only one/,
  );
  assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/);
});

test("conductor step package and static surface preserve safety boundaries", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const script = readRepoFile("scripts", "conductor-step.js");

  assert.equal(packageJson.scripts["conductor:step"], "node scripts/conductor-step.js");
  assert.match(packageJson.scripts.build, /node --check scripts\/conductor-step\.js/);
  assert.match(packageJson.scripts.build, /node --check test\/conductorStep\.test\.js/);
  assert.match(packageJson.scripts.lint, /node --check scripts\/conductor-step\.js/);
  assert.match(packageJson.scripts.lint, /node --check test\/conductorStep\.test\.js/);

  for (const forbidden of [
    "reviewer:agent",
    "api.openai.com",
    "submitReview",
    "/merge",
    "/labels",
    "spawnSync",
    "execFile",
    "writeFile",
    "appendFile",
    "createWriteStream",
  ]) {
    assert.equal(script.includes(forbidden), false, `unexpected unsafe surface: ${forbidden}`);
  }
});

test("conductor step direct command succeeds with an honest safe stop", () => {
  const result = spawnSync(process.execPath, ["scripts/conductor-step.js"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Conductor step/);
  assert.match(result.stdout, /missing-active-project/);
});

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
