import assert from "node:assert/strict";
import test from "node:test";
import {
  activeLinearProject,
  createGitHubMaintenanceClient,
  defaultRepo,
  formatMaintenanceReport,
  guardOutcomes,
  redactMaintenanceText,
  requiredValidationCommands,
  runMaintenanceGuard,
  sanitizeMaintenanceError,
} from "../scripts/maintenance-guard.js";

const fakeToken = "fake-maintenance-token-for-tests-only-123456";

function completePrBody({
  activeProject = activeLinearProject,
  broadScanReason = "No broad scan was used.",
  issue = "MAR-419",
  testsRun = requiredValidationCommands,
} = {}) {
  return [
    "## Linked Linear Issue",
    "",
    `Closes: ${issue}`,
    "",
    `Active Linear project: ${activeProject}`,
    "",
    "## Role / Type / Risk / Validation",
    "",
    "- Role: Coder",
    "- Type: Harness",
    "- Risk: Medium",
    "- Validation profile: Harness",
    "",
    "## Summary",
    "",
    "- Adds a read-only Maintenance Guard report helper.",
    "",
    "## Files Changed",
    "",
    "- Harness scripts and tests only.",
    "",
    "## Tests Run",
    "",
    ...testsRun.map((command) => `- ${command}`),
    "",
    "## Manual QA",
    "",
    "- Not applicable; harness-only change.",
    "",
    "## Broad Scan Reason",
    "",
    `- ${broadScanReason}`,
    "",
    "## Conflict Risk",
    "",
    "- Low; harness helper only.",
    "",
    "## Acceptance Labels",
    "",
    "- Merge label: none",
    "- Reviewer label: none",
    "- Human gate: none",
    "",
    "## PR Readiness",
    "",
    "- Draft allowed reason, if Draft: none",
    "- Paired-review candidate: yes",
    "- Auto-merge candidate: no",
    "",
    "## Visible UI Expectation",
    "",
    "- No visible UI change.",
    "",
    "## Known Limitations",
    "",
    "- Report-only helper; it does not create cleanup issues.",
  ].join("\n");
}

function passingChecks() {
  return {
    checkRuns: [
      {
        completed_at: "2026-05-10T00:00:00Z",
        conclusion: "success",
        id: 1,
        name: "Test, build, and lint",
        status: "completed",
      },
    ],
    status: {
      state: "success",
      statuses: [],
    },
  };
}

function baseFixture(overrides = {}) {
  return {
    changedFiles: [
      {
        additions: 24,
        changes: 28,
        deletions: 4,
        filename: "scripts/maintenance-guard.js",
        patch: "@@\n+export const helper = true;",
        status: "added",
      },
    ],
    checks: passingChecks(),
    comments: [],
    diff: "@@\n+export const helper = true;",
    linkedIssue: "MAR-419",
    pr: {
      base_branch: "main",
      body: completePrBody(),
      head_branch: "codex/mar-419-maintenance-guard",
      head_sha: "abc123",
      number: 419,
      state: "open",
      title: "Add Maintenance Guard report helper",
      url: "https://github.com/urkrass/Tanchiki/pull/419",
    },
    repo: defaultRepo,
    reviews: [],
    ...overrides,
  };
}

test("Maintenance Guard returns PASS for a clean in-scope fixture", async () => {
  const result = await runMaintenanceGuard({ fixture: baseFixture() });

  assert.equal(result.report.outcome, "PASS");
  assert.equal(result.report.blocks_safe_work, false);
  assert.deepEqual(result.report.cleanup_followups, []);
  assert.ok(guardOutcomes.includes(result.report.outcome));
});

test("minor bounded maintenance debt warns without blocking safe work", async () => {
  const result = await runMaintenanceGuard({
    fixture: baseFixture({
      changedFiles: [
        {
          additions: 3,
          changes: 3,
          deletions: 0,
          filename: "docs/maintenance-guard.md",
          patch: "@@\n+TODO: trim wording after operator feedback.",
          status: "added",
        },
      ],
    }),
  });

  assert.equal(result.report.outcome, "WARN");
  assert.equal(result.report.blocks_safe_work, false);
  assert.equal(result.report.cleanup_followups.length, 0);
});

