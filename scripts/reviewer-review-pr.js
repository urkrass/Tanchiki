import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReviewerAppInstallationToken,
  readReviewerAppEnvironment,
  validatePrivateKeyPath,
} from "./reviewer-app-token.js";

const defaultRepo = "urkrass/Tanchiki";
const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

const requiredPrBodyHeadings = [
  "## Linked Linear Issue",
  "## Role / Type / Risk / Validation",
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
];

const forbiddenFileMatchers = [
  { pattern: /(^|\/)\.env($|\.)/i, reason: "local env file" },
  { pattern: /\.pem$/i, reason: "private key file" },
  { pattern: /reviewer-env\.ps1$/i, reason: "local reviewer env file" },
  { pattern: /^\.github\/workflows\//i, reason: "GitHub workflow file" },
  { pattern: /^src\/game\/movement\.js$/i, reason: "protected movement core" },
];

const stopLabels = new Set([
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "blocked",
  "human-only",
  "risk:human-only",
]);

const decisionEvents = {
  comment: "COMMENT",
  approve: "APPROVE",
  "request-changes": "REQUEST_CHANGES",
};

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  createTokenImpl = createReviewerAppInstallationToken,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const options = parseArgs(argv);
    const body = readReviewBody(options);
    const bodyRefusal = getReviewBodyRefusalReason(options.decision, body);
    if (bodyRefusal) {
      throw new ReviewRefusal(bodyRefusal);
    }

    stdout("Reviewer App PR review executor");
    stdout("Allowed use: Reviewer App paired-review PR comments and reviews only.");
    stdout("No merge, label, issue-edit, branch, workflow, or settings action will be performed.");
    stdout("The Reviewer App token and private key will not be printed or written to disk.");

    const context = readReviewerAppEnvironment(env);
    validatePrivateKeyPath(context.privateKeyPath);
    assertPrivateKeyIsOutsideRepo(context.privateKeyPath);

    const token = await createTokenImpl(context, { fetchImpl });
    const client = createGitHubClient({
      fetchImpl,
      repo: options.repo,
      token: token.token,
    });

    const inspection = await inspectPullRequest(options, client);
    const gateResult = evaluateReviewGates({
      options,
      body,
      inspection,
    });

    if (gateResult.refusalReasons.length > 0) {
      throw new ReviewRefusal(gateResult.refusalReasons[0], gateResult.refusalReasons.slice(1));
    }

    const event = decisionEvents[options.decision];
    const reviewRequest = {
      body,
      event,
    };

    if (!options.dryRun) {
      await client.submitReview(options.pr, reviewRequest);
    }

    printResultSummary({
      options,
      inspection,
      event,
      submitted: !options.dryRun,
      stdout,
    });
    return 0;
  } catch (error) {
    if (!(error instanceof ReviewRefusal)) {
      throw error;
    }

    stderr(`Reviewer App PR review refused: ${error.message}`);
    for (const detail of error.details) {
      stderr(`- ${detail}`);
    }
    stderr("No review was submitted.");
    return 1;
  }
}

