import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  collectPrEvidence,
  createGitHubEvidenceClient,
  defaultMaxDiffChars,
  summarizeChecks,
  trimDiff,
  validateMaxDiffChars,
} from "../scripts/reviewer-evidence.js";
import { main, parseArgs } from "../scripts/reviewer-agent.js";

const root = process.cwd();

function makePrBody(overrides = {}) {
  return [
    "## Linked Linear Issue",
    `Closes: ${overrides.issue || "MAR-312"}`,
    "Active Linear project: Tanchiki — Playable Tank RPG Prototype",
    "",
    "## Role / Type / Risk / Validation",
    "- Role: role:coder",
    "- Type: type:harness",
    "- Risk: risk:medium",
    "- Validation profile: validation:harness",
    "",
    "## Summary",
    "- Adds evidence collection.",
    "",
    "## Files Changed",
    "- scripts/reviewer-agent.js",
    "",
    "## Tests Run",
    "- npm test",
    "",
    "## Manual QA",
    "- Dry-run evidence output inspected.",
    "",
    "## Broad Scan Reason",
    "- No broad scan was used.",
    "",
    "## Conflict Risk",
    "- Central harness scripts only.",
    "",
    "## Acceptance Labels",
    "- Merge label: none",
    "- Reviewer label: none",
    "- Human gate: approved in MAR-311",
    "",
    "## PR Readiness",
    "- Draft allowed reason, if Draft: n/a",
    "- Paired-review candidate: yes",
    "- Auto-merge candidate: no",
    "",
    "## Visible UI Expectation",
    "- No visible UI changes.",
    "",
    "## Known Limitations",
    "- OpenAI invocation is out of scope for MAR-312.",
  ].join("\n");
}

function makeFakeClient(overrides = {}) {
  return {
    getPullRequest: async () => ({
      base: { ref: "main" },
      body: makePrBody(overrides),
      draft: false,
      head: { ref: "mar-312-reviewer-agent-evidence-collector", sha: "abc123" },
      html_url: "https://github.com/urkrass/Tanchiki/pull/119",
      merged: false,
      merged_at: null,
      number: 119,
      state: "open",
      title: "MAR-312 evidence collector",
      ...overrides.pullRequest,
    }),
    getIssue: async () => ({
      labels: [{ name: "harness" }, { name: "risk:medium" }],
      ...overrides.issueResponse,
    }),
    listPullRequestFiles: async () => overrides.files || [
      {
        additions: 120,
        changes: 120,
        deletions: 0,
        filename: "scripts/reviewer-evidence.js",
        patch: "@@ fake patch",
        status: "added",
      },
      {
        additions: 80,
        changes: 80,
        deletions: 0,
        filename: "scripts\\reviewer-agent.js",
        patch: "@@ fake patch",
        status: "added",
      },
    ],
    getPullRequestDiff: async () => overrides.diff || "diff --git a/file b/file\n".repeat(20),
    getChecks: async () => overrides.checks || {
      checkRuns: [{ conclusion: "success", name: "CI", status: "completed" }],
      status: { state: "success", statuses: [] },
    },
  };
}

test("reviewer-agent parser supports evidence dry-run command shape", () => {
  assert.deepEqual(
    parseArgs([
      "--pr",
      "119",
      "--issue",
      "MAR-312",
      "--dry-run",
      "--max-diff-chars",
      "2000",
      "--model",
      "gpt-5.5",
    ]),
    {
      dryRun: true,
      issue: "MAR-312",
      maxDiffChars: 2000,
      model: "gpt-5.5",
      pr: 119,
      repo: "urkrass/Tanchiki",
    },
  );

  assert.equal(
    parseArgs(["--pr=119", "--issue=MAR-312", "--dry-run"]).maxDiffChars,
    defaultMaxDiffChars,
  );
  assert.throws(() => parseArgs([]), /--pr is required/);
  assert.throws(() => parseArgs(["--pr", "0", "--issue", "MAR-312", "--dry-run"]), /positive integer/);
  assert.throws(() => parseArgs(["--pr", "1", "--issue", "ABC-1", "--dry-run"]), /MAR-<number>/);
  assert.throws(() => parseArgs(["--pr", "1", "--issue", "MAR-1"]), /pass --dry-run/);
  assert.throws(() => parseArgs(["--pr", "1", "--issue", "MAR-1", "--dry-run", "--body", "x"]), /Unknown argument/);
  assert.throws(
    () => parseArgs(["--pr", "1", "--issue", "MAR-1", "--dry-run", "--repo", "other/repo"]),
    /--repo must be urkrass\/Tanchiki/,
  );
});

test("reviewer evidence validates and trims max diff size", () => {
  assert.equal(validateMaxDiffChars("60000"), 60000);
  assert.throws(() => validateMaxDiffChars("1999"), /between 2000 and 200000/);
  assert.throws(() => validateMaxDiffChars("200001"), /between 2000 and 200000/);
  assert.throws(() => validateMaxDiffChars("abc"), /positive integer/);

  const short = trimDiff("abc", 10);
  assert.deepEqual(short, {
    text: "abc",
    truncated: false,
    chars_original: 3,
    chars_included: 3,
  });

  const long = trimDiff("abcdef", 3);
  assert.deepEqual(long, {
    text: "abc",
    truncated: true,
    chars_original: 6,
    chars_included: 3,
  });
});