test("meaningful cleanup debt recommends a follow-up without blocking", async () => {
  const result = await runMaintenanceGuard({
    fixture: baseFixture({
      changedFiles: [
        {
          additions: 6,
          changes: 6,
          deletions: 0,
          filename: "docs/maintenance-guard.md",
          patch: [
            "@@",
            "+TODO: extract repeated report wording into one table.",
            "+TODO: consolidate fixture examples after the first release.",
          ].join("\n"),
          status: "modified",
        },
      ],
    }),
  });

  assert.equal(result.report.outcome, "FOLLOW_UP_RECOMMENDED");
  assert.equal(result.report.blocks_safe_work, false);
  assert.equal(result.report.cleanup_followups.length, 1);
  assert.equal(result.report.cleanup_followups[0].blocking_policy.includes("recommended-only"), true);
});

test("hard safety findings block protected files and workflow changes", async () => {
  const result = await runMaintenanceGuard({
    fixture: baseFixture({
      changedFiles: [
        {
          filename: ".github/workflows/ci.yml",
          patch: "@@\n+name: changed",
          status: "modified",
        },
        {
          filename: "src/game/movement.js",
          patch: "@@\n+export const changed = true;",
          status: "modified",
        },
      ],
    }),
  });

  assert.equal(result.report.outcome, "BLOCKED");
  assert.equal(result.report.blocks_safe_work, true);
  assert.ok(result.report.findings.some((finding) => finding.id === "workflow-change"));
  assert.ok(result.report.findings.some((finding) => finding.id === "protected-movement-file"));
});

test("missing or failing checks never pass", async () => {
  const missing = await runMaintenanceGuard({
    fixture: baseFixture({
      checks: {
        checkRuns: [],
        status: { statuses: [] },
      },
    }),
  });
  const failing = await runMaintenanceGuard({
    fixture: baseFixture({
      checks: {
        checkRuns: [
          {
            conclusion: "failure",
            name: "Test, build, and lint",
            status: "completed",
          },
        ],
        status: { statuses: [] },
      },
    }),
  });

  assert.equal(missing.report.outcome, "BLOCKED");
  assert.equal(failing.report.outcome, "BLOCKED");
  assert.ok(failing.report.findings.some((finding) => finding.id === "required-checks-not-passing"));
});

test("metadata failures and wrong active project fail closed", async () => {
  const missingMetadata = await runMaintenanceGuard({
    fixture: baseFixture({
      pr: {
        ...baseFixture().pr,
        body: "## Summary\n\nMissing canonical metadata.",
      },
    }),
  });
  const wrongProject = await runMaintenanceGuard({
    fixture: baseFixture({
      pr: {
        ...baseFixture().pr,
        body: completePrBody({ activeProject: "Wrong Project" }),
      },
    }),
  });

  assert.equal(missingMetadata.report.outcome, "BLOCKED");
  assert.equal(wrongProject.report.outcome, "BLOCKED");
  assert.ok(wrongProject.report.findings.some((finding) => finding.id === "active-project-mismatch"));
});

test("broad ambiguous diffs require human review instead of false blocking", async () => {
  const files = Array.from({ length: 9 }, (_, index) => ({
    additions: 20,
    changes: 20,
    deletions: 0,
    filename: `docs/report-${index}.md`,
    patch: "@@\n+Documented maintenance guard behavior.",
    status: "added",
  }));

  const result = await runMaintenanceGuard({
    fixture: baseFixture({
      changedFiles: files,
      pr: {
        ...baseFixture().pr,
        body: completePrBody({ broadScanReason: "No broad scan was used." }),
      },
    }),
  });

  assert.equal(result.report.outcome, "HUMAN_REVIEW_REQUIRED");
  assert.equal(result.report.blocks_safe_work, false);
  assert.ok(result.report.findings.some((finding) => finding.id === "broad-diff-without-rationale"));
});

test("redaction covers env values, auth headers, streams, comments, bodies, and errors", async () => {
  const env = {
    GH_TOKEN: fakeToken,
    NODE_AUTH_TOKEN: fakeToken,
  };
  const result = await runMaintenanceGuard({
    env,
    fixture: baseFixture({
      comments: [`Authorization: Bearer ${fakeToken}`],
      error: new Error(`API body contained ${fakeToken}`),
      pr: {
        ...baseFixture().pr,
        body: `${completePrBody()}\n\nstdout: ${fakeToken}`,
      },
      stderr: `NODE_AUTH_TOKEN=${fakeToken}`,
      stdout: `Bearer ${fakeToken}`,
    }),
  });
  const serialized = JSON.stringify(result.report);
  const markdown = formatMaintenanceReport(result.report);
  const direct = redactMaintenanceText(`token ${fakeToken}\nhttps://user:${fakeToken}@github.com`, { env });
  const error = sanitizeMaintenanceError(new Error(`failed with ${fakeToken}`), { env });

  assert.equal(serialized.includes(fakeToken), false);
  assert.equal(markdown.includes(fakeToken), false);
  assert.equal(direct.includes(fakeToken), false);
  assert.equal(error.includes(fakeToken), false);
});

