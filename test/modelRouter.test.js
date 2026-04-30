import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { formatRecommendation, routeIssue } from "../scripts/model-router.js";

const root = process.cwd();

test("dry-run router recommends local-ok for bounded low-risk harness docs", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-999",
      title: "Tighten docs wording",
      status: "Todo",
      labels: ["role:coder", "type:harness", "risk:low", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "local-ok",
      contextPack: "Issue Context Pack: narrow docs helper.",
    },
  });

  assert.equal(recommendation.run, true);
  assert.equal(recommendation.recommendedModelClass, "local-ok");
  assert.equal(recommendation.requiredIdentity, "normal GitHub");
});

test("dry-run router stops for human gates", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1000",
      title: "Human gate",
      status: "Todo",
      labels: ["role:architect", "type:harness", "risk:human-only", "validation:harness", "human-only"],
      reviewCadence: "paired-review",
      modelHint: "human-only",
      contextPack: "Issue Context Pack: human approval required.",
    },
  });

  assert.equal(recommendation.run, false);
  assert.equal(recommendation.recommendedModelClass, "human-only");
  assert.equal(recommendation.requiredIdentity, "human-only");
  assert.match(formatRecommendation(recommendation), /DO NOT RUN/);
});

test("dry-run router requires Reviewer App identity for PR review issues", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1001",
      title: "Reviewer: paired-review policy PR",
      status: "Todo",
      labels: ["role:reviewer", "type:harness", "risk:medium", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "frontier",
      contextPack: "Issue Context Pack: Reviewer inspects PR.",
      pr: {
        number: 109,
        state: "open",
        draft: false,
        merged: false,
        checks: "passing",
      },
    },
  });

  assert.equal(recommendation.run, true);
  assert.equal(recommendation.recommendedModelClass, "frontier");
  assert.equal(recommendation.requiredIdentity, "Reviewer App");
  assert.equal(recommendation.recommendedPrompt, "prompts/short/reviewer-app-dispatcher.md");
});

test("dry-run router refuses ambiguous or incomplete metadata", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1002",
      title: "Missing risk metadata",
      status: "Todo",
      labels: ["role:coder", "type:harness", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "frontier",
      contextPack: "Issue Context Pack: missing risk.",
    },
  });

  assert.equal(recommendation.run, false);
  assert.match(formatRecommendation(recommendation), /risk metadata must have exactly one/);
});

test("dry-run router refuses stop labels blockers and missing cadence", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1005",
      title: "Blocked router issue",
      status: "Todo",
      labels: [
        "role:coder",
        "type:harness",
        "risk:low",
        "validation:harness",
        "merge:do-not-merge",
      ],
      modelHint: "cheap",
      contextPack: "Issue Context Pack: blocked by review.",
      blockedBy: ["MAR-1004"],
    },
  });

  const output = formatRecommendation(recommendation);

  assert.equal(recommendation.run, false);
  assert.match(output, /missing review cadence/);
  assert.match(output, /stop labels present: merge:do-not-merge/);
  assert.match(output, /unresolved blockers present: MAR-1004/);
});

test("dry-run router refuses duplicate Level 5 metadata", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1006",
      title: "Duplicate role metadata",
      status: "Todo",
      labels: ["role:coder", "role:test", "type:test", "risk:low", "validation:test"],
      reviewCadence: "paired-review",
      modelHint: "cheap",
      contextPack: "Issue Context Pack: duplicate role metadata.",
    },
  });

  assert.equal(recommendation.run, false);
  assert.match(formatRecommendation(recommendation), /role metadata must have exactly one role:\*/);
});

test("dry-run router refuses paired-review reviewer PR readiness gaps", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1007",
      title: "Reviewer: draft PR",
      status: "Todo",
      labels: ["role:reviewer", "type:harness", "risk:medium", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "frontier",
      contextPack: "Issue Context Pack: Reviewer inspects PR readiness.",
      pr: {
        number: 110,
        state: "open",
        draft: true,
        merged: false,
        checks: "pending",
      },
    },
  });

  const output = formatRecommendation(recommendation);

  assert.equal(recommendation.run, false);
  assert.equal(recommendation.requiredIdentity, "Reviewer App");
  assert.match(output, /paired-review PR is Draft/);
  assert.match(output, /paired-review PR checks are not passing: pending/);
});

test("dry-run router recommends frontier for trust-boundary work", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1003",
      title: "Trust-boundary router policy",
      status: "Todo",
      labels: ["role:coder", "type:harness", "risk:medium", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "frontier",
      contextPack: "Issue Context Pack: trust-boundary model routing.",
    },
  });

  assert.equal(recommendation.run, true);
  assert.equal(recommendation.recommendedModelClass, "frontier");
});

test("dry-run router refuses low-cost hints that conflict with stricter lanes", () => {
  const recommendation = routeIssue({
    activeProject: "Tanchiki - Playable Tank RPG Prototype",
    issue: {
      id: "MAR-1008",
      title: "Trust-boundary model router",
      status: "Todo",
      labels: ["role:coder", "type:harness", "risk:medium", "validation:harness"],
      reviewCadence: "paired-review",
      modelHint: "local-ok",
      contextPack: "Issue Context Pack: trust-boundary model routing work.",
    },
  });

  const output = formatRecommendation(recommendation);

  assert.equal(recommendation.recommendedModelClass, "frontier");
  assert.equal(recommendation.run, false);
  assert.match(output, /model_hint conflicts with role\/type\/risk\/validation/);
});

test("dry-run router helper has no live dispatch write or merge operations", () => {
  const source = readFileSync("scripts/model-router.js", "utf8");

  for (const forbidden of [
    "save_issue",
    "save_comment",
    "gh pr",
    "gh merge",
    "Campaign Conductor",
    "Dispatcher",
    "spawn_agent",
    "fetch(",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected live operation marker: ${forbidden}`);
  }
});

test("dry-run router CLI prints required fields from a fixture", () => {
  const fixturePath = join(tmpdir(), `model-router-${Date.now()}.json`);
  writeFileSync(
    fixturePath,
    JSON.stringify({
      activeProject: "Tanchiki - Playable Tank RPG Prototype",
      issue: {
        id: "MAR-1004",
        title: "Release summary",
        status: "Todo",
        labels: ["role:release", "type:docs", "risk:low", "validation:docs"],
        reviewCadence: "paired-review",
        modelHint: "cheap",
        contextPack: "Issue Context Pack: release summary.",
      },
    }),
  );

  const output = execFileSync(process.execPath, ["scripts/model-router.js", "--fixture", fixturePath], {
    cwd: root,
    encoding: "utf8",
  });

  for (const expected of [
    "RUN",
    "next issue:",
    "active Linear project:",
    "role/type/risk/validation:",
    "review cadence:",
    "model_hint:",
    "recommended model class:",
    "required identity:",
    "recommended prompt:",
    "required context pack:",
    "validation profile:",
    "stop conditions:",
    "next human action:",
  ]) {
    assert.match(output, new RegExp(escapeRegExp(expected)));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