export function parseArgs(argv) {
  const options = {
    body: null,
    bodyFile: null,
    decision: null,
    dryRun: false,
    issue: null,
    pr: null,
    repo: defaultRepo,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : arg.slice(equalsIndex + 1);

    if (!["--pr", "--issue", "--decision", "--body", "--body-file", "--repo"].includes(key)) {
      throw new ReviewRefusal(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined) {
      throw new ReviewRefusal(`${key} requires a value.`);
    }
    if (inlineValue === null) {
      index += 1;
    }

    if (key === "--pr") {
      options.pr = parsePrNumber(value);
    } else if (key === "--issue") {
      options.issue = parseIssueId(value);
    } else if (key === "--decision") {
      options.decision = parseDecision(value);
    } else if (key === "--body") {
      options.body = String(value);
    } else if (key === "--body-file") {
      options.bodyFile = String(value);
    } else if (key === "--repo") {
      options.repo = parseRepo(value);
    }
  }

  if (options.pr === null) {
    throw new ReviewRefusal("--pr is required.");
  }
  if (!options.issue) {
    throw new ReviewRefusal("--issue is required.");
  }
  if (!options.decision) {
    throw new ReviewRefusal("--decision is required.");
  }
  if ((options.body === null && options.bodyFile === null) || (options.body !== null && options.bodyFile !== null)) {
    throw new ReviewRefusal("Provide exactly one of --body or --body-file.");
  }

  return options;
}

export function readReviewBody(options) {
  if (options.body !== null) {
    return validateNonEmptyBody(options.body);
  }

  if (!existsSync(options.bodyFile)) {
    throw new ReviewRefusal("--body-file does not point to an existing file.");
  }
  if (!statSync(options.bodyFile).isFile()) {
    throw new ReviewRefusal("--body-file must point to a file.");
  }

  return validateNonEmptyBody(readFileSync(options.bodyFile, "utf8"));
}

export function getReviewBodyRefusalReason(decision, body) {
  const normalizedBody = body.toLowerCase();

  for (const forbiddenPattern of [
    /\bgh\s+pr\s+merge\b/i,
    /\bgh\s+pr\s+edit\b/i,
    /\bgh\s+issue\s+edit\b/i,
    /\bgh\s+label\b/i,
    /\bgit\s+(push|commit|tag|reset)\b/i,
    /merge:auto-eligible/i,
  ]) {
    if (forbiddenPattern.test(body)) {
      return "Review body contains forbidden merge, label, issue-edit, branch, or auto-merge intent.";
    }
  }

  if (decision === "comment" && normalizedBody.includes("approved for")) {
    return "Comment reviews must not contain approval language.";
  }

  if (decision === "approve") {
    if (!body.includes("APPROVED FOR MERGE")) {
      return "Approval body must include APPROVED FOR MERGE.";
    }
    if (!/independence/i.test(body)) {
      return "Approval body must include reviewer independence basis.";
    }
  }

  if (decision === "request-changes") {
    if (!body.includes("CHANGES REQUESTED") && !body.includes("BLOCKED")) {
      return "Request-changes body must include CHANGES REQUESTED or BLOCKED.";
    }
    if (normalizedBody.includes("approved for")) {
      return "Request-changes reviews must not contain approval language.";
    }
  }

  return null;
}

export async function inspectPullRequest(options, client) {
  const pullRequest = await client.getPullRequest(options.pr);
  const [issue, files, checks] = await Promise.all([
    client.getIssue(options.pr),
    client.listPullRequestFiles(options.pr),
    client.getChecks(pullRequest.head.sha).catch((error) => ({
      checkRuns: [],
      status: { statuses: [] },
      unavailableReason: error.message,
    })),
  ]);

  return {
    checks,
    files,
    issue,
    pullRequest,
  };
}

export function evaluateReviewGates({ options, body, inspection }) {
  const refusalReasons = [];
  const approvalOnlyRefusals = [];
  const { pullRequest, issue, files, checks } = inspection;
  const prBody = pullRequest.body || "";

  for (const reason of getHardPrRefusalReasons({ options, pullRequest, prBody })) {
    refusalReasons.push(reason);
  }

  for (const reason of getMetadataFindings(prBody)) {
    approvalOnlyRefusals.push(reason);
  }

  for (const reason of getForbiddenFileFindings(files, prBody)) {
    approvalOnlyRefusals.push(reason);
  }

  for (const reason of getStopLabelFindings(issue)) {
    approvalOnlyRefusals.push(reason);
  }

  for (const reason of getCheckFindings(checks)) {
    approvalOnlyRefusals.push(reason);
  }

  const bodyRefusal = getReviewBodyRefusalReason(options.decision, body);
  if (bodyRefusal) {
    refusalReasons.push(bodyRefusal);
  }

  if (options.decision === "approve") {
    refusalReasons.push(...approvalOnlyRefusals);
  }

  return {
    approvalOnlyRefusals,
    refusalReasons,
  };
}

export function createGitHubClient({ fetchImpl, repo, token }) {
  const [owner, repoName] = repo.split("/");

  async function request(path, { method = "GET", body } = {}) {
    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repoName}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "tanchiki-reviewer-pr-review-executor",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new ReviewRefusal(
        `GitHub API ${method} ${path} failed with ${response.status}.`,
        [responseBody],
      );
    }

    if (response.status === 204) {
      return null;
    }
    return response.json();
  }

  return {
    getPullRequest(pr) {
      return request(`/pulls/${pr}`);
    },
    getIssue(pr) {
      return request(`/issues/${pr}`);
    },
    async listPullRequestFiles(pr) {
      const files = [];
      for (let page = 1; page <= 10; page += 1) {
        const pageFiles = await request(`/pulls/${pr}/files?per_page=100&page=${page}`);
        files.push(...pageFiles);
        if (pageFiles.length < 100) {
          return files;
        }
      }
      throw new ReviewRefusal("PR changed-file list is too large to inspect safely.");
    },
    async getChecks(sha) {
      const [checkRuns, status] = await Promise.all([
        request(`/commits/${sha}/check-runs?per_page=100`),
        request(`/commits/${sha}/status`),
      ]);
      return {
        checkRuns: checkRuns.check_runs || [],
        status,
      };
    },
    submitReview(pr, review) {
      return request(`/pulls/${pr}/reviews`, {
        method: "POST",
        body: review,
      });
    },
  };
}

