import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  collectPrEvidence,
  createGitHubEvidenceClient,
  defaultMaxDiffChars,
  gitHubEvidenceAuthGuidance,
  summarizeChecks,
  trimDiff,
  validateMaxDiffChars,
} from "../scripts/reviewer-evidence.js";
import {
  createOpenAiRequest,
  defaultOpenAiModel,
  evaluateLocalPreflight,
  evaluateReviewerDecision,
  findForbiddenModelOutputReasons,
  mapDecisionToReviewPrDecision,
  main,
  normalizeReviewBodyForDecision,
  openAiResponsesUrl,
  parseArgs,
  reviewerDecisionSchema,
  validateReviewerDecision,
} from "../scripts/reviewer-agent.js";
import { getReviewBodyRefusalReason } from "../scripts/reviewer-review-pr.js";

const root = process.cwd();

function countExactLine(text, line) {
  return String(text)
    .split("\n")
    .filter((value) => value.trim() === line).length;
}

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
  assert.deepEqual(parseArgs(["--pr", "1", "--issue", "MAR-321", "--dry-run"]), {
    dryRun: true,
    issue: "MAR-321",
    maxDiffChars: defaultMaxDiffChars,
    model: null,
    pr: 1,
    repo: "urkrass/Tanchiki",
  });
  assert.throws(() => parseArgs([]), /--pr is required/);
  assert.throws(() => parseArgs(["--pr", "0", "--issue", "MAR-312", "--dry-run"]), /positive integer/);
  assert.throws(() => parseArgs(["--pr", "1", "--issue", "ABC-1", "--dry-run"]), /MAR-<number>/);
  assert.throws(() => parseArgs(["--pr", "1", "--issue", "MAR-1", "--dry-run", "--body", "x"]), /Unknown argument/);
  assert.throws(
    () => parseArgs(["--pr", "1", "--issue", "MAR-1", "--dry-run", "--repo", "other/repo"]),
    /--repo must be urkrass\/Tanchiki/,
  );
  assert.equal(parseArgs(["--pr", "1", "--issue", "MAR-1"]).dryRun, false);
});

test("reviewer-agent maps generated decisions to GitHub review decisions", () => {
  assert.equal(mapDecisionToReviewPrDecision("APPROVED_FOR_MERGE"), "approve");
  assert.equal(mapDecisionToReviewPrDecision("CHANGES_REQUESTED"), "request-changes");
  assert.equal(mapDecisionToReviewPrDecision("BLOCKED"), "request-changes");
  assert.equal(mapDecisionToReviewPrDecision("HUMAN_REVIEW_REQUIRED"), "comment");
  assert.equal(
    mapDecisionToReviewPrDecision(makeReviewerDecision({
      decision: "BLOCKED",
      summary: "Blocked by offline reviewer process evidence.",
      review_body_markdown: "BLOCKED\n\nOffline process evidence needs a human.",
    })),
    "comment",
  );
  assert.equal(
    mapDecisionToReviewPrDecision(makeReviewerDecision({
      decision: "BLOCKED",
      findings: [{ severity: "blocking", file: "scripts/reviewer-agent.js", message: "Fix gate." }],
      review_body_markdown: "BLOCKED\n\nBlocking finding:\n- Fix gate.",
    })),
    "request-changes",
  );
});

test("reviewer-agent fixture evidence passes local approval gates and request sanitization", () => {
  const evidence = readFixtureJson("reviewer-agent-pr-evidence.json");
  const preflight = evaluateLocalPreflight(evidence);

  assert.deepEqual(preflight.local_checks, {
    pr_state_ok: true,
    metadata_ok: true,
    checks_ok: true,
    scope_ok: true,
    forbidden_files_ok: true,
    review_cadence_ok: true,
  });
  assert.deepEqual(preflight.refusal_reasons, []);

  const decision = makeReviewerDecision({
    decision: "APPROVED_FOR_MERGE",
    confidence: "high",
    summary: "Fixture evidence is safe for approval.",
    review_body_markdown: "APPROVED FOR MERGE\n\nIndependence: fixture evidence regression.",
  });
  const evaluation = evaluateReviewerDecision({ decision, evidence });

  assert.deepEqual(evaluation.refusal_reasons, []);

  const request = createOpenAiRequest({ evidence, model: "gpt-5.5" });
  const requestText = JSON.stringify(request);
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.deepEqual(request.text.format.schema, reviewerDecisionSchema);
  assert.match(requestText, /MAR-318/);
  assert.match(requestText, /diff --git/);
  assert.doesNotMatch(requestText, /OPENAI_API_KEY|GH_TOKEN|GITHUB_REVIEWER|secret-/);
});