test("reviewer evidence packet contains compact PR state metadata and policy context", async () => {
  const evidence = await collectPrEvidence({
    client: makeFakeClient({
      diff: "0123456789",
    }),
    issue: "MAR-312",
    maxDiffChars: 5,
    pr: 119,
  });

  assert.equal(evidence.schema_version, "tanchiki.reviewer_agent.evidence.v1");
  assert.equal(evidence.repo, "urkrass/Tanchiki");
  assert.equal(evidence.active_linear_project, "Tanchiki — Playable Tank RPG Prototype");
  assert.equal(evidence.review_cadence, "paired-review");
  assert.equal(evidence.linked_issue.id, "MAR-312");
  assert.equal(evidence.linked_issue.summary_available, false);
  assert.equal(evidence.pr.number, 119);
  assert.equal(evidence.pr.state.open, true);
  assert.equal(evidence.pr.state.draft, false);
  assert.equal(evidence.changed_files.count, 2);
  assert.equal(evidence.changed_files.files[1].filename, "scripts/reviewer-agent.js");
  assert.equal(evidence.diff.truncated, true);
  assert.equal(evidence.diff.chars_original, 10);
  assert.equal(evidence.diff.chars_included, 5);
  assert.equal(evidence.checks.state, "passing");
  assert.deepEqual(evidence.labels.names, ["harness", "risk:medium"]);
  assert.equal(evidence.pr_metadata.required_headings_ok, true);
  assert.equal(evidence.pr_metadata.mentions_linked_issue, true);
  assert.equal(evidence.role_type_risk_validation.role, "role:coder");
  assert.equal(evidence.role_type_risk_validation.type, "type:harness");
  assert.match(evidence.pr_metadata.validation_evidence.tests_run, /npm test/);
  assert.equal(evidence.broad_scan.included, false);
  assert.equal(evidence.safety.openai_call_made, false);
  assert.equal(evidence.safety.github_review_submitted, false);
  assert.equal(evidence.safety.reviewer_app_token_requested, false);
  assert.ok(evidence.policy_snippets.pr_acceptance.length > 0);
  assert.ok(evidence.protected_surfaces.protected_files.includes("src/game/movement.js"));
});

test("reviewer evidence records forbidden file findings without refusing collection", async () => {
  const evidence = await collectPrEvidence({
    client: makeFakeClient({
      files: [
        { filename: ".env", additions: 1, deletions: 0, changes: 1, status: "added" },
        { filename: "src/game/movement.js", additions: 1, deletions: 0, changes: 1, status: "modified" },
      ],
    }),
    issue: "MAR-312",
    maxDiffChars: 2000,
    pr: 119,
  });

  assert.deepEqual(
    evidence.protected_surfaces.forbidden_file_findings.map((finding) => finding.reason),
    ["local env file", "protected movement core"],
  );
});

test("reviewer evidence summarizes failing pending unavailable and absent checks", () => {
  assert.equal(
    summarizeChecks({
      checkRuns: [{ conclusion: "failure", name: "CI", status: "completed" }],
      status: { statuses: [] },
    }).state,
    "failing",
  );
  assert.equal(
    summarizeChecks({
      checkRuns: [{ conclusion: null, name: "CI", status: "in_progress" }],
      status: { statuses: [] },
    }).state,
    "pending",
  );
  assert.equal(summarizeChecks({ checkRuns: [], status: { statuses: [] } }).state, "unavailable");
  assert.equal(summarizeChecks({ unavailableReason: "403 forbidden" }).state, "unavailable");
});

test("GitHub evidence client uses read-only PR evidence endpoints", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    requests.push({
      accept: init.headers.Accept,
      method: init.method,
      path: parsedUrl.pathname + parsedUrl.search,
    });

    if (parsedUrl.pathname.endsWith("/pulls/7") && init.headers.Accept.includes("diff")) {
      return textResponse("diff --git a/file b/file\n");
    }
    if (parsedUrl.pathname.endsWith("/pulls/7")) {
      return jsonResponse({ head: { sha: "abc123" }, number: 7 });
    }
    if (parsedUrl.pathname.endsWith("/issues/7")) {
      return jsonResponse({ labels: [] });
    }
    if (parsedUrl.pathname.endsWith("/pulls/7/files")) {
      return jsonResponse([{ filename: "scripts/reviewer-evidence.js" }]);
    }
    if (parsedUrl.pathname.endsWith("/commits/abc123/check-runs")) {
      return jsonResponse({ check_runs: [] });
    }
    if (parsedUrl.pathname.endsWith("/commits/abc123/status")) {
      return jsonResponse({ statuses: [] });
    }

    return {
      ok: false,
      status: 404,
      text: async () => "unexpected path",
    };
  };

  const client = createGitHubEvidenceClient({
    fetchImpl,
    repo: "urkrass/Tanchiki",
    token: "fake-token",
  });

  await client.getPullRequest(7);
  await client.getIssue(7);
  await client.listPullRequestFiles(7);
  await client.getPullRequestDiff(7);
  await client.getChecks("abc123");

  assert.deepEqual(
    requests.map((request) => request.method),
    ["GET", "GET", "GET", "GET", "GET", "GET"],
  );
  assert.deepEqual(
    requests.map((request) => request.path),
    [
      "/repos/urkrass/Tanchiki/pulls/7",
      "/repos/urkrass/Tanchiki/issues/7",
      "/repos/urkrass/Tanchiki/pulls/7/files?per_page=100&page=1",
      "/repos/urkrass/Tanchiki/pulls/7",
      "/repos/urkrass/Tanchiki/commits/abc123/check-runs?per_page=100",
      "/repos/urkrass/Tanchiki/commits/abc123/status",
    ],
  );

  for (const request of requests) {
    assert.doesNotMatch(request.path, /\/reviews|\/merge|\/labels|dispatches|actions|hooks|branches|git\/refs/i);
  }
});