export class ReviewRefusal extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ReviewRefusal";
    this.details = details;
  }
}

if (isDirectRun(import.meta.url)) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(`Reviewer App PR review executor failed: ${error.message}`);
      process.exitCode = 1;
    },
  );
}

function getHardPrRefusalReasons({ options, pullRequest, prBody }) {
  const reasons = [];

  if (pullRequest.state !== "open") {
    reasons.push("PR is not open.");
  }
  if (pullRequest.draft) {
    reasons.push("PR is Draft.");
  }
  if (pullRequest.merged || pullRequest.merged_at) {
    reasons.push("PR is already merged.");
  }
  if (pullRequest.base?.ref !== "main") {
    reasons.push("PR base branch is not main.");
  }
  if (!prBody.includes(options.issue)) {
    reasons.push(`PR body does not mention linked issue ${options.issue}.`);
  }

  return reasons;
}

function getMetadataFindings(prBody) {
  const reasons = [];

  for (const heading of requiredPrBodyHeadings) {
    if (!prBody.includes(heading)) {
      reasons.push(`PR body is missing required heading: ${heading}.`);
    }
  }

  for (const marker of [
    /- Role:\s*role:[a-z-]+/i,
    /- Type:\s*type:[a-z-]+/i,
    /- Risk:\s*risk:[a-z-]+/i,
    /- Validation profile:\s*validation:[a-z-]+/i,
  ]) {
    if (!marker.test(prBody)) {
      reasons.push("PR body is missing role/type/risk/validation metadata.");
      break;
    }
  }

  return reasons;
}

function getForbiddenFileFindings(files, prBody) {
  const reasons = [];
  const typeMatch = prBody.match(/- Type:\s*(type:[a-z-]+)/i);
  const type = typeMatch?.[1]?.toLowerCase();

  for (const file of files) {
    const path = normalizePath(file.filename);
    for (const matcher of forbiddenFileMatchers) {
      if (matcher.pattern.test(path)) {
        reasons.push(`Changed file ${path} is forbidden: ${matcher.reason}.`);
      }
    }

    if (["type:docs", "type:harness", "type:test"].includes(type) && path.startsWith("src/")) {
      reasons.push(`Changed file ${path} is outside docs/harness/test issue scope.`);
    }
  }

  return reasons;
}

