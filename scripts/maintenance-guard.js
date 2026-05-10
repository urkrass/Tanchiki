import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  formatMissingAuthChannels,
  getMissingAuthChannels,
  githubAuthChannel,
  readFirstEnv,
  redactSecureText,
} from "./secure-runner.js";
import {
  requiredPrBodyHeadings,
  summarizeChecks,
  summarizePrMetadata,
} from "./reviewer-evidence.js";

export const defaultRepo = "urkrass/Tanchiki";
export const activeLinearProject = "Tanchiki — Playable Tank RPG Prototype";
export const maintenanceGuardSchemaVersion = "tanchiki.maintenance_guard.report.v1";

export const guardOutcomes = [
  "PASS",
  "WARN",
  "FOLLOW_UP_RECOMMENDED",
  "HUMAN_REVIEW_REQUIRED",
  "BLOCKED",
];

export const requiredValidationCommands = [
  "npm test",
  "npm run build",
  "npm run lint",
  "git diff --check",
];

const maxEvidenceChars = 240;
const broadDiffFileThreshold = 8;
const broadDiffChangeThreshold = 800;

const maintenanceSecretEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_RUNTIME_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "LINEAR_API_KEY",
  "LINEAR_API_TOKEN",
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "OPENAI_API_KEY",
  "YARN_NPM_AUTH_TOKEN",
];

const forbiddenActions = [
  "Do not auto-merge.",
  "Do not mutate GitHub labels.",
  "Do not remove stop labels.",
  "Do not change workflows unless explicitly scoped.",
  "Do not change dependencies unless explicitly approved.",
  "Do not print or write secrets.",
  "Do not touch gameplay files or src/game/movement.js unless explicitly scoped.",
  "Do not disable tests, suppress failures, or weaken validation.",
];

const readOnlyGitHubPathPatterns = [
  /^\/pulls\/\d+$/,
  /^\/issues\/\d+$/,
  /^\/pulls\/\d+\/files\?per_page=100&page=\d+$/,
  /^\/commits\/[A-Za-z0-9._-]+\/check-runs\?per_page=100$/,
  /^\/commits\/[A-Za-z0-9._-]+\/status$/,
  /^\/issues\/\d+\/comments\?per_page=100$/,
  /^\/pulls\/\d+\/reviews\?per_page=100$/,
];

const unsafeEvidencePatterns = [
  /auto-merge/i,
  /branch protection/i,
  /continue-on-error\s*:\s*true/i,
  /disable (?:the )?(?:test|tests|check|checks|ci|validation)/i,
  /gh\s+pr\s+merge/i,
  /mutate GitHub labels?/i,
  /remove (?:the )?stop labels?/i,
  /skip (?:the )?(?:test|tests|check|checks|ci|validation)/i,
  /suppress (?:the )?(?:failure|failures|check|checks)/i,
];

