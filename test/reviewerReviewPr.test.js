import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  evaluateReviewGates,
  getReviewBodyRefusalReason,
  main,
  parseArgs,
} from "../scripts/reviewer-review-pr.js";

const root = process.cwd();

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

function makeOptions(overrides = {}) {
  return {
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    bodyFile: null,
    decision: "approve",
    dryRun: false,
    issue: "MAR-296",
    pr: 123,
    repo: "urkrass/Tanchiki",
    ...overrides,
  };
}

function makeInspection(overrides = {}) {
  return {
    checks: {
      checkRuns: [
        {
          conclusion: "success",
          name: "CI",
          status: "completed",
        },
      ],
      status: {
        state: "success",
        statuses: [],
      },
    },
    files: [
      {
        filename: "scripts/reviewer-review-pr.js",
      },
    ],
    issue: {
      labels: [],
    },
    pullRequest: {
      base: { ref: "main" },
      body: [
        "## Linked Linear Issue",
        "Closes: MAR-296",
        "## Role / Type / Risk / Validation",
        "- Role: role:coder",
        "- Type: type:harness",
        "- Risk: risk:medium",
        "- Validation profile: validation:harness",
        "## Summary",
        "## Files Changed",
        "## Tests Run",
        "## Manual QA",
        "## Broad Scan Reason",
        "## Conflict Risk",
        "## Acceptance Labels",
        "## PR Readiness",
        "## Visible UI Expectation",
        "## Known Limitations",
      ].join("\n"),
      draft: false,
      head: { sha: "abc123" },
      html_url: "https://github.com/urkrass/Tanchiki/pull/123",
      merged: false,
      merged_at: null,
      state: "open",
    },
    ...overrides,
  };
}

test("review-pr parser requires explicit PR issue decision and body source", () => {
  assert.deepEqual(
    parseArgs([
      "--pr",
      "123",
      "--issue",
      "MAR-296",
      "--decision",
      "comment",
      "--body",
      "HUMAN REVIEW REQUIRED: metadata needs inspection.",
    ]),
    makeOptions({
      body: "HUMAN REVIEW REQUIRED: metadata needs inspection.",
      decision: "comment",
    }),
  );

  assert.throws(() => parseArgs([]), /--pr is required/);
  assert.throws(() => parseArgs(["--pr", "0"]), /positive integer/);
  assert.throws(
    () => parseArgs(["--pr", "1", "--issue", "ABC-1", "--decision", "comment", "--body", "x"]),
    /MAR-<number>/,
  );
  assert.throws(
    () => parseArgs(["--pr", "1", "--issue", "MAR-1", "--decision", "merge", "--body", "x"]),
    /comment, approve, or request-changes/,
  );
  assert.throws(
    () => parseArgs([
      "--pr",
      "1",
      "--issue",
      "MAR-1",
      "--decision",
      "comment",
      "--body",
      "x",
      "--body-file",
      "review.txt",
    ]),
    /exactly one/,
  );
  assert.throws(
    () => parseArgs(["--pr", "1", "--issue", "MAR-1", "--decision", "comment", "--shell", "gh"]),
    /Unknown argument/,
  );
});

test("review-pr body rules prevent unsafe or mismatched decisions", () => {
  assert.equal(
    getReviewBodyRefusalReason("approve", "APPROVED FOR MERGE\n\nIndependence: distinct run."),
    null,
  );
  assert.match(
    getReviewBodyRefusalReason("approve", "Looks good."),
    /APPROVED FOR MERGE/,
  );
  assert.match(
    getReviewBodyRefusalReason("approve", "APPROVED FOR MERGE"),
    /independence/,
  );
  assert.match(
    getReviewBodyRefusalReason("comment", "APPROVED FOR MERGE"),
    /approval language/,
  );
  assert.match(
    getReviewBodyRefusalReason("request-changes", "Please fix this."),
    /CHANGES REQUESTED or BLOCKED/,
  );
  assert.match(
    getReviewBodyRefusalReason("comment", "please run gh pr merge 123"),
    /forbidden/,
  );
  assert.match(
    getReviewBodyRefusalReason("comment", "apply merge:auto-eligible"),
    /forbidden/,
  );
});