function getStopLabelFindings(issue) {
  const labels = issue.labels || [];
  const reasons = [];

  for (const label of labels) {
    const name = typeof label === "string" ? label : label.name;
    if (stopLabels.has(String(name).toLowerCase())) {
      reasons.push(`PR has stop label: ${name}.`);
    }
  }

  return reasons;
}

function getCheckFindings(checks) {
  const reasons = [];
  const checkRuns = checks.checkRuns || [];
  const status = checks.status || {};
  const statuses = status.statuses || [];

  if (checks.unavailableReason) {
    reasons.push(`Check status could not be read: ${checks.unavailableReason}`);
    return reasons;
  }

  if (checkRuns.length === 0 && statuses.length === 0) {
    reasons.push("Required checks could not be determined.");
  }

  for (const checkRun of checkRuns) {
    if (checkRun.status !== "completed") {
      reasons.push(`Check run ${checkRun.name} is ${checkRun.status}.`);
    } else if (checkRun.conclusion !== "success") {
      reasons.push(`Check run ${checkRun.name} concluded ${checkRun.conclusion}.`);
    }
  }

  for (const commitStatus of statuses) {
    if (commitStatus.state !== "success") {
      reasons.push(`Commit status ${commitStatus.context} is ${commitStatus.state}.`);
    }
  }

  if (statuses.length > 0 && status.state && status.state !== "success") {
    reasons.push(`Combined commit status is ${status.state}.`);
  }

  return reasons;
}

function printResultSummary({ options, inspection, event, submitted, stdout }) {
  const pr = inspection.pullRequest;
  const files = inspection.files || [];
  const checks = inspection.checks || {};
  const checkRunCount = checks.checkRuns?.length ?? 0;
  const statusCount = checks.status?.statuses?.length ?? 0;

  stdout(`PR: #${options.pr} ${pr.html_url || ""}`.trimEnd());
  stdout(`Issue: ${options.issue}`);
  stdout(`Decision: ${options.decision}`);
  stdout(`Review event: ${event}`);
  stdout(`Review submitted: ${submitted ? "yes" : "no, dry-run only"}`);
  stdout(`Changed files inspected: ${files.length}`);
  stdout(`Checks inspected: ${checkRunCount} check runs, ${statusCount} commit statuses`);
  stdout("No merge, labels, branch updates, issue edits, workflows, settings, or secrets were changed.");
}

function parsePrNumber(value) {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) {
    throw new ReviewRefusal("--pr must be a positive integer.");
  }
  return Number.parseInt(text, 10);
}

function parseIssueId(value) {
  const text = String(value).trim();
  if (!/^MAR-\d+$/.test(text)) {
    throw new ReviewRefusal("--issue must match MAR-<number>.");
  }
  return text;
}

function parseDecision(value) {
  const text = String(value).trim();
  if (!Object.hasOwn(decisionEvents, text)) {
    throw new ReviewRefusal("--decision must be comment, approve, or request-changes.");
  }
  return text;
}

function parseRepo(value) {
  const text = String(value).trim();
  if (text !== defaultRepo) {
    throw new ReviewRefusal(`--repo must be ${defaultRepo} for this campaign.`);
  }
  return text;
}

function validateNonEmptyBody(value) {
  const body = String(value).trim();
  if (!body) {
    throw new ReviewRefusal("Review body must not be empty.");
  }
  return body;
}

function assertPrivateKeyIsOutsideRepo(privateKeyPath) {
  const resolvedPrivateKeyPath = resolve(privateKeyPath);
  if (!isPathInside(resolvedPrivateKeyPath, repoRoot)) {
    return;
  }

  throw new ReviewRefusal(
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH resolves inside this repository checkout.",
    ["Reviewer App .pem files and env files must stay outside the repo."],
  );
}

function isPathInside(childPath, parentPath) {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
}

function normalizePath(path) {
  return String(path).replaceAll("\\", "/");
}

function isDirectRun(importMetaUrl) {
  return (
    process.argv[1] &&
    resolve(fileURLToPath(importMetaUrl)) === resolve(process.argv[1])
  );
}