const validationWeakeningRules = [
  {
    id: "focused-test-only",
    pattern: /\b(?:describe|test|it)\.only\s*\(/,
    reason: "focused test-only marker added",
  },
  {
    id: "test-skip",
    pattern: /\b(?:describe|test|it)\.skip\s*\(/,
    reason: "test skip marker added",
  },
  {
    id: "continue-on-error",
    pattern: /\bcontinue-on-error\s*:\s*true\b/i,
    reason: "CI continue-on-error added",
  },
  {
    id: "shell-true-fallback",
    pattern: /(?:\|\|\s*true\b|;\s*exit\s+0\b)/,
    reason: "failure-suppressing shell fallback added",
  },
  {
    id: "disable-validation-language",
    pattern: /disable (?:the )?(?:test|tests|check|checks|ci|validation)/i,
    reason: "validation-disabling language added",
  },
];

export async function runMaintenanceGuard({
  client = null,
  env = process.env,
  fetchImpl = fetch,
  fixture = null,
  options = {},
} = {}) {
  const repo = validateRepo(options.repo || fixture?.repo || defaultRepo);
  const mode = fixture ? "fixture" : "live";
  const source = fixture
    ? normalizeReportSource(fixture, { mode, options, repo })
    : await collectLiveReportSource({ client, env, fetchImpl, options: { ...options, repo } });
  const report = analyzeMaintenanceGuard(source, {
    activeProject: options.activeProject || source.activeProject || activeLinearProject,
    env,
    mode,
    repo,
  });

  return {
    schema_version: maintenanceGuardSchemaVersion,
    mode,
    report,
  };
}

export function analyzeMaintenanceGuard(source, {
  activeProject = activeLinearProject,
  env = {},
  mode = "fixture",
  repo = defaultRepo,
} = {}) {
  const normalized = normalizeReportSource(source, { mode, repo });
  const findings = [];
  const linkedIssue = normalized.linkedIssue || findLinkedIssue(normalized.pr.body);
  const metadata = summarizeSafePrMetadata(normalized.pr.body, linkedIssue);
  const activeProjectValue = extractActiveLinearProject(normalized.pr.body);
  const checkSummary = summarizeSourceChecks(normalized.checks);
  const changedFileSummary = summarizeChangedFiles(normalized.files);
  const validationEvidence = summarizeValidationEvidence(metadata);
  const rawEvidence = collectEvidenceText(normalized);
  const redactedEvidence = redactMaintenanceText(rawEvidence, { env });

  evaluatePrState(normalized.pr, findings, { env });
  evaluateMetadata({
    activeProject,
    activeProjectValue,
    linkedIssue,
    metadata,
    validationEvidence,
  }, findings, { env });
  evaluateChecks(checkSummary, findings, { env });
  evaluateFiles(normalized.files, metadata, findings, { env });
  evaluateDiffSafety(normalized.files, redactedEvidence, findings, { env });
  evaluateMaintenanceDebt(normalized, metadata, changedFileSummary, findings, { env });

  const cleanupFollowups = buildCleanupFollowups(findings);
  const outcome = chooseOutcome(findings);

  return {
    active_linear_project: activeProject,
    repo: normalized.repo,
    mode,
    pr: {
      number: normalized.pr.number,
      url: normalized.pr.url,
      title: normalized.pr.title,
      base_branch: normalized.pr.baseBranch,
      head_branch: normalized.pr.headBranch,
      head_sha: normalized.pr.headSha,
      state: normalized.pr.state,
    },
    linked_linear_issue: linkedIssue || null,
    changed_files: changedFileSummary,
    validation: {
      required_commands: [...requiredValidationCommands],
      checks: checkSummary,
      pr_body_commands_present: validationEvidence.commandsPresent,
      pr_body_commands_missing: validationEvidence.commandsMissing,
    },
    pr_metadata: {
      required_headings_ok: metadata.required_headings_ok,
      missing_headings: metadata.missing_headings,
      role: metadata.role,
      type: metadata.type,
      risk: metadata.risk,
      validation: metadata.validation,
      role_type_risk_validation_ok: metadata.role_type_risk_validation_ok,
      role_type_risk_validation_findings: metadata.role_type_risk_validation_findings,
      mentions_linked_issue: Boolean(linkedIssue) && metadata.mentions_linked_issue,
      active_project: activeProjectValue || null,
      active_project_ok: compareProjectName(activeProjectValue, activeProject),
    },
    findings,
    cleanup_followups: cleanupFollowups,
    outcome,
    blocks_safe_work: outcome === "BLOCKED",
    requires_human_review: outcome === "HUMAN_REVIEW_REQUIRED",
    forbidden_actions: [...forbiddenActions],
    residual_risk: buildResidualRisk(normalized, findings, cleanupFollowups),
  };
}

export function formatMaintenanceReport(report) {
  const lines = [
    "# Maintenance Guard Report",
    "",
    `- Outcome: ${report.outcome}`,
    `- Repo: ${report.repo}`,
    `- PR: ${report.pr.number || "unknown"}${report.pr.url ? ` (${report.pr.url})` : ""}`,
    `- Linked Linear issue: ${report.linked_linear_issue || "missing"}`,
    `- Active Linear project: ${report.active_linear_project}`,
    `- Head SHA: ${report.pr.head_sha || "unknown"}`,
    `- Changed files: ${report.changed_files.count} (${report.changed_files.additions} additions, ${report.changed_files.deletions} deletions)`,
    `- Check state: ${report.validation.checks.state}`,
    "",
    "## Findings",
    ...formatFindings(report.findings),
    "",
    "## Cleanup Follow-ups",
    ...formatFollowups(report.cleanup_followups),
    "",
    "## Required Validation",
    ...report.validation.required_commands.map((command) => `- ${command}`),
    "",
    "## Forbidden Actions",
    ...report.forbidden_actions.map((action) => `- ${action}`),
    "",
    "## Residual Risk",
    `- ${report.residual_risk}`,
  ];

  return lines.join("\n");
}

export function redactMaintenanceText(value, { env = {}, extraSecrets = [] } = {}) {
  const envSecrets = Object.entries(env)
    .filter(([name, secret]) => isSecretLikeEnvName(name) && typeof secret === "string" && secret.length >= 4)
    .map(([, secret]) => secret);
  const envNamePattern = maintenanceSecretEnvNames.join("|");

  return redactSecureText(value, { env, extraSecrets: [...extraSecrets, ...envSecrets] })
    .replace(
      new RegExp(`(\\$env:(?:${envNamePattern})\\s*=\\s*)([^\\r\\n]+)`, "gi"),
      "$1[redacted]",
    )
    .replace(
      new RegExp(`\\b(${envNamePattern})\\s*=\\s*([^\\s;]+)`, "gi"),
      "$1=[redacted]",
    )
    .replace(
      new RegExp(`(["'](?:${envNamePattern})["']\\s*:\\s*["'])([^"']+)(["'])`, "gi"),
      "$1[redacted]$3",
    )
    .replace(/\bBasic\s+[A-Za-z0-9+/=._-]+/g, "Basic [redacted]")
    .replace(/\btoken\s+[A-Za-z0-9._~+/=-]{12,}/gi, "token [redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "[redacted-jwt]")
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/g, "$1[redacted]@");
}

export function sanitizeMaintenanceError(error, options = {}) {
  return redactMaintenanceText(error?.message || String(error), options);
}

export function createGitHubMaintenanceClient({
  fetchImpl = fetch,
  repo = defaultRepo,
  token = null,
} = {}) {
  const [owner, repoName] = parseRepo(repo);
  const authToken = typeof token === "string" ? token.trim() : "";
  if (!authToken) {
    throw createMaintenanceAuthError("Maintenance Guard live inspection refused before network access.");
  }

  async function request(path, { accept = "application/vnd.github+json", responseType = "json" } = {}) {
    assertReadOnlyGitHubPath(path);

    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repoName}${path}`, {
      headers: {
        Accept: accept,
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "tanchiki-maintenance-guard",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "GET",
    });

    if (!response.ok) {
      if (isGitHubAuthOrRateLimitFailure(response, await response.text())) {
        throw createMaintenanceAuthError(`GitHub API GET ${path} failed with HTTP ${response.status}.`);
      }
      throw new MaintenanceGuardError(
        "github-read-failed",
        `GitHub API GET ${path} failed with HTTP ${response.status}.`,
      );
    }

    return responseType === "text" ? response.text() : response.json();
  }

  return {
    getPullRequest(pr) {
      return request(`/pulls/${normalizeNumericId(pr, "PR number")}`);
    },
    getIssue(pr) {
      return request(`/issues/${normalizeNumericId(pr, "PR number")}`);
    },
    async listPullRequestFiles(pr) {
      const files = [];
      for (let page = 1; page <= 10; page += 1) {
        const pageFiles = await request(`/pulls/${normalizeNumericId(pr, "PR number")}/files?per_page=100&page=${page}`);
        files.push(...pageFiles);
        if (pageFiles.length < 100) {
          return files;
        }
      }
      throw new MaintenanceGuardError(
        "too-many-files",
        "PR changed-file list exceeded the bounded inspection limit.",
      );
    },
    getPullRequestDiff(pr) {
      return request(`/pulls/${normalizeNumericId(pr, "PR number")}`, {
        accept: "application/vnd.github.v3.diff",
        responseType: "text",
      });
    },
    async getChecks(sha) {
      const safeSha = requireText(sha, "PR head SHA");
      const [checkRuns, status] = await Promise.all([
        request(`/commits/${encodeURIComponent(safeSha)}/check-runs?per_page=100`),
        request(`/commits/${encodeURIComponent(safeSha)}/status`),
      ]);
      return {
        checkRuns: checkRuns.check_runs || [],
        status,
      };
    },
    listIssueComments(pr) {
      return request(`/issues/${normalizeNumericId(pr, "PR number")}/comments?per_page=100`);
    },
    listPullRequestReviews(pr) {
      return request(`/pulls/${normalizeNumericId(pr, "PR number")}/reviews?per_page=100`);
    },
  };
}

export function parseArgs(argv = []) {
  const options = {
    activeProject: activeLinearProject,
    json: false,
    repo: defaultRepo,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--active-project":
        options.activeProject = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--fixture":
        options.fixturePath = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--issue":
        options.issue = readArgValue(argv, index, arg).toUpperCase();
        index += 1;
        break;
      case "--json":
        options.json = true;
        break;
      case "--pr":
        options.pr = Number.parseInt(readArgValue(argv, index, arg), 10);
        index += 1;
        break;
      case "--repo":
        options.repo = readArgValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new MaintenanceGuardError("invalid-argument", `Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2), {
  env = process.env,
  fetchImpl = fetch,
  stderr = (message) => console.error(message),
  stdout = (message) => console.log(message),
} = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    stdout(usageText());
    return { ok: true };
  }

  try {
    const fixture = options.fixturePath
      ? JSON.parse(await readFile(options.fixturePath, "utf8"))
      : null;
    const result = await runMaintenanceGuard({ env, fetchImpl, fixture, options });
    const output = options.json
      ? JSON.stringify(result.report, null, 2)
      : formatMaintenanceReport(result.report);
    stdout(redactMaintenanceText(output, { env }));
    return { ok: true, result };
  } catch (error) {
    stderr(`Maintenance Guard failed: ${sanitizeMaintenanceError(error, { env })}`);
    return { ok: false, error };
  }
}