test("review-pr approval gates require safe PR state metadata files labels and checks", () => {
  const pass = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection(),
    options: makeOptions(),
  });
  assert.deepEqual(pass.refusalReasons, []);

  const draft = evaluateReviewGates({
    body: "HUMAN REVIEW REQUIRED: draft PR.",
    inspection: makeInspection({
      pullRequest: {
        ...makeInspection().pullRequest,
        draft: true,
      },
    }),
    options: makeOptions({ body: "HUMAN REVIEW REQUIRED: draft PR.", decision: "comment" }),
  });
  assert.match(draft.refusalReasons.join("\n"), /Draft/);

  const missingMetadata = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection({
      pullRequest: {
        ...makeInspection().pullRequest,
        body: "Closes: MAR-296",
      },
    }),
    options: makeOptions(),
  });
  assert.match(missingMetadata.refusalReasons.join("\n"), /required heading/);

  const forbiddenFile = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection({
      files: [{ filename: "src/game/movement.js" }],
    }),
    options: makeOptions(),
  });
  assert.match(forbiddenFile.refusalReasons.join("\n"), /protected movement core/);

  const failingCheck = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection({
      checks: {
        checkRuns: [{ conclusion: "failure", name: "CI", status: "completed" }],
        status: { state: "failure", statuses: [] },
      },
    }),
    options: makeOptions(),
  });
  assert.match(failingCheck.refusalReasons.join("\n"), /failure/);

  const stopLabel = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection({
      issue: { labels: [{ name: "merge:human-required" }] },
    }),
    options: makeOptions(),
  });
  assert.match(stopLabel.refusalReasons.join("\n"), /stop label/);
});

test("review-pr comment can report metadata and check blockers without approving", () => {
  const result = evaluateReviewGates({
    body: "HUMAN REVIEW REQUIRED: PR metadata and checks need human inspection.",
    inspection: makeInspection({
      checks: {
        checkRuns: [],
        status: { state: "pending", statuses: [] },
      },
      pullRequest: {
        ...makeInspection().pullRequest,
        body: "Closes: MAR-296",
      },
    }),
    options: makeOptions({
      body: "HUMAN REVIEW REQUIRED: PR metadata and checks need human inspection.",
      decision: "comment",
    }),
  });

  assert.deepEqual(result.refusalReasons, []);
  assert.match(result.approvalOnlyRefusals.join("\n"), /required heading/);
  assert.match(result.approvalOnlyRefusals.join("\n"), /Required checks/);
});

test("review-pr refuses invalid args before token generation", async () => {
  let tokenCalled = false;
  const stderr = [];
  const exitCode = await main({
    argv: [],
    createTokenImpl: () => {
      tokenCalled = true;
    },
    stderr: (line) => stderr.push(line),
    stdout: () => {},
  });

  assert.equal(exitCode, 1);
  assert.equal(tokenCalled, false);
  assert.match(stderr.join("\n"), /Reviewer App PR review refused/);
  assert.match(stderr.join("\n"), /No review was submitted/);
});

test("review-pr package and static surface preserve token and forbidden-action boundaries", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const script = readRepoFile("scripts", "reviewer-review-pr.js");
  const readme = readRepoFile("README.md");
  const safety = readRepoFile("SAFETY_BOUNDARIES.md");
  const combined = `${script}\n${readme}\n${safety}`;

  assert.equal(
    packageJson.scripts["reviewer:review-pr"],
    "node scripts/reviewer-review-pr.js",
  );
  assert.match(packageJson.scripts.build, /node --check scripts\/reviewer-review-pr\.js/);
  assert.match(packageJson.scripts.lint, /node --check scripts\/reviewer-review-pr\.js/);

  for (const expected of [
    "npm run reviewer:review-pr -- --pr <PR_NUMBER> --issue <MAR-ID> --decision comment",
    "Allowed use: Reviewer App paired-review PR comments and reviews only.",
    "No merge, label, issue-edit, branch, workflow, or settings action will be performed.",
    "The higher-level Reviewer App PR-review executor may submit only constructed",
    "It is not a command runner, merge",
  ]) {
    assert.match(combined, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const forbiddenWrite of [
    "writeFileSync",
    "appendFileSync",
    "createWriteStream",
    "writeFile(",
    "appendFile(",
  ]) {
    assert.equal(script.includes(forbiddenWrite), false);
  }

  for (const forbiddenPattern of [
    /\/pulls\/[^"']+\/merge/i,
    /\/issues\/[^"']+\/labels/i,
    /enablePullRequestAutoMerge/i,
    /process\.env\.GH_TOKEN\s*=/,
  ]) {
    assert.equal(
      forbiddenPattern.test(script),
      false,
      `review-pr executor must not contain forbidden action: ${forbiddenPattern}`,
    );
  }
});
