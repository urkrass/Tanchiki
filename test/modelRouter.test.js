import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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