async function collectLiveReportSource({ client = null, env = {}, fetchImpl = fetch, options = {} } = {}) {
  validateRepo(options.repo || defaultRepo);
  const missingAuth = getMissingAuthChannels(env, [githubAuthChannel]);
  if (missingAuth.length > 0) {
    throw createMaintenanceAuthError(
      `Missing GitHub auth for live Maintenance Guard inspection: ${formatMissingAuthChannels(missingAuth)}.`,
    );
  }
  const prNumber = normalizeNumericId(options.pr, "PR number");
  const authToken = readFirstEnv(env, githubAuthChannel.envNames);
  const githubClient = client || createGitHubMaintenanceClient({
    fetchImpl,
    repo: options.repo || defaultRepo,
    token: authToken,
  });
  const pull = await githubClient.getPullRequest(prNumber);
  const headSha = requireText(options.headSha || pull?.head?.sha, "PR head SHA");
  const [githubIssue, files, diff, checks, comments, reviews] = await Promise.all([
    githubClient.getIssue(prNumber),
    githubClient.listPullRequestFiles(prNumber),
    githubClient.getPullRequestDiff(prNumber),
    githubClient.getChecks(headSha),
    githubClient.listIssueComments?.(prNumber).catch(() => []),
    githubClient.listPullRequestReviews?.(prNumber).catch(() => []),
  ]);

  return normalizeReportSource({
    checks,
    comments,
    diff,
    files,
    labels: githubIssue.labels,
    linkedIssue: options.issue,
    pr: {
      base_branch: pull.base?.ref || null,
      body: pull.body || "",
      draft: pull.draft === true,
      head_branch: pull.head?.ref || null,
      head_sha: headSha,
      merged: pull.merged === true || Boolean(pull.merged_at),
      number: pull.number || prNumber,
      state: pull.state || "unknown",
      title: pull.title || "",
      url: pull.html_url || null,
    },
    repo: options.repo || defaultRepo,
    reviews,
  }, {
    mode: "live",
    options,
    repo: options.repo || defaultRepo,
  });
}

