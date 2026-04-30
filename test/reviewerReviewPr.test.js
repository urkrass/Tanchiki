import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  createGitHubClient,
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

test("review-pr parser accepts only the three review decisions and fixed repo", () => {
  const decisions = [
    ["comment", "HUMAN REVIEW REQUIRED: checking metadata."],
    ["approve", "APPROVED FOR MERGE\n\nIndependence: separate reviewer session."],
    ["request-changes", "CHANGES REQUESTED: blocking finding."],
  ];

  for (const [decision, body] of decisions) {
    assert.equal(
      parseArgs([
        "--pr=123",
        "--issue=MAR-298",
        `--decision=${decision}`,
        "--body",
        body,
      ]).decision,
      decision,
    );
  }

  assert.throws(
    () => parseArgs([
      "--pr",
      "123",
      "--issue",
      "MAR-298",
      "--decision",
      "comment",
      "--repo",
      "other/repo",
      "--body",
      "HUMAN REVIEW REQUIRED: wrong repo.",
    ]),
    /--repo must be urkrass\/Tanchiki/,
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

test("review-pr body rules cover every forbidden operation family", () => {
  for (const body of [
    "run gh pr merge 123",
    "run gh pr edit 123 --title x",
    "run gh issue edit 123 --add-label x",
    "run gh label create x",
    "run git push origin branch",
    "run git commit -m x",
    "run git tag v1",
    "run git reset --hard",
    "apply merge:auto-eligible after review",
  ]) {
    assert.match(
      getReviewBodyRefusalReason("comment", body),
      /forbidden merge, label, issue-edit, branch, or auto-merge intent/,
      body,
    );
  }

  assert.equal(
    getReviewBodyRefusalReason("request-changes", "CHANGES REQUESTED: fix token leak."),
    null,
  );
  assert.equal(
    getReviewBodyRefusalReason("request-changes", "BLOCKED: checks are failing."),
    null,
  );
  assert.match(
    getReviewBodyRefusalReason("request-changes", "CHANGES REQUESTED but APPROVED FOR MERGE"),
    /approval language/,
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

test("review-pr hard PR gates refuse closed merged non-main and unlinked PRs", () => {
  const cases = [
    {
      expected: /PR is not open/,
      pullRequest: { state: "closed" },
    },
    {
      expected: /already merged/,
      pullRequest: { merged: true, merged_at: "2026-04-30T00:00:00Z" },
    },
    {
      expected: /base branch is not main/,
      pullRequest: { base: { ref: "release" } },
    },
    {
      expected: /does not mention linked issue MAR-298/,
      options: { issue: "MAR-298" },
      pullRequest: { body: "Closes: MAR-296" },
    },
  ];

  for (const { expected, options, pullRequest } of cases) {
    const result = evaluateReviewGates({
      body: "HUMAN REVIEW REQUIRED: hard PR gate.",
      inspection: makeInspection({
        pullRequest: {
          ...makeInspection().pullRequest,
          ...pullRequest,
        },
      }),
      options: makeOptions({
        body: "HUMAN REVIEW REQUIRED: hard PR gate.",
        decision: "comment",
        ...options,
      }),
    });

    assert.match(result.refusalReasons.join("\n"), expected);
  }
});

test("review-pr approval gates fail closed for sensitive files and source scope drift", () => {
  const result = evaluateReviewGates({
    body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
    inspection: makeInspection({
      files: [
        { filename: ".env" },
        { filename: "secrets/reviewer.pem" },
        { filename: "ops/reviewer-env.ps1" },
        { filename: ".github/workflows/ci.yml" },
        { filename: "src/game.js" },
        { filename: "src\\game\\movement.js" },
      ],
      pullRequest: {
        ...makeInspection().pullRequest,
        body: makeInspection().pullRequest.body.replace("- Type: type:harness", "- Type: type:test"),
      },
    }),
    options: makeOptions(),
  });

  const refusals = result.refusalReasons.join("\n");
  assert.match(refusals, /local env file/);
  assert.match(refusals, /private key file/);
  assert.match(refusals, /local reviewer env file/);
  assert.match(refusals, /GitHub workflow file/);
  assert.match(refusals, /outside docs\/harness\/test issue scope/);
  assert.match(refusals, /protected movement core/);
});

test("review-pr approval gates fail closed for missing pending failed and unreadable checks", () => {
  const cases = [
    {
      checks: { checkRuns: [], status: { statuses: [] } },
      expected: /Required checks could not be determined/,
    },
    {
      checks: {
        checkRuns: [{ conclusion: null, name: "CI", status: "in_progress" }],
        status: { statuses: [] },
      },
      expected: /Check run CI is in_progress/,
    },
    {
      checks: {
        checkRuns: [{ conclusion: "success", name: "CI", status: "completed" }],
        status: { statuses: [{ context: "legacy", state: "pending" }], state: "pending" },
      },
      expected: /Commit status legacy is pending/,
    },
    {
      checks: { unavailableReason: "403 forbidden" },
      expected: /Check status could not be read/,
    },
  ];

  for (const { checks, expected } of cases) {
    const result = evaluateReviewGates({
      body: "APPROVED FOR MERGE\n\nIndependence: separate Reviewer App session.",
      inspection: makeInspection({ checks }),
      options: makeOptions(),
    });

    assert.match(result.refusalReasons.join("\n"), expected);
  }
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

test("review-pr constructed GitHub client is limited to PR inspection and review submission", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    requests.push({
      body: init.body ? JSON.parse(init.body) : null,
      method: init.method || "GET",
      path: parsedUrl.pathname + parsedUrl.search,
    });

    if (parsedUrl.pathname.endsWith("/pulls/7")) {
      return jsonResponse({ head: { sha: "abc123" }, number: 7 });
    }
    if (parsedUrl.pathname.endsWith("/issues/7")) {
      return jsonResponse({ labels: [] });
    }
    if (parsedUrl.pathname.endsWith("/pulls/7/files")) {
      return jsonResponse([{ filename: "test/reviewerReviewPr.test.js" }]);
    }
    if (parsedUrl.pathname.endsWith("/commits/abc123/check-runs")) {
      return jsonResponse({ check_runs: [] });
    }
    if (parsedUrl.pathname.endsWith("/commits/abc123/status")) {
      return jsonResponse({ statuses: [] });
    }
    if (parsedUrl.pathname.endsWith("/pulls/7/reviews")) {
      return jsonResponse({ id: 1 });
    }

    return {
      ok: false,
      status: 404,
      text: async () => "unexpected path",
    };
  };

  const client = createGitHubClient({
    fetchImpl,
    repo: "urkrass/Tanchiki",
    token: "fake-token",
  });

  await client.getPullRequest(7);
  await client.getIssue(7);
  await client.listPullRequestFiles(7);
  await client.getChecks("abc123");
  await client.submitReview(7, {
    body: "CHANGES REQUESTED: focused finding.",
    event: "REQUEST_CHANGES",
  });

  assert.deepEqual(requests, [
    { body: null, method: "GET", path: "/repos/urkrass/Tanchiki/pulls/7" },
    { body: null, method: "GET", path: "/repos/urkrass/Tanchiki/issues/7" },
    { body: null, method: "GET", path: "/repos/urkrass/Tanchiki/pulls/7/files?per_page=100&page=1" },
    { body: null, method: "GET", path: "/repos/urkrass/Tanchiki/commits/abc123/check-runs?per_page=100" },
    { body: null, method: "GET", path: "/repos/urkrass/Tanchiki/commits/abc123/status" },
    {
      body: {
        body: "CHANGES REQUESTED: focused finding.",
        event: "REQUEST_CHANGES",
      },
      method: "POST",
      path: "/repos/urkrass/Tanchiki/pulls/7/reviews",
    },
  ]);

  for (const request of requests) {
    assert.doesNotMatch(request.path, /merge|labels|dispatches|actions|hooks|branches|git\/refs/i);
  }
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

test("review-pr direct CLI refusal path does not hit class initialization ordering", () => {
  const result = spawnSync(process.execPath, [
    join(root, "scripts", "reviewer-review-pr.js"),
    "--pr",
    "117",
    "--issue",
    "MAR-296",
    "--decision",
    "comment",
    "--body",
    "APPROVED FOR MERGE",
  ], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Reviewer App PR review refused/);
  assert.match(result.stderr, /approval language/);
  assert.doesNotMatch(result.stderr, /Cannot access 'ReviewRefusal' before initialization/);
});

test("review-pr direct CLI environment failure does not hit class initialization ordering", () => {
  const env = { ...process.env };
  delete env.GITHUB_REVIEWER_APP_ID;
  delete env.GITHUB_REVIEWER_INSTALLATION_ID;
  delete env.GITHUB_REVIEWER_PRIVATE_KEY_PATH;

  const result = spawnSync(process.execPath, [
    join(root, "scripts", "reviewer-review-pr.js"),
    "--pr",
    "117",
    "--issue",
    "MAR-296",
    "--decision",
    "comment",
    "--body",
    "HUMAN REVIEW REQUIRED: missing local reviewer environment.",
  ], {
    cwd: root,
    encoding: "utf8",
    env,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GITHUB_REVIEWER_APP_ID is required/);
  assert.doesNotMatch(result.stderr, /Cannot access 'ReviewRefusal' before initialization/);
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

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}