test("reviewer-agent normalizes approval body before review-pr validation", async () => {
  const stdout = [];
  const stderr = [];
  const openAiRequests = [];
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "APPROVED_FOR_MERGE",
      review_body_markdown: "Approved for merge.",
    }),
    onOpenAiRequest: (request) => openAiRequests.push(request),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
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
  assert.equal(openAiRequests.length, 1);
  const parsed = JSON.parse(stdout.join("\n"));
  assert.equal(parsed.mapped_github_event, "APPROVE");
  assert.match(parsed.decision.review_body_markdown, /^APPROVED FOR MERGE\n\nIndependence basis:/);
  assert.match(
    parsed.decision.review_body_markdown,
    /Reviewer source: OpenAI API-backed Reviewer Agent via reviewer:agent\./,
  );
  assert.match(
    parsed.decision.review_body_markdown,
    /Reviewer authority was limited to evidence analysis and GitHub review submission\./,
  );
  assert.match(
    parsed.decision.review_body_markdown,
    /Repository contents, GitHub labels, merge state, and Linear issue state were unchanged by this reviewer path\./,
  );
  assert.match(parsed.decision.review_body_markdown, /Human remains responsible for merge\./);
  assert.match(parsed.decision.review_body_markdown, /\n\nApproved for merge\.$/);
});

test("reviewer-agent approval normalization preserves forbidden output refusal", async () => {
  const stdout = [];
  const stderr = [];
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "APPROVED_FOR_MERGE",
      review_body_markdown: [
        "Approved for merge.",
        "",
        "Independence: separate Reviewer App session.",
        "Mark the Linear issue Done after review.",
      ].join("\n"),
    }),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join("\n"), /model output requested Linear Done/);
  assert.match(stderr.join("\n"), /No GitHub review was submitted/);
});

test("reviewer-agent approval normalization is approval-only", () => {
  const approval = makeReviewerDecision({
    decision: "APPROVED_FOR_MERGE",
    review_body_markdown: "Approved for merge.\n\nIndependence: distinct run.",
  });
  const normalizedApproval = normalizeReviewBodyForDecision(approval);
  assert.match(normalizedApproval.review_body_markdown, /^APPROVED FOR MERGE\n\nIndependence basis:/);
  assert.match(
    normalizedApproval.review_body_markdown,
    /Reviewer source: OpenAI API-backed Reviewer Agent via reviewer:agent\./,
  );
  assert.match(
    normalizedApproval.review_body_markdown,
    /Reviewer authority was limited to evidence analysis and GitHub review submission\./,
  );
  assert.match(
    normalizedApproval.review_body_markdown,
    /Repository contents, GitHub labels, merge state, and Linear issue state were unchanged by this reviewer path\./,
  );
  assert.match(normalizedApproval.review_body_markdown, /Human remains responsible for merge\./);
  assert.match(normalizedApproval.review_body_markdown, /Approved for merge\./);

  const changes = makeReviewerDecision({
    decision: "CHANGES_REQUESTED",
    review_body_markdown: "CHANGES REQUESTED\n\nBlocking finding:\n- Fix this.",
  });
  assert.equal(normalizeReviewBodyForDecision(changes), changes);
});

test("reviewer-agent approval normalization does not duplicate complete approval basis", () => {
  const completeBody = [
    "APPROVED FOR MERGE",
    "",
    "Independence basis:",
    "- Reviewer source: OpenAI API-backed Reviewer Agent via reviewer:agent.",
    "- Reviewer authority was limited to evidence analysis and GitHub review submission.",
    "- Repository contents, GitHub labels, merge state, and Linear issue state were unchanged by this reviewer path.",
    "- Human remains responsible for merge.",
    "",
    "No blocking findings.",
  ].join("\n");
  const approval = makeReviewerDecision({
    decision: "APPROVED_FOR_MERGE",
    review_body_markdown: completeBody,
  });

  assert.equal(normalizeReviewBodyForDecision(approval), approval);
});