function evaluatePrState(pr, findings, { env }) {
  if (pr.state.merged) {
    addFinding(findings, {
      evidence: "PR is already merged.",
      id: "pr-already-merged",
      message: "Maintenance Guard should inspect unmerged PRs before release handoff.",
      severity: "human-review",
      source: "pr-state",
    }, { env });
  }
  if (pr.state.draft) {
    addFinding(findings, {
      evidence: "PR is marked draft.",
      id: "draft-pr",
      message: "Draft PRs can be reported on, but readiness decisions require human review.",
      severity: "warn",
      source: "pr-state",
    }, { env });
  }
  if (pr.state.value && pr.state.value !== "open") {
    addFinding(findings, {
      evidence: `PR state is ${pr.state.value}.`,
      id: "pr-not-open",
      message: "PR is not open, so the report cannot support ordinary review readiness.",
      severity: "human-review",
      source: "pr-state",
    }, { env });
  }
}

function evaluateMetadata({
  activeProject,
  activeProjectValue,
  linkedIssue,
  metadata,
  validationEvidence,
}, findings, { env }) {
  if (!linkedIssue || !metadata.mentions_linked_issue) {
    addFinding(findings, {
      evidence: linkedIssue ? `Linked issue ${linkedIssue} not found in PR body.` : "No MAR issue found in PR body.",
      id: "missing-linked-issue",
      message: "PR metadata must link the Linear issue before Maintenance Guard can pass.",
      severity: "blocker",
      source: "metadata",
    }, { env });
  }

  if (!metadata.required_headings_ok) {
    addFinding(findings, {
      evidence: metadata.missing_headings.join(", "),
      id: "missing-pr-template-headings",
      message: "PR body is missing required template headings.",
      severity: "blocker",
      source: "metadata",
    }, { env });
  }

  if (!metadata.role_type_risk_validation_ok) {
    addFinding(findings, {
      evidence: metadata.role_type_risk_validation_findings.join("; "),
      id: "invalid-role-type-risk-validation",
      message: "Role/type/risk/validation metadata is incomplete or ambiguous.",
      severity: "blocker",
      source: "metadata",
    }, { env });
  }

  if (!activeProjectValue || !compareProjectName(activeProjectValue, activeProject)) {
    addFinding(findings, {
      evidence: activeProjectValue || "Active Linear project is missing.",
      id: "active-project-mismatch",
      message: "PR must fail closed when the active Linear project is missing or wrong.",
      severity: "blocker",
      source: "metadata",
    }, { env });
  }

  if (validationEvidence.commandsMissing.length > 0) {
    addFinding(findings, {
      evidence: validationEvidence.commandsMissing.join(", "),
      id: "missing-required-validation-evidence",
      message: "PR body does not list the full required validation set.",
      severity: "blocker",
      source: "validation",
    }, { env });
  }
}

function evaluateChecks(checkSummary, findings, { env }) {
  if (!isPassingCheckState(checkSummary.state)) {
    const evidence = checkSummary.findings?.length > 0
      ? checkSummary.findings.join("; ")
      : `check state: ${checkSummary.state}`;
    addFinding(findings, {
      evidence,
      id: "required-checks-not-passing",
      message: "Maintenance Guard must not treat missing, pending, failing, stale, or unreadable checks as passing.",
      severity: "blocker",
      source: "checks",
    }, { env });
  }
}