test("fixture mode is deterministic and does not call GitHub clients", async () => {
  let calls = 0;
  const result = await runMaintenanceGuard({
    client: {
      getPullRequest() {
        calls += 1;
      },
    },
    env: { GH_TOKEN: fakeToken },
    fixture: baseFixture(),
  });

  assert.equal(calls, 0);
  assert.equal(result.report.mode, "fixture");
});

test("live mode stops on missing GitHub auth before client calls", async () => {
  let calls = 0;
  await assert.rejects(
    runMaintenanceGuard({
      client: {
        getPullRequest() {
          calls += 1;
        },
      },
      env: {},
      options: {
        pr: 419,
        repo: defaultRepo,
      },
    }),
    { reason: "missing-or-invalid-github-auth" },
  );
  assert.equal(calls, 0);
});

test("live client uses read-only GitHub endpoints", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({
      accept: options.headers.Accept,
      method: options.method,
      url,
    });
    const path = new URL(url).pathname.replace("/repos/urkrass/Tanchiki", "");
    if (path === "/pulls/419" && options.headers.Accept.includes("diff")) {
      return textResponse("@@\n+export const helper = true;");
    }
    if (path === "/pulls/419") {
      return jsonResponse({
        base: { ref: "main" },
        body: completePrBody(),
        draft: false,
        head: { ref: "codex/mar-419-maintenance-guard", sha: "abc123" },
        html_url: "https://github.com/urkrass/Tanchiki/pull/419",
        number: 419,
        state: "open",
        title: "Add Maintenance Guard report helper",
      });
    }
    if (path === "/issues/419") {
      return jsonResponse({ labels: [] });
    }
    if (path === "/pulls/419/files") {
      return jsonResponse([
        {
          additions: 1,
          changes: 1,
          deletions: 0,
          filename: "scripts/maintenance-guard.js",
          patch: "@@\n+export const helper = true;",
          status: "added",
        },
      ]);
    }
    if (path === "/commits/abc123/check-runs") {
      return jsonResponse({
        check_runs: [
          {
            conclusion: "success",
            name: "Test, build, and lint",
            status: "completed",
          },
        ],
      });
    }
    if (path === "/commits/abc123/status") {
      return jsonResponse({ state: "success", statuses: [] });
    }
    if (path === "/issues/419/comments" || path === "/pulls/419/reviews") {
      return jsonResponse([]);
    }
    throw new Error(`unexpected path ${path}`);
  };

  const result = await runMaintenanceGuard({
    env: { GH_TOKEN: fakeToken },
    fetchImpl,
    options: {
      pr: 419,
      repo: defaultRepo,
    },
  });

  assert.equal(result.report.outcome, "PASS");
  assert.ok(calls.length >= 7);
  assert.ok(calls.every((call) => call.method === "GET"));
  assert.equal(calls.some((call) => call.url.includes("/issues/419/comments")), true);
  assert.equal(calls.some((call) => call.url.includes("/pulls/419/reviews")), true);
});

test("wrong repo inputs are refused", async () => {
  await assert.rejects(
    runMaintenanceGuard({
      fixture: {
        ...baseFixture(),
        repo: "example/Other",
      },
    }),
    { reason: "wrong-repo" },
  );
  assert.throws(
    () => createGitHubMaintenanceClient({ repo: "example/Other", token: fakeToken }),
    { reason: "wrong-repo" },
  );
});

test("unsafe evidence is not converted into cleanup recommendations", async () => {
  const result = await runMaintenanceGuard({
    fixture: baseFixture({
      changedFiles: [
        {
          additions: 2,
          changes: 2,
          deletions: 0,
          filename: "docs/maintenance-guard.md",
          patch: "@@\n+TODO: remove stop labels and gh pr merge after checks.",
          status: "modified",
        },
      ],
    }),
  });
  const followups = JSON.stringify(result.report.cleanup_followups);
  const evidences = result.report.findings.map((finding) => finding.evidence).join("\n");

  assert.equal(result.report.outcome, "HUMAN_REVIEW_REQUIRED");
  assert.equal(followups.includes("gh pr merge"), false);
  assert.equal(evidences.includes("gh pr merge"), false);
});

function jsonResponse(payload, { status = 200 } = {}) {
  return {
    headers: { get: () => null },
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function textResponse(payload, { status = 200 } = {}) {
  return {
    headers: { get: () => null },
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(payload),
    text: async () => payload,
  };
}