test("reviewer-agent approval normalization collapses duplicate approval and independence sections", () => {
  const approval = makeReviewerDecision({
    decision: "APPROVED_FOR_MERGE",
    review_body_markdown: [
      "APPROVED FOR MERGE",
      "",
      "Independence basis:",
      "- Older generated basis line.",
      "",
      "APPROVED FOR MERGE",
      "",
      "Independence: separate Reviewer App session.",
      "",
      "Approved for merge.",
    ].join("\n"),
  });

  const normalized = normalizeReviewBodyForDecision(approval);
  const body = normalized.review_body_markdown;

  assert.equal(countExactLine(body, "APPROVED FOR MERGE"), 1);
  assert.equal(countExactLine(body, "Independence basis:"), 1);
  assert.match(body, /^APPROVED FOR MERGE\n\nIndependence basis:/);
  assert.match(body, /Reviewer source: OpenAI API-backed Reviewer Agent via reviewer:agent\./);
  assert.match(body, /\n\nApproved for merge\.$/);
  assert.doesNotMatch(body, /Older generated basis line|Independence: separate Reviewer App session/);
});

test("reviewer-agent normalized approval body avoids forbidden output false positives", () => {
  const approval = normalizeReviewBodyForDecision(makeReviewerDecision({
    decision: "APPROVED_FOR_MERGE",
    review_body_markdown: "Approved for merge.\n\nIndependence: separate Reviewer App session.",
  }));

  assert.deepEqual(findForbiddenModelOutputReasons(approval), []);
  assert.equal(
    getReviewBodyRefusalReason("approve", approval.review_body_markdown),
    null,
  );
  assert.doesNotMatch(approval.review_body_markdown, /did not edit files|apply labels|mark Linear Done/i);
});

test("reviewer-agent forbidden output scanner allows safety boundary statements", () => {
  const decision = makeReviewerDecision({
    summary: [
      "No file edits were performed.",
      "Repository contents were unchanged.",
      "GitHub labels were unchanged.",
      "Linear issue state was unchanged.",
    ].join(" "),
    review_body_markdown: [
      "HUMAN REVIEW REQUIRED",
      "",
      "Reviewer authority was limited to evidence analysis and GitHub review submission.",
      "Human remains responsible for merge.",
      "The reviewer did not edit files, did not apply labels, and did not mark Linear Done.",
      "Stop labels were not removed, Dispatcher was not run, and Codex was not run.",
    ].join("\n"),
  });

  assert.deepEqual(findForbiddenModelOutputReasons(decision), []);
});

for (const scenario of [
  {
    text: "Run gh pr merge 119 after this review.",
    expected: "model output requested a gh pr merge command",
  },
  {
    text: "Run gh pr edit 119 --add-label merge:auto-eligible.",
    expected: "model output requested a gh pr edit command",
  },
  {
    text: "Run gh issue edit 119 --add-label reviewed.",
    expected: "model output requested a gh issue edit command",
  },
  {
    text: "git push origin reviewer-agent-fix.",
    expected: "model output requested git push",
  },
  {
    text: "git commit -am reviewer-fix.",
    expected: "model output requested git commit",
  },
  {
    text: "Apply labels after approval.",
    expected: "model output requested label application",
  },
  {
    text: "Remove stop labels.",
    expected: "model output requested label removal",
  },
  {
    text: "Mark the Linear issue Done.",
    expected: "model output requested Linear Done",
  },
  {
    text: "Edit files to fix the blocker.",
    expected: "model output requested file edits",
  },
  {
    text: "Change repository settings.",
    expected: "model output requested repository settings changes",
  },
  {
    text: "Modify GitHub Actions workflows.",
    expected: "model output requested workflow changes",
  },
  {
    text: "Update branch protection.",
    expected: "model output requested branch protection changes",
  },
  {
    text: "Run Dispatcher.",
    expected: "model output requested Dispatcher",
  },
  {
    text: "Run the Conductor.",
    expected: "model output requested Conductor",
  },
  {
    text: "Run Codex.",
    expected: "model output requested Codex",
  },
]) {
  test(`reviewer-agent forbidden output scanner rejects action request: ${scenario.text}`, () => {
    const decision = makeReviewerDecision({
      review_body_markdown: scenario.text,
    });

    assert.ok(findForbiddenModelOutputReasons(decision).includes(scenario.expected));
  });
}

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