function evaluateFiles(files, metadata, findings, { env }) {
  for (const file of files) {
    if (file.filename === "src/game/movement.js") {
      addFinding(findings, {
        evidence: file.filename,
        id: "protected-movement-file",
        message: "Protected movement core was touched.",
        severity: "blocker",
        source: "files",
      }, { env });
    }

    if (file.filename.startsWith(".github/workflows/")) {
      addFinding(findings, {
        evidence: file.filename,
        id: "workflow-change",
        message: "Workflow changes require explicit scope and approval.",
        severity: "blocker",
        source: "files",
      }, { env });
    }

    if (isDependencyChange(file)) {
      addFinding(findings, {
        evidence: file.filename,
        id: "dependency-change",
        message: "Dependency or lockfile changes require explicit approval.",
        severity: "blocker",
        source: "files",
      }, { env });
    }

    if (isProtectedSecretPath(file.filename)) {
      addFinding(findings, {
        evidence: file.filename,
        id: "protected-secret-path",
        message: "Secret-bearing local files must not be changed or reported as safe.",
        severity: "blocker",
        source: "files",
      }, { env });
    }

    if (isGameplayPath(file.filename) && !metadataTypeAllowsGameplay(metadata.type)) {
      addFinding(findings, {
        evidence: file.filename,
        id: "unscoped-gameplay-change",
        message: "Gameplay files are outside this PR type and must not be treated as maintenance debt.",
        severity: "blocker",
        source: "files",
      }, { env });
    }
  }
}

function evaluateDiffSafety(files, redactedEvidence, findings, { env }) {
  for (const file of files) {
    for (const line of addedPatchLines(file.patch)) {
      if (isLikelyFixtureOrPatternDefinitionLine(line)) {
        continue;
      }
      for (const rule of validationWeakeningRules) {
        if (rule.pattern.test(line)) {
          addFinding(findings, {
            evidence: line,
            id: rule.id,
            message: `Validation weakening detected: ${rule.reason}.`,
            severity: "blocker",
            source: "diff",
          }, { env });
        }
      }
    }
  }

  if (containsUnredactedSecretLikeText(redactedEvidence)) {
    addFinding(findings, {
      evidence: "[redacted secret-like evidence]",
      id: "secret-like-content",
      message: "PR evidence includes token-like or secret-like content; human triage is required before proceeding.",
      severity: "blocker",
      source: "redaction",
    }, { env });
  }
}

function evaluateMaintenanceDebt(normalized, metadata, changedFileSummary, findings, { env }) {
  const addedLines = normalized.files.flatMap((file) => addedPatchLines(file.patch)
    .map((line) => ({ file: file.filename, line })));
  const todoLines = addedLines.filter(({ line }) => /\b(?:TODO|FIXME)\b/i.test(line));
  const safeTodoLines = todoLines.filter(({ line }) => !isUnsafeMaintenanceLine(line));
  const sensitiveTodoLines = todoLines.filter(({ line }) => isUnsafeMaintenanceLine(line));

  for (const { file, line } of sensitiveTodoLines) {
    addFinding(findings, {
      evidence: `${file}: ${line}`,
      id: "sensitive-todo",
      message: "Security, validation, or workflow-sensitive TODOs require human review instead of cleanup-only handling.",
      severity: "human-review",
      source: "debt",
    }, { env });
  }

  if (safeTodoLines.length === 1) {
    addFinding(findings, {
      evidence: `${safeTodoLines[0].file}: ${safeTodoLines[0].line}`,
      id: "minor-todo",
      message: "One bounded non-safety TODO is acceptable debt and should not block safe work.",
      severity: "warn",
      source: "debt",
    }, { env });
  } else if (safeTodoLines.length > 1) {
    addFinding(findings, {
      evidence: `${safeTodoLines.length} bounded non-safety TODOs added.`,
      id: "cleanup-todo-cluster",
      message: "Multiple bounded TODOs should become a cleanup follow-up, but do not block otherwise safe work.",
      severity: "follow-up",
      source: "debt",
    }, { env });
  }

  if (hasRepeatedFixturePattern(normalized.files)) {
    addFinding(findings, {
      evidence: "Repeated fixture/helper patterns in test additions.",
      id: "fixture-helper-extraction",
      message: "Repeated fixture setup should be recommended as cleanup if the PR is otherwise safe.",
      severity: "follow-up",
      source: "debt",
    }, { env });
  }

  if (isBroadDiff(changedFileSummary) && !hasMeaningfulBroadScanReason(metadata.validation_evidence.broad_scan_reason)) {
    addFinding(findings, {
      evidence: `${changedFileSummary.count} files and ${changedFileSummary.changes} changed lines.`,
      id: "broad-diff-without-rationale",
      message: "Broad diffs without a clear broad-scan rationale require human review.",
      severity: "human-review",
      source: "scope",
    }, { env });
  }
}

