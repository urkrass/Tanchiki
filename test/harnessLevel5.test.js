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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