test("reviewer evidence ignores older failed check runs when a newer same-identity run passed", () => {
  const summary = summarizeChecks({
    checkRuns: [
      {
        app: { id: 15368, slug: "github-actions" },
        completed_at: "2026-05-01T10:00:00Z",
        conclusion: "failure",
        id: 1001,
        name: "PR Metadata Check",
        started_at: "2026-05-01T09:59:00Z",
        status: "completed",
      },
      {
        app: { id: 15368, slug: "github-actions" },
        completed_at: "2026-05-01T10:05:00Z",
        conclusion: "success",
        id: 1002,
        name: "PR Metadata Check",
        started_at: "2026-05-01T10:04:00Z",
        status: "completed",
      },
    ],
    status: { statuses: [] },
  });

  assert.equal(summary.state, "passing");
  assert.equal(summary.check_run_count, 2);
  assert.equal(summary.evaluated_check_run_count, 1);
  assert.deepEqual(summary.check_runs, [
    { conclusion: "success", name: "PR Metadata Check", status: "completed" },
  ]);
  assert.deepEqual(summary.findings, []);
});

test("reviewer evidence fails when the newest same-identity check run failed", () => {
  const summary = summarizeChecks({
    checkRuns: [
      {
        app: { id: 15368, slug: "github-actions" },
        completed_at: "2026-05-01T10:00:00Z",
        conclusion: "success",
        id: 1001,
        name: "PR Metadata Check",
        started_at: "2026-05-01T09:59:00Z",
        status: "completed",
      },
      {
        app: { id: 15368, slug: "github-actions" },
        completed_at: "2026-05-01T10:05:00Z",
        conclusion: "failure",
        id: 1002,
        name: "PR Metadata Check",
        started_at: "2026-05-01T10:04:00Z",
        status: "completed",
      },
    ],
    status: { statuses: [] },
  });

  assert.equal(summary.state, "failing");
  assert.deepEqual(summary.findings, ["Check run PR Metadata Check concluded failure."]);
});

test("reviewer evidence is pending when the newest same-identity check run is pending", () => {
  const summary = summarizeChecks({
    checkRuns: [
      {
        completed_at: "2026-05-01T10:00:00Z",
        conclusion: "success",
        id: 1001,
        name: "PR Metadata Check",
        started_at: "2026-05-01T09:59:00Z",
        status: "completed",
      },
      {
        conclusion: null,
        id: 1002,
        name: "PR Metadata Check",
        started_at: "2026-05-01T10:05:00Z",
        status: "in_progress",
      },
    ],
    status: { statuses: [] },
  });

  assert.equal(summary.state, "pending");
  assert.deepEqual(summary.check_runs, [
    { conclusion: null, name: "PR Metadata Check", status: "in_progress" },
  ]);
  assert.deepEqual(summary.findings, ["Check run PR Metadata Check is in_progress."]);
});

test("reviewer evidence uses check run id when same-identity timestamps are unavailable", () => {
  const summary = summarizeChecks({
    checkRuns: [
      {
        conclusion: "failure",
        id: 1001,
        name: "PR Metadata Check",
        status: "completed",
      },
      {
        conclusion: "success",
        id: 1002,
        name: "PR Metadata Check",
        status: "completed",
      },
    ],
    status: { statuses: [] },
  });

  assert.equal(summary.state, "passing");
  assert.deepEqual(summary.check_runs, [
    { conclusion: "success", name: "PR Metadata Check", status: "completed" },
  ]);
});

test("GitHub evidence client uses read-only PR evidence endpoints", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    requests.push({
      accept: init.headers.Accept,
      authorization: init.headers.Authorization,
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
    assert.equal(request.authorization, "Bearer fake-token");
    assert.doesNotMatch(request.path, /\/reviews|\/merge|\/labels|dispatches|actions|hooks|branches|git\/refs/i);
  }
});

test("GitHub evidence client requires normal read-only auth before network access", async () => {
  assert.match(gitHubEvidenceAuthGuidance, /normal read-only GitHub auth/);

  assert.throws(
    () => createGitHubEvidenceClient({
      fetchImpl: async () => {
        throw new Error("network should not be reached");
      },
    }),
    (error) => {
      assert.match(error.message, /GitHub evidence collection requires normal read-only GitHub auth/);
      assert.match(error.message, /\$env:GH_TOKEN = gh auth token/);
      assert.match(error.message, /not the Reviewer App submission token/);
      assert.equal(error.githubEvidenceAuthError, true);
      return true;
    },
  );
});