function buildCleanupFollowups(findings) {
  return findings
    .filter((finding) => finding.severity === "follow-up")
    .map((finding) => ({
      title: cleanupTitleForFinding(finding),
      reason: finding.message,
      suggested_role: "Coder",
      suggested_type: "harness",
      suggested_risk: "low",
      suggested_validation: "harness",
      blocking_policy: "recommended-only; do not block safe work unless another blocker is present",
      source_finding: finding.id,
    }));
}

function chooseOutcome(findings) {
  if (findings.some((finding) => finding.severity === "blocker")) {
    return "BLOCKED";
  }
  if (findings.some((finding) => finding.severity === "human-review")) {
    return "HUMAN_REVIEW_REQUIRED";
  }
  if (findings.some((finding) => finding.severity === "follow-up")) {
    return "FOLLOW_UP_RECOMMENDED";
  }
  if (findings.some((finding) => finding.severity === "warn")) {
    return "WARN";
  }
  return "PASS";
}

function addFinding(findings, finding, { env = {} } = {}) {
  findings.push({
    blocking: finding.severity === "blocker",
    evidence: sanitizeEvidenceSnippet(finding.evidence, { env }),
    id: finding.id,
    message: finding.message,
    severity: finding.severity,
    source: finding.source,
  });
}

function normalizeReportSource(source = {}, { mode = "fixture", options = {}, repo = defaultRepo } = {}) {
  const validatedRepo = validateRepo(source.repo || repo);
  const pr = normalizePr(source.pr || source.pullRequest || {
    body: source.prBody,
    number: source.prNumber || options.pr,
    url: source.prUrl,
  });
  const files = normalizeChangedFiles(
    source.changedFiles
    || source.files
    || source.changed_files?.files
    || [],
  );

  return {
    activeProject: source.activeProject || source.active_linear_project || null,
    checks: source.checks || {},
    comments: normalizeTextItems(source.comments || source.issueComments || []),
    diff: normalizeDiff(source.diff),
    files,
    labels: normalizeLabels(source.labels || []),
    linkedIssue: (source.linkedIssue || source.linked_issue || options.issue || "").toString().trim().toUpperCase(),
    mode,
    pr,
    repo: validatedRepo,
    reviews: normalizeTextItems(source.reviews || source.pullRequestReviews || []),
    stderr: source.stderr || "",
    stdout: source.stdout || "",
    error: source.error || null,
  };
}

function normalizePr(pr = {}) {
  const rawState = typeof pr.state === "object" ? pr.state.value : pr.state;
  const stateValue = String(rawState || "open").trim().toLowerCase();
  const draft = pr.draft === true || pr.state?.draft === true;
  const merged = pr.merged === true || pr.state?.merged === true || Boolean(pr.merged_at);

  return {
    baseBranch: pr.base_branch || pr.baseBranch || pr.base?.ref || null,
    body: pr.body || "",
    headBranch: pr.head_branch || pr.headBranch || pr.head?.ref || null,
    headSha: pr.head_sha || pr.headSha || pr.head?.sha || null,
    number: pr.number || null,
    state: {
      draft,
      merged,
      open: pr.state?.open ?? stateValue === "open",
      value: stateValue,
    },
    title: pr.title || "",
    url: pr.url || pr.html_url || null,
  };
}

function normalizeChangedFiles(files = []) {
  return files.map((file) => ({
    additions: numberOrZero(file.additions),
    changes: numberOrZero(file.changes),
    deletions: numberOrZero(file.deletions),
    filename: normalizePath(file.filename || file.path || ""),
    patch: typeof file.patch === "string" ? file.patch : "",
    status: file.status || null,
  }));
}

function normalizeDiff(diff) {
  if (typeof diff === "string") {
    return {
      text: diff,
      truncated: false,
    };
  }
  return {
    text: diff?.text || "",
    truncated: Boolean(diff?.truncated),
  };
}

function normalizeTextItems(items = []) {
  return items.map((item) => {
    if (typeof item === "string") {
      return {
        author: null,
        body: item,
      };
    }
    return {
      author: item.user?.login || item.author || null,
      body: item.body || item.comment || item.text || "",
    };
  });
}

function normalizeLabels(labels = []) {
  return labels.map((label) => (typeof label === "string" ? label : label.name || "")).filter(Boolean);
}

function summarizeSafePrMetadata(prBody, linkedIssue) {
  const issueToken = linkedIssue || "__missing_linear_issue__";
  const metadata = summarizePrMetadata(prBody, issueToken);
  if (!linkedIssue) {
    return {
      ...metadata,
      mentions_linked_issue: false,
    };
  }
  return metadata;
}

