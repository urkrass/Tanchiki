import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

test("default dispatcher prompt prints Level 5 metadata and gate refusal requirements", () => {
  const prompt = execFileSync(process.execPath, ["scripts/print-codex-next.js"], {
    cwd: root,
    encoding: "utf8",
  });

  for (const expected of [
    "Follow the repo harness protocols, including Level 5 risk-gated validation.",
    "exactly one `role:*`",
    "exactly one `type:*`",
    "exactly one `risk:*`",
    "exactly one `validation:*`",
    "remove `blocked`, `needs-human-approval`, `human-only`, and `risk:human-only` before automation",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("role router policy defines concise refusal copy for metadata and gate failures", () => {
  const policy = readRepoFile("ops", "policies", "role-router.md");

  for (const expected of [
    "Dispatcher stopped: this issue is not eligible for automation yet.",
    "role labels: expected exactly one `role:*`, found <value>",
    "type labels: expected exactly one `type:*`, found <value>",
    "risk labels: expected exactly one `risk:*`, found <value>",
    "validation labels: expected exactly one `validation:*`, found <value>",
    "gate labels: remove any of `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only` before adding `automation-ready`",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("risk-gated validation policy keeps human-only movement issues non-automatable", () => {
  const policy = readRepoFile("ops", "policies", "risk-gated-validation.md");

  assert.match(policy, /does not have `risk:human-only`/);
  assert.match(policy, /Issues with `type:movement` should normally receive `risk:human-only`/);
  assert.match(policy, /human approval required by default/);
});

test("campaign request template keeps intake gated from implementation", () => {
  const template = readRepoFile(".github", "ISSUE_TEMPLATE", "campaign-request.yml");

  for (const expected of [
    "Submit a structured campaign brief for Planner + Auto-Groomer intake.",
    "does not authorize Coder work",
    "dependencies, human gates, and only the first safe Architect issue marked automation-ready",
    "Primary request category",
    "Movement, collision, spawning, or control feel",
    "Persistence, credentials, destructive repo work, or broad architecture",
    "Human approval gates",
    "Do not make Coder issues automation-ready until Architect and human gates are complete.",
  ]) {
    assert.match(template, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign request planner prompt exposes only the first safe Architect issue", () => {
  const prompt = readRepoFile("prompts", "codex-plan-campaign-request.md");

  for (const expected of [
    "Treat the request as intake for planning and grooming only.",
    "Do not let a request directly trigger Coder work.",
    "If required request fields are missing, create or report a human-gated clarification issue instead of guessing.",
    "Do not apply `automation-ready` to Coder, Test, Reviewer, Release, blocked, human-only, or needs-human-approval issues during intake.",
    "Make only the first safe Architect issue `Todo` + `automation-ready`.",
    "Keep all Coder/Test/Reviewer/Release issues Backlog or blocked until Architect and human gates are complete.",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign factory policy documents unsafe-category gates and metadata", () => {
  const policy = readRepoFile("ops", "policies", "campaign-factory.md");

  for (const expected of [
    "The campaign factory is an intake, planning, and grooming workflow.",
    "It does not authorize implementation, source edits, dependency additions, pull requests, merges, or Done-state changes.",
    "`needs-human-approval`: gameplay behavior, progression, level tuning, dependency additions",
    "`human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations",
    "`automation-ready` only for the single issue the dispatcher may run next",
    "Campaign requests must never directly promote Coder work to `automation-ready`.",
    "no blocked, gated, human-only, parent, umbrella, or `risk:human-only` issue has `automation-ready`",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign factory checklist guards queue grooming invariants", () => {
  const checklist = readRepoFile("ops", "checklists", "campaign-factory-checklist.md");

  for (const expected of [
    "If required fields are missing, create or report a human-gated clarification item instead of guessing.",
    "Classify the request as `safe planning request`, `needs-human-approval`, or `human-only`.",
    "Apply exactly one `role:*` label to every issue where applicable.",
    "Apply exactly one `type:*` label to every issue where applicable.",
    "Apply exactly one `risk:*` label to every issue where applicable.",
    "Apply exactly one `validation:*` label to every issue where applicable.",
    "Confirm no Coder issue became automation-ready directly from request intake.",
    "Confirm no `risk:human-only` issue has `automation-ready`.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