test("reviewer-agent fails closed with clear GitHub evidence auth guidance", async () => {
  const stdout = [];
  const stderr = [];
  let openAiCalled = false;
  let reviewerTokenRequested = false;
  const fetchImpl = await makeReviewerAgentFetch({
    onOpenAiRequest: () => {
      openAiCalled = true;
    },
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    createTokenImpl: () => {
      reviewerTokenRequested = true;
      return { token: "secret-reviewer-token" };
    },
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  const errorText = stderr.join("\n");
  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.equal(openAiCalled, false);
  assert.equal(reviewerTokenRequested, false);
  assert.match(errorText, /GitHub evidence collection requires normal read-only GitHub auth/);
  assert.match(errorText, /\$env:GH_TOKEN = gh auth token/);
  assert.match(errorText, /not the Reviewer App submission token/);
  assert.match(errorText, /No OpenAI API call was made/);
  assert.match(errorText, /Reviewer App token path was not reached/);
  assert.match(errorText, /No GitHub review was submitted/);
  assert.doesNotMatch(errorText, /secret-openai-key|secret-reviewer-token/);
});

test("GitHub evidence client reports rate-limited evidence auth with operator guidance", async () => {
  const client = createGitHubEvidenceClient({
    fetchImpl: async () => ({
      headers: new Map([["x-ratelimit-remaining", "0"]]),
      ok: false,
      status: 403,
      text: async () => "API rate limit exceeded",
    }),
    token: "secret-gh-token",
  });

  await assert.rejects(
    () => client.getPullRequest(7),
    (error) => {
      assert.match(error.message, /GitHub API GET \/pulls\/7 failed with HTTP 403/);
      assert.match(error.message, /GitHub evidence collection requires normal read-only GitHub auth/);
      assert.match(error.message, /\$env:GH_TOKEN = gh auth token/);
      assert.match(error.message, /not the Reviewer App submission token/);
      assert.equal(error.githubEvidenceAuthError, true);
      return true;
    },
  );
});

test("reviewer-agent dry-run calls OpenAI with strict structured output and submits no review", async () => {
  const stdout = [];
  const stderr = [];
  const openAiRequests = [];
  let reviewerTokenRequested = false;
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "HUMAN_REVIEW_REQUIRED",
      review_body_markdown: "Human review required after generated analysis.",
    }),
    onOpenAiRequest: (request) => openAiRequests.push(request),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    createTokenImpl: () => {
      reviewerTokenRequested = true;
      return { token: "secret-reviewer-token" };
    },
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  const output = stdout.join("\n");
  assert.doesNotMatch(output, /secret-gh-token|secret-openai-key|secret-reviewer-token/);
  const parsed = JSON.parse(output);
  assert.equal(parsed.mode, "api-backed-reviewer-agent");
  assert.equal(parsed.dry_run, true);
  assert.equal(parsed.requested_model, defaultOpenAiModel);
  assert.equal(parsed.openai_call_made, true);
  assert.equal(parsed.github_review_submitted, false);
  assert.equal(parsed.reviewer_app_token_requested, false);
  assert.equal(parsed.submission_allowed, true);
  assert.equal(parsed.submission_blocked_reason, null);
  assert.equal(parsed.mapped_github_event, "COMMENT");
  assert.equal(parsed.decision.decision, "HUMAN_REVIEW_REQUIRED");
  assert.deepEqual(parsed.local_gate_refusals, []);
  assert.equal(reviewerTokenRequested, false);

  assert.equal(openAiRequests.length, 1);
  assert.equal(openAiRequests[0].url, openAiResponsesUrl);
  assert.equal(openAiRequests[0].init.method, "POST");
  assert.equal(openAiRequests[0].init.headers.Authorization, "Bearer secret-openai-key");
  assert.doesNotMatch(openAiRequests[0].init.body, /secret-openai-key|secret-gh-token/);
  const requestBody = JSON.parse(openAiRequests[0].init.body);
  assert.equal(requestBody.model, defaultOpenAiModel);
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.reasoning.effort, "medium");
  assert.equal(requestBody.text.verbosity, "low");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.name, "tanchiki_reviewer_decision");
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(requestBody.text.format.schema, reviewerDecisionSchema);
  assert.match(requestBody.input[0].content[0].text, /constrained Tanchiki Reviewer App reviewer agent/);
  assert.match(requestBody.input[1].content[0].text, /MAR-314/);
});