function summarizeSourceChecks(checks = {}) {
  if (checks.state && (checks.check_runs || checks.commit_statuses || checks.findings)) {
    return {
      check_run_count: checks.check_run_count || checks.check_runs?.length || 0,
      check_runs: checks.check_runs || [],
      commit_status_count: checks.commit_status_count || checks.commit_statuses?.length || 0,
      commit_statuses: checks.commit_statuses || [],
      findings: checks.findings || [],
      state: checks.state,
      unavailable_reason: checks.unavailable_reason || checks.unavailableReason || null,
    };
  }
  return summarizeChecks({
    checkRuns: checks.checkRuns || checks.check_runs || [],
    status: checks.status || { statuses: checks.statuses || checks.commit_statuses || [] },
    unavailableReason: checks.unavailableReason || checks.unavailable_reason,
  });
}

function isPassingCheckState(state) {
  return state === "success" || state === "passing";
}

function summarizeChangedFiles(files) {
  const statusCounts = {};
  const topLevelPaths = new Set();
  let additions = 0;
  let deletions = 0;
  let changes = 0;

  for (const file of files) {
    additions += file.additions;
    deletions += file.deletions;
    changes += file.changes || file.additions + file.deletions;
    statusCounts[file.status || "unknown"] = (statusCounts[file.status || "unknown"] || 0) + 1;
    topLevelPaths.add(file.filename.split("/")[0] || file.filename);
  }

  return {
    additions,
    changes,
    count: files.length,
    deletions,
    files: files.map((file) => ({
      additions: file.additions,
      changes: file.changes,
      deletions: file.deletions,
      filename: file.filename,
      status: file.status,
    })),
    status_counts: statusCounts,
    top_level_paths: [...topLevelPaths].sort(),
  };
}

function summarizeValidationEvidence(metadata) {
  const testsRun = metadata.validation_evidence.tests_run || "";
  const commandsPresent = requiredValidationCommands
    .filter((command) => testsRun.toLowerCase().includes(command.toLowerCase()));
  const commandsMissing = requiredValidationCommands
    .filter((command) => !commandsPresent.includes(command));
  return {
    commandsMissing,
    commandsPresent,
  };
}

function collectEvidenceText(source) {
  return [
    source.pr.body,
    source.diff.text,
    source.stdout,
    source.stderr,
    source.error?.message || source.error,
    source.files.map((file) => file.patch).join("\n"),
    source.comments.map((comment) => comment.body).join("\n"),
    source.reviews.map((review) => review.body).join("\n"),
  ].filter(Boolean).join("\n");
}

function extractActiveLinearProject(prBody) {
  const match = String(prBody || "").match(/^Active Linear project:\s*(.+?)\s*$/im);
  return match?.[1]?.trim() || "";
}

function compareProjectName(left, right) {
  return normalizeProjectName(left) === normalizeProjectName(right);
}