test("reviewer-agent dry-run output is sanitized and does not call OpenAI or submit reviews", async () => {
  const stdout = [];
  const stderr = [];
  const responseByPath = new Map([
    ["/repos/urkrass/Tanchiki/pulls/119", { json: { ...await makeFakeClient().getPullRequest(), head: { sha: "abc123" } } }],
    ["/repos/urkrass/Tanchiki/issues/119", { json: { labels: [] } }],
    ["/repos/urkrass/Tanchiki/pulls/119/files?per_page=100&page=1", { json: [{ filename: "scripts/reviewer-agent.js" }] }],
    ["/repos/urkrass/Tanchiki/commits/abc123/check-runs?per_page=100", { json: { check_runs: [] } }],
    ["/repos/urkrass/Tanchiki/commits/abc123/status", { json: { statuses: [] } }],
  ]);

  const fetchImpl = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + parsedUrl.search;
    assert.equal(init.method, "GET");
    assert.doesNotMatch(path, /openai|reviews|merge|labels/i);

    if (path === "/repos/urkrass/Tanchiki/pulls/119" && init.headers.Accept.includes("diff")) {
      return textResponse("diff --git a/scripts/reviewer-agent.js b/scripts/reviewer-agent.js\n");
    }

    const entry = responseByPath.get(path);
    if (entry) {
      return jsonResponse(entry.json);
    }

    return {
      ok: false,
      status: 404,
      text: async () => `unexpected path ${path}`,
    };
  };

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-312", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  const output = stdout.join("\n");
  assert.doesNotMatch(output, /secret-gh-token|secret-openai-key/);
  const parsed = JSON.parse(output);
  assert.equal(parsed.mode, "evidence-dry-run");
  assert.equal(parsed.openai_call_made, false);
  assert.equal(parsed.github_review_submitted, false);
});

test("reviewer-agent direct CLI refuses non-dry-run before network work", () => {
  const result = spawnSync(process.execPath, [
    join(root, "scripts", "reviewer-agent.js"),
    "--pr",
    "119",
    "--issue",
    "MAR-312",
  ], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence-only collection/);
  assert.match(result.stderr, /No OpenAI API call was made/);
  assert.match(result.stderr, /No GitHub review was submitted/);
});

test("reviewer-agent package and static surface preserve evidence-only boundaries", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const agent = readRepoFile("scripts", "reviewer-agent.js");
  const evidence = readRepoFile("scripts", "reviewer-evidence.js");
  const combined = `${agent}\n${evidence}`;

  assert.equal(packageJson.scripts["reviewer:agent"], "node scripts/reviewer-agent.js");
  assert.match(packageJson.scripts.build, /node --check scripts\/reviewer-agent\.js/);
  assert.match(packageJson.scripts.build, /node --check scripts\/reviewer-evidence\.js/);
  assert.match(packageJson.scripts.build, /node --check test\/reviewerEvidence\.test\.js/);
  assert.match(packageJson.scripts.lint, /node --check scripts\/reviewer-agent\.js/);
  assert.match(packageJson.scripts.lint, /node --check scripts\/reviewer-evidence\.js/);
  assert.match(packageJson.scripts.lint, /node --check test\/reviewerEvidence\.test\.js/);

  for (const forbiddenWrite of [
    "writeFileSync",
    "appendFileSync",
    "createWriteStream",
    "writeFile(",
    "appendFile(",
  ]) {
    assert.equal(combined.includes(forbiddenWrite), false);
  }

  for (const forbiddenPattern of [
    /OPENAI_API_KEY/,
    /createReviewerAppInstallationToken/,
    /submitReview/,
    /\/reviews/i,
    /\/merge/i,
    /\/labels/i,
    /process\.env\.GH_TOKEN\s*=/,
  ]) {
    assert.equal(
      forbiddenPattern.test(combined),
      false,
      `evidence collector must not contain forbidden action: ${forbiddenPattern}`,
    );
  }
});

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(body) {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  };
}