test("reviewer-agent live mode submits generated review through Reviewer App path", async () => {
  const stdout = [];
  const stderr = [];
  const openAiRequests = [];
  const reviewRequests = [];
  let tokenRequested = false;
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "CHANGES_REQUESTED",
      review_body_markdown: "CHANGES REQUESTED\n\nBlocking finding:\n- Keep the reviewer boundary intact.",
    }),
    onOpenAiRequest: (request) => openAiRequests.push(request),
    onReviewRequest: (request) => reviewRequests.push(request),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314"],
    env: {
      GITHUB_REVIEWER_APP_ID: "123",
      GITHUB_REVIEWER_INSTALLATION_ID: "456",
      GITHUB_REVIEWER_PRIVATE_KEY_PATH: process.execPath,
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    createTokenImpl: (context) => {
      tokenRequested = true;
      assert.equal(context.appId, "123");
      assert.equal(context.installationId, "456");
      return { token: "secret-reviewer-token", expires_at: "2026-05-01T12:00:00Z" };
    },
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.equal(openAiRequests.length, 1);
  assert.equal(tokenRequested, true);
  assert.equal(reviewRequests.length, 1);
  assert.deepEqual(reviewRequests[0].body, {
    body: "CHANGES REQUESTED\n\nBlocking finding:\n- Keep the reviewer boundary intact.",
    event: "REQUEST_CHANGES",
  });
  assert.equal(reviewRequests[0].authorization, "Bearer secret-reviewer-token");

  const output = stdout.join("\n");
  assert.doesNotMatch(output, /secret-gh-token|secret-openai-key|secret-reviewer-token/);
  const parsed = JSON.parse(output);
  assert.equal(parsed.mode, "api-backed-reviewer-agent");
  assert.equal(parsed.dry_run, false);
  assert.equal(parsed.openai_call_made, true);
  assert.equal(parsed.github_review_submitted, true);
  assert.equal(parsed.reviewer_app_token_requested, true);
  assert.equal(parsed.mapped_github_event, "REQUEST_CHANGES");
  assert.equal(parsed.submission_allowed, true);
  assert.equal(parsed.submission_blocked_reason, null);
  assert.equal(parsed.decision.decision, "CHANGES_REQUESTED");
});

test("reviewer-agent live mode fails closed when Reviewer App env is missing", async () => {
  const stdout = [];
  const stderr = [];
  const reviewRequests = [];
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "CHANGES_REQUESTED",
      review_body_markdown: "CHANGES REQUESTED\n\nBlocking finding:\n- Reviewer App env missing.",
    }),
    onReviewRequest: (request) => reviewRequests.push(request),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    createTokenImpl: () => {
      throw new Error("token should not be requested without env");
    },
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.deepEqual(reviewRequests, []);
  assert.match(stderr.join("\n"), /GITHUB_REVIEWER_APP_ID is required/);
  assert.match(stderr.join("\n"), /Reviewer App token path was reached/);
  assert.match(stderr.join("\n"), /No GitHub review was submitted/);
  assert.doesNotMatch(stderr.join("\n"), /secret-openai-key/);
});