function normalizeProjectName(value) {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function findLinkedIssue(value) {
  const match = String(value || "").match(/\bMAR-\d+\b/i);
  return match?.[0]?.toUpperCase() || "";
}

function addedPatchLines(patch = "") {
  return String(patch || "")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

function isLikelyFixtureOrPatternDefinitionLine(line) {
  const trimmed = String(line || "").trim();
  return (
    trimmed.startsWith("\"")
    || trimmed.startsWith("'")
    || trimmed.startsWith("`")
    || trimmed.includes("{ pattern:")
    || /:\s*["'`]/.test(trimmed)
    || /fixture|redaction|redact|unsafeEvidencePatterns|validationWeakeningRules/i.test(trimmed)
  );
}

function isDependencyChange(file) {
  if (/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(file.filename)) {
    return true;
  }
  if (file.filename !== "package.json") {
    return false;
  }
  return addedPatchLines(file.patch).some((line) => (
    /^\s*"(?:dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:/.test(line)
  ));
}

function isProtectedSecretPath(filename) {
  return (
    /(^|\/)\.env($|\.)/i.test(filename)
    || /\.pem$/i.test(filename)
    || /reviewer-env\.ps1$/i.test(filename)
  );
}

function isGameplayPath(filename) {
  return /^src\/game(?:\/|\.js$)/.test(filename);
}

function metadataTypeAllowsGameplay(type) {
  return new Set([
    "type:gameplay",
    "type:movement",
    "type:progression",
  ]).has(type);
}

function containsUnredactedSecretLikeText(text) {
  return (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)
    || /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+(?!\[redacted\]|fake-)[^\s"',}]+/i.test(text)
    || /\b(?:GH_TOKEN|GITHUB_TOKEN|LINEAR_API_KEY|LINEAR_API_TOKEN|OPENAI_API_KEY|NPM_TOKEN)\s*=\s*(?!\[redacted\]|fake-)[^\s;]+/i.test(text)
  );
}

function isUnsafeMaintenanceLine(line) {
  return matchesAny(String(line || ""), [
    /auth|credential|secret|token|redact/i,
    /workflow|dependency|lockfile|branch protection/i,
    /validation|test|check|ci|failing|skip/i,
    /gameplay|movement|progression/i,
    ...unsafeEvidencePatterns,
  ]);
}

function hasRepeatedFixturePattern(files) {
  const testPatch = files
    .filter((file) => /^test\//.test(file.filename))
    .map((file) => file.patch)
    .join("\n");
  const fixtureMentions = (testPatch.match(/\bfixture\b/gi) || []).length;
  const helperMentions = (testPatch.match(/\bbase[A-Z][A-Za-z]*\(/g) || []).length;
  return fixtureMentions >= 14 || helperMentions >= 8;
}

function isBroadDiff(summary) {
  return summary.count > broadDiffFileThreshold || summary.changes > broadDiffChangeThreshold;
}

function hasMeaningfulBroadScanReason(value) {
  const text = String(value || "").trim().toLowerCase().replace(/^[-*]\s*/, "");
  return Boolean(text)
    && !/^(?:-|n\/a|none|no broad scan(?: was used)?\.?|not needed\.?)$/.test(text);
}

function cleanupTitleForFinding(finding) {
  if (finding.id === "fixture-helper-extraction") {
    return "Extract repeated Maintenance Guard fixture helpers";
  }
  if (finding.id === "cleanup-todo-cluster") {
    return "Resolve bounded Maintenance Guard TODO cleanup";
  }
  return "Track Maintenance Guard cleanup follow-up";
}

function sanitizeEvidenceSnippet(value, { env = {} } = {}) {
  const redacted = truncate(redactMaintenanceText(value, { env }), maxEvidenceChars);
  if (unsafeEvidencePatterns.some((pattern) => pattern.test(redacted))) {
    return "[omitted unsafe instruction from PR evidence]";
  }
  return redacted || null;
}

function buildResidualRisk(source, findings, cleanupFollowups) {
  const risks = [];
  if (!source.pr.headSha) {
    risks.push("PR head SHA was unavailable");
  }
  if (source.diff.truncated) {
    risks.push("diff evidence was truncated");
  }
  if (findings.length === 0) {
    risks.push("no maintenance debt or policy findings were detected in bounded PR evidence");
  }
  if (cleanupFollowups.length > 0) {
    risks.push("cleanup follow-ups are recommendations only and were not created automatically");
  }
  return risks.join("; ");
}

function formatFindings(findings) {
  if (!findings || findings.length === 0) {
    return ["- None"];
  }
  return findings.map((finding) => (
    `- [${finding.severity}] ${finding.id}: ${finding.message}`
    + (finding.evidence ? ` Evidence: ${finding.evidence}` : "")
  ));
}

function formatFollowups(followups) {
  if (!followups || followups.length === 0) {
    return ["- None"];
  }
  return followups.map((followup) => (
    `- ${followup.title} (${followup.blocking_policy})`
  ));
}

function parseRepo(value) {
  return validateRepo(value).split("/");
}

function validateRepo(value) {
  const repo = String(value || "").trim();
  if (repo !== defaultRepo) {
    throw new MaintenanceGuardError(
      "wrong-repo",
      `Maintenance Guard is scoped to ${defaultRepo}; refusing to inspect ${repo || "unknown"}.`,
    );
  }
  return repo;
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeNumericId(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new MaintenanceGuardError("missing-identity", `${label} is required and must be numeric.`);
  }
  return text;
}

function requireText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new MaintenanceGuardError("missing-identity", `${label} is required.`);
  }
  return text;
}

function readArgValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new MaintenanceGuardError("invalid-argument", `${name} requires a value.`);
  }
  return value;
}

function assertReadOnlyGitHubPath(path) {
  if (!readOnlyGitHubPathPatterns.some((pattern) => pattern.test(path))) {
    throw new MaintenanceGuardError("unsafe-github-endpoint", `Refusing non-read or out-of-scope GitHub endpoint: ${path}`);
  }
}

function isGitHubAuthOrRateLimitFailure(response, body = "") {
  const remaining = response.headers?.get?.("x-ratelimit-remaining");
  return (
    response.status === 401
    || response.status === 403
    || response.status === 429
    || remaining === "0"
    || /bad credentials|rate limit|requires authentication|resource not accessible/i.test(body)
  );
}

function createMaintenanceAuthError(message) {
  const error = new MaintenanceGuardError("missing-or-invalid-github-auth", message);
  error.maintenanceGuardAuthError = true;
  return error;
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function truncate(value, maxChars) {
  const text = String(value || "");
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 12)}...[truncated]`;
}

function isSecretLikeEnvName(name) {
  return /(?:AUTH|KEY|PASSWORD|PRIVATE|SECRET|TOKEN)/i.test(name);
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function usageText() {
  return [
    "Usage:",
    "  node scripts/maintenance-guard.js --fixture path/to/fixture.json [--json]",
    "  node scripts/maintenance-guard.js --repo urkrass/Tanchiki --pr 123 [--issue MAR-419] [--json]",
    "",
    "Maintenance Guard is read-only. Live mode requires GH_TOKEN or GITHUB_TOKEN and refuses wrong-repo inputs.",
  ].join("\n");
}

export class MaintenanceGuardError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "MaintenanceGuardError";
    this.reason = reason;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((result) => {
    if (!result.ok) {
      process.exitCode = 1;
    }
  });
}