test("reviewer-agent fails closed when OPENAI_API_KEY is missing", async () => {
  const stdout = [];
  const stderr = [];
  let openAiCalled = false;
  const fetchImpl = await makeReviewerAgentFetch({
    onOpenAiRequest: () => {
      openAiCalled = true;
    },
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.equal(openAiCalled, false);
  assert.match(stderr.join("\n"), /OPENAI_API_KEY is required/);
  assert.match(stderr.join("\n"), /No OpenAI API call was made/);
  assert.doesNotMatch(stderr.join("\n"), /secret-gh-token/);
});

test("reviewer-agent refuses invalid OpenAI JSON output", async () => {
  const stdout = [];
  const stderr = [];
  const fetchImpl = await makeReviewerAgentFetch({
    openAiText: "not-json",
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join("\n"), /not valid JSON/);
  assert.match(stderr.join("\n"), /no valid review was accepted/i);
  assert.doesNotMatch(stderr.join("\n"), /secret-openai-key/);
});

test("reviewer-agent refuses unknown OpenAI decision vocabulary", async () => {
  const stdout = [];
  const stderr = [];
  const reviewRequests = [];
  const fetchImpl = await makeReviewerAgentFetch({
    onReviewRequest: (request) => reviewRequests.push(request),
    openAiText: JSON.stringify({
      decision: "MERGE_NOW",
      confidence: "high",
      summary: "Unsafe vocabulary.",
      findings: [],
      checks: {
        pr_state_ok: true,
        metadata_ok: true,
        checks_ok: true,
        scope_ok: true,
        forbidden_files_ok: true,
        review_cadence_ok: true,
      },
      review_body_markdown: "Looks ready.",
    }),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.deepEqual(reviewRequests, []);
  assert.match(stderr.join("\n"), /Reviewer decision is unknown/);
  assert.match(stderr.join("\n"), /No GitHub review was submitted/);
  assert.doesNotMatch(stderr.join("\n"), /secret-openai-key/);
});

test("reviewer-agent refuses forbidden model output actions", async () => {
  const stdout = [];
  const stderr = [];
  const fetchImpl = await makeReviewerAgentFetch({
    decision: makeReviewerDecision({
      decision: "HUMAN_REVIEW_REQUIRED",
      review_body_markdown: "Run gh pr merge 119 after this review.",
    }),
  });

  const exitCode = await main({
    argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
    env: {
      GH_TOKEN: "secret-gh-token",
      OPENAI_API_KEY: "secret-openai-key",
    },
    fetchImpl,
    stderr: (line) => stderr.push(line),
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join("\n"), /gh pr merge/);
  assert.match(stderr.join("\n"), /No GitHub review was submitted/);
});

for (const scenario of [
  {
    name: "draft PR",
    pullRequest: { draft: true },
    expectedGate: "pr_state_ok",
  },
  {
    name: "merged PR in paired-review mode",
    pullRequest: { merged: true, merged_at: "2026-05-01T11:26:53Z" },
    expectedGate: "pr_state_ok",
  },
  {
    name: "missing PR metadata",
    pullRequest: { body: "Closes: MAR-314" },
    expectedGate: "metadata_ok",
  },
  {
    name: "failing checks",
    checks: {
      check_runs: [{ conclusion: "failure", name: "CI", status: "completed" }],
      statuses: [],
    },
    expectedGate: "checks_ok",
  },
  {
    name: "forbidden files",
    files: [{ filename: "src/game/movement.js" }],
    expectedGate: "forbidden_files_ok",
  },
]) {
  test(`reviewer-agent blocks approval for ${scenario.name}`, async () => {
    const stdout = [];
    const stderr = [];
    let openAiCalled = false;
    const fetchImpl = await makeReviewerAgentFetch({
      checks: scenario.checks,
      decision: makeReviewerDecision({
        decision: "APPROVED_FOR_MERGE",
        review_body_markdown: "Approved for merge.",
      }),
      files: scenario.files,
      onOpenAiRequest: () => {
        openAiCalled = true;
      },
      pullRequest: scenario.pullRequest,
    });

    const exitCode = await main({
      argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
      env: {
        GH_TOKEN: "secret-gh-token",
        OPENAI_API_KEY: "secret-openai-key",
      },
      fetchImpl,
      stderr: (line) => stderr.push(line),
      stdout: (line) => stdout.push(line),
    });

    assert.equal(exitCode, 1);
    assert.deepEqual(stdout, []);
    assert.equal(openAiCalled, false);
    assert.match(stderr.join("\n"), /Local preflight refused before OpenAI/);
    assert.match(stderr.join("\n"), /No OpenAI API call was made/);
    assert.match(stderr.join("\n"), new RegExp(scenario.expectedGate));
    assert.match(stderr.join("\n"), /No GitHub review was submitted/);
  });
}

for (const label of [
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "blocked",
  "human-only",
  "risk:human-only",
]) {
  test(`reviewer-agent refuses ${label} before OpenAI`, async () => {
    const stdout = [];
    const stderr = [];
    let openAiCalled = false;
    const fetchImpl = await makeReviewerAgentFetch({
      labels: [label],
      onOpenAiRequest: () => {
        openAiCalled = true;
      },
    });

    const exitCode = await main({
      argv: ["--pr", "119", "--issue", "MAR-314", "--dry-run"],
      env: {
        GH_TOKEN: "secret-gh-token",
        OPENAI_API_KEY: "secret-openai-key",
      },
      fetchImpl,
      stderr: (line) => stderr.push(line),
      stdout: (line) => stdout.push(line),
    });

    assert.equal(exitCode, 1);
    assert.deepEqual(stdout, []);
    assert.equal(openAiCalled, false);
    assert.match(stderr.join("\n"), /Local preflight refused before OpenAI/);
    assert.match(stderr.join("\n"), /stop or blocked label is present/);
    assert.match(stderr.join("\n"), /No OpenAI API call was made/);
    assert.match(stderr.join("\n"), /No GitHub review was submitted/);
  });
}

test("reviewer-agent direct CLI refuses missing arguments before network work", () => {
  const result = spawnSync(process.execPath, [
    join(root, "scripts", "reviewer-agent.js"),
  ], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--pr is required/);
  assert.match(result.stderr, /No OpenAI API call was made/);
  assert.match(result.stderr, /Reviewer App token path was not reached/);
  assert.match(result.stderr, /No GitHub review was submitted/);
});

test("reviewer-agent package and static surface preserve submission boundaries", () => {
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

  assert.match(agent, /OPENAI_API_KEY/);
  assert.match(agent, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(agent, /createReviewerAppInstallationToken/);
  assert.match(agent, /submitGeneratedReview/);
  assert.match(agent, /client\.submitReview/);
  for (const forbiddenPattern of [
    /\/merge/i,
    /\/labels/i,
    /process\.env\.GH_TOKEN\s*=/,
    /writeFileSync/,
    /appendFileSync/,
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

function readFixtureJson(fileName) {
  return JSON.parse(readRepoFile("test", "fixtures", fileName));
}

async function makeReviewerAgentFetch({
  checks = { check_runs: [{ conclusion: "success", name: "CI", status: "completed" }], statuses: [] },
  decision = makeReviewerDecision(),
  files = [{ filename: "scripts/reviewer-agent.js" }],
  labels = [],
  onOpenAiRequest = () => {},
  onReviewRequest = () => {},
  openAiText = null,
  pullRequest = {},
} = {}) {
  const fakePullRequest = {
    ...await makeFakeClient({ issue: "MAR-314" }).getPullRequest(),
    body: makePrBody({ issue: "MAR-314" }),
    head: { ref: "mar-314-openai-reviewer-invocation", sha: "abc123" },
    title: "MAR-314 OpenAI invocation",
    ...pullRequest,
  };
  const responseByPath = new Map([
    ["/repos/urkrass/Tanchiki/pulls/119", { json: fakePullRequest }],
    ["/repos/urkrass/Tanchiki/issues/119", { json: { labels } }],
    ["/repos/urkrass/Tanchiki/pulls/119/files?per_page=100&page=1", { json: files }],
    ["/repos/urkrass/Tanchiki/commits/abc123/check-runs?per_page=100", {
      json: { check_runs: checks.check_runs || [] },
    }],
    ["/repos/urkrass/Tanchiki/commits/abc123/status", {
      json: { statuses: checks.statuses || [] },
    }],
  ]);

  return async (url, init = {}) => {
    if (url === openAiResponsesUrl) {
      onOpenAiRequest({ init, url });
      assert.equal(init.method, "POST");
      assert.doesNotMatch(init.body, /secret-gh-token|secret-openai-key/);
      return jsonResponse({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: openAiText ?? JSON.stringify(decision),
              },
            ],
          },
        ],
        usage: {
          input_tokens: 1000,
          output_tokens: 250,
          total_tokens: 1250,
        },
      });
    }

    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + parsedUrl.search;

    if (path === "/repos/urkrass/Tanchiki/pulls/119/reviews") {
      assert.equal(init.method, "POST");
      assert.doesNotMatch(init.body, /secret-gh-token|secret-openai-key|secret-reviewer-token/);
      onReviewRequest({
        authorization: init.headers.Authorization,
        body: JSON.parse(init.body),
        path,
      });
      return jsonResponse({ id: 42 });
    }

    assert.equal(init.method, "GET");
    assert.doesNotMatch(path, /reviews|merge|labels/i);

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
}

function makeReviewerDecision(overrides = {}) {
  return validateReviewerDecision({
    decision: "HUMAN_REVIEW_REQUIRED",
    confidence: "medium",
    summary: "Generated review requires human confirmation.",
    findings: [],
    checks: {
      pr_state_ok: true,
      metadata_ok: true,
      checks_ok: true,
      scope_ok: true,
      forbidden_files_ok: true,
      review_cadence_ok: true,
    },
    review_body_markdown: "Human review required.",
    ...overrides,
    checks: {
      pr_state_ok: true,
      metadata_ok: true,
      checks_ok: true,
      scope_ok: true,
      forbidden_files_ok: true,
      review_cadence_ok: true,
      ...(overrides.checks || {}),
    },
  });
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
