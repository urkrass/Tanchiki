import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  formatMissingAuthChannels,
  getMissingAuthChannels,
  githubAuthChannel,
  readFirstEnv,
  redactSecureText,
} from "./secure-runner.js";

export const defaultRepo = "urkrass/Tanchiki";
export const activeLinearProject = "Tanchiki — Playable Tank RPG Prototype";

export const ciDoctorSchemaVersion = "tanchiki.ci_doctor.handoff.v1";

export const classificationTypes = [
  "test-failure",
  "build-syntax-failure",
  "lint-static-failure",
  "pr-metadata-failure",
  "timeout-flake",
  "dependency-environment-failure",
  "auth-rate-limit-failure",
  "unknown-ci-failure",
];

export const requiredValidationCommands = [
  "npm test",
  "npm run build",
  "npm run lint",
  "git diff --check",
];

const maxEvidenceSnippets = 6;
const maxEvidenceLineChars = 240;
const safeConclusionFailures = new Set([
  "action_required",
  "cancelled",
  "failure",
  "startup_failure",
  "timed_out",
]);

const ciSecretEnvNames = [
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_RUNTIME_TOKEN",
  "ACTIONS_RESULTS_URL",
  "ACTIONS_CACHE_URL",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "LINEAR_API_KEY",
  "LINEAR_API_TOKEN",
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "OPENAI_API_KEY",
  "YARN_NPM_AUTH_TOKEN",
];

const unsafeOutputPatterns = [
  /auto-merge/i,
  /branch protection/i,
  /continue-on-error\s*:\s*true/i,
  /disable (?:the )?(?:test|tests|check|checks|ci|validation)/i,
  /gh\s+pr\s+merge/i,
  /remove (?:the )?stop labels?/i,
  /skip (?:the )?(?:test|tests|check|checks|ci|validation)/i,
  /suppress (?:the )?(?:failure|failures|check|checks)/i,
];

const readOnlyGitHubPathPatterns = [
  /^\/pulls\/\d+$/,
  /^\/commits\/[A-Za-z0-9._-]+\/check-runs\?per_page=100$/,
  /^\/commits\/[A-Za-z0-9._-]+\/status$/,
  /^\/actions\/runs\/\d+$/,
  /^\/actions\/runs\/\d+\/jobs\?per_page=100$/,
  /^\/actions\/jobs\/\d+\/logs$/,
  /^\/check-runs\/\d+\/annotations\?per_page=100$/,
];

export async function runCiDoctor({
  client = null,
  env = process.env,
  fetchImpl = fetch,
  fixture = null,
  options = {},
} = {}) {
  const repo = validateRepo(options.repo || fixture?.repo || defaultRepo);
  const mode = fixture ? "fixture" : "live";
  const source = fixture
    ? normalizeFailureSource(fixture, { mode, options, repo })
    : await collectLiveFailureSource({ client, env, fetchImpl, options: { ...options, repo } });

  const handoff = analyzeCiFailure(source, {
    env,
    mode,
    repo,
    activeProject: options.activeProject || source.activeProject || activeLinearProject,
  });

  return {
    schema_version: ciDoctorSchemaVersion,
    mode,
    handoff,
  };
}

export function analyzeCiFailure(source, {
  activeProject = activeLinearProject,
  env = {},
  mode = "fixture",
  repo = defaultRepo,
} = {}) {
  const normalized = normalizeFailureSource(source, { mode, repo });
  const rawLogText = collectLogText(normalized);
  const redactedLogText = redactCiText(rawLogText, { env });
  const classification = classifyFailure({
    annotations: normalized.annotations,
    checkRun: normalized.checkRun,
    job: publicJobMetadata(normalized.job),
    logText: redactedLogText,
    run: normalized.run,
    step: normalized.failedStep,
  });
  const evidenceSnippets = collectEvidenceSnippets({
    annotations: normalized.annotations,
    env,
    failedStep: normalized.failedStep,
    logText: redactedLogText,
  });

  return {
    active_linear_project: activeProject,
    repo: normalized.repo,
    pr: normalized.pr,
    head_sha: normalized.headSha,
    mode,
    workflow: normalized.workflow,
    run: normalized.run,
    job: publicJobMetadata(normalized.job),
    check: normalized.checkRun,
    log_source: normalized.logSource,
    classification: classification.type,
    confidence: classification.confidence,
    rationale: classification.rationale,
    first_failing_step: normalized.failedStep,
    first_failing_command: normalized.failedStep?.command || inferCommand(redactedLogText),
    evidence_snippets: evidenceSnippets,
    suspected_repair_area: classification.suspectedRepairArea,
    recommended_next_role: classification.recommendedNextRole,
    minimal_repair_instruction: classification.minimalRepairInstruction,
    validation_to_rerun: [...requiredValidationCommands],
    forbidden_actions: [
      "Do not disable tests, checks, CI, or validation.",
      "Do not suppress failures or mark failing checks as acceptable.",
      "Do not change workflows or dependencies unless a later issue explicitly scopes and approves it.",
      "Do not print or write secrets.",
      "Do not mutate GitHub labels, stop labels, repository settings, branch protection, auto-merge, or merge state.",
    ],
    residual_risk: buildResidualRisk(normalized, evidenceSnippets),
  };
}

export function classifyFailure({
  annotations = [],
  checkRun = {},
  job = {},
  logText = "",
  run = {},
  step = {},
} = {}) {
  const haystack = [
    checkRun.name,
    checkRun.conclusion,
    job.name,
    job.conclusion,
    run.name,
    run.conclusion,
    step.name,
    step.command,
    annotations.map((annotation) => annotation.message).join("\n"),
    logText,
  ].filter(Boolean).join("\n");
  const text = haystack.toLowerCase();

  if (matchesAny(text, [
    /api rate limit/,
    /bad credentials/,
    /http (?:401|403|429)/,
    /rate limit exceeded/,
    /requires authentication/,
    /resource not accessible by integration/,
  ])) {
    return classificationResult("auth-rate-limit-failure", "high");
  }

  if (job.conclusion === "timed_out" || checkRun.conclusion === "timed_out" || matchesAny(text, [
    /cancel(?:led|ed) by/,
    /job exceeded the maximum execution time/,
    /operation was canceled/,
    /process completed with exit code 143/,
    /runner.*lost/,
    /timed out/,
  ])) {
    return classificationResult("timeout-flake", "medium");
  }

  if (matchesAny(text, [
    /missing required metadata/,
    /missing required pr body/,
    /pr body/,
    /required pr body sections/,
    /role \/ type \/ risk \/ validation/,
  ])) {
    return classificationResult("pr-metadata-failure", "high");
  }

  if (matchesAny(text, [
    /\beslint\b/,
    /npm run lint/,
    /prettier/,
    /run lint/,
  ])) {
    return classificationResult("lint-static-failure", "high");
  }

  if (matchesAny(text, [
    /cannot find module/,
    /does not provide an export/,
    /module not found/,
    /node --check/,
    /npm run build/,
    /syntaxerror/,
    /unexpected (?:identifier|string|token)/,
  ])) {
    return classificationResult("build-syntax-failure", "high");
  }

  if (matchesAny(text, [
    /\bassertionerror\b/,
    /\berr_assertion\b/,
    /\bnot ok\b/,
    /failing tests?/,
    /node --test/,
    /npm test/,
    /test failed/,
  ])) {
    return classificationResult("test-failure", "high");
  }

  if (matchesAny(text, [
    /actions\/checkout/,
    /actions\/setup-node/,
    /eai_again/,
    /econnreset/,
    /enospc/,
    /npm ci/,
    /npm err!/,
    /registry\.npmjs\.org/,
    /unable to resolve dependency tree/,
  ])) {
    return classificationResult("dependency-environment-failure", "medium");
  }

  return classificationResult("unknown-ci-failure", "low");
}

export function formatRepairHandoff(handoff) {
  const lines = [
    "# CI Doctor repair handoff",
    "",
    `- Active Linear project: ${handoff.active_linear_project}`,
    `- Repository: ${handoff.repo}`,
    `- PR: ${handoff.pr?.number ? `#${handoff.pr.number}` : "unknown"}`,
    `- Head SHA: ${handoff.head_sha || "unknown"}`,
    `- Mode: ${handoff.mode}`,
    `- Workflow: ${handoff.workflow?.name || "unknown"}`,
    `- Run ID: ${handoff.run?.id || "unknown"}`,
    `- Job ID: ${handoff.job?.id || "unknown"}`,
    `- Check: ${handoff.check?.name || "unknown"}`,
    `- Classification: ${handoff.classification} (${handoff.confidence})`,
    `- First failing step: ${handoff.first_failing_step?.name || "unknown"}`,
    `- First failing command: ${handoff.first_failing_command || "unknown"}`,
    `- Log source: ${handoff.log_source || "unknown"}`,
    "",
    "## Evidence",
    ...formatBullets(handoff.evidence_snippets, "No bounded evidence snippet was available."),
    "",
    "## Repair handoff",
    `- Suspected repair area: ${handoff.suspected_repair_area}`,
    `- Recommended next role: ${handoff.recommended_next_role}`,
    `- Minimal repair instruction: ${handoff.minimal_repair_instruction}`,
    "",
    "## Validation to rerun",
    ...handoff.validation_to_rerun.map((command) => `- ${command}`),
    "",
    "## Forbidden actions",
    ...handoff.forbidden_actions.map((action) => `- ${action}`),
    "",
    "## Residual risk",
    `- ${handoff.residual_risk}`,
  ];

  return lines.join("\n");
}

export function redactCiText(value, { env = {}, extraSecrets = [] } = {}) {
  const envSecrets = Object.entries(env)
    .filter(([name, secret]) => isSecretLikeEnvName(name) && typeof secret === "string" && secret.length >= 4)
    .map(([, secret]) => secret);
  const envNamePattern = ciSecretEnvNames.join("|");

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
    .replace(/\b(?:npm|pnpm)_[A-Za-z0-9_-]{12,}/g, "[redacted]")
    .replace(/\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]+/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "[redacted-jwt]")
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/g, "$1[redacted]@");
}

export function sanitizeCiError(error, options = {}) {
  return redactCiText(error?.message || String(error), options);
}

export function createGitHubActionsClient({
  fetchImpl = fetch,
  repo = defaultRepo,
  token = null,
} = {}) {
  const [owner, repoName] = parseRepo(repo);
  const authToken = typeof token === "string" ? token.trim() : "";
  if (!authToken) {
    throw createCiDoctorAuthError("GitHub Actions inspection refused before network access.");
  }

  async function request(path, { accept = "application/vnd.github+json", responseType = "json" } = {}) {
    assertReadOnlyGitHubPath(path);

    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repoName}${path}`, {
      headers: {
        Accept: accept,
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "tanchiki-ci-doctor",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      if (isGitHubAuthOrRateLimitFailure(response, body)) {
        throw createCiDoctorAuthError(`GitHub API GET ${path} failed with HTTP ${response.status}.`);
      }
      throw new CiDoctorError(
        "github-read-failed",
        `GitHub API GET ${path} failed with HTTP ${response.status}: ${body}`,
      );
    }

    return responseType === "text" ? response.text() : response.json();
  }

  return {
    getPullRequest(pr) {
      return request(`/pulls/${normalizeNumericId(pr, "PR number")}`);
    },
    getCheckRuns(sha) {
      const safeSha = requireText(sha, "PR head SHA");
      return request(`/commits/${encodeURIComponent(safeSha)}/check-runs?per_page=100`);
    },
    getCommitStatus(sha) {
      const safeSha = requireText(sha, "PR head SHA");
      return request(`/commits/${encodeURIComponent(safeSha)}/status`);
    },
    getWorkflowRun(runId) {
      return request(`/actions/runs/${normalizeNumericId(runId, "workflow run ID")}`);
    },
    getJobsForRun(runId) {
      return request(`/actions/runs/${normalizeNumericId(runId, "workflow run ID")}/jobs?per_page=100`);
    },
    getJobLogs(jobId) {
      return request(`/actions/jobs/${normalizeNumericId(jobId, "job ID")}/logs`, {
        accept: "application/vnd.github+json",
        responseType: "text",
      });
    },
    getCheckRunAnnotations(checkRunId) {
      return request(`/check-runs/${normalizeNumericId(checkRunId, "check run ID")}/annotations?per_page=100`);
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
      case "--check-name":
        options.checkName = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--fixture":
        options.fixturePath = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--head-sha":
        options.headSha = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--job-id":
        options.jobId = readArgValue(argv, index, arg);
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
      case "--run-id":
        options.runId = readArgValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new CiDoctorError("invalid-argument", `Unknown argument: ${arg}`);
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
    const result = await runCiDoctor({ env, fetchImpl, fixture, options });
    const output = options.json
      ? JSON.stringify(result.handoff, null, 2)
      : formatRepairHandoff(result.handoff);
    stdout(redactCiText(output, { env }));
    return { ok: true, result };
  } catch (error) {
    stderr(`CI Doctor failed: ${sanitizeCiError(error, { env })}`);
    return { ok: false, error };
  }
}

async function collectLiveFailureSource({ client = null, env = {}, fetchImpl = fetch, options = {} } = {}) {
  validateRepo(options.repo || defaultRepo);
  const missingAuth = getMissingAuthChannels(env, [githubAuthChannel]);
  if (missingAuth.length > 0) {
    throw createCiDoctorAuthError(
      `Missing GitHub auth for live CI inspection: ${formatMissingAuthChannels(missingAuth)}.`,
    );
  }
  const prNumber = normalizeNumericId(options.pr, "PR number");
  const authToken = readFirstEnv(env, githubAuthChannel.envNames);
  const githubClient = client || createGitHubActionsClient({
    fetchImpl,
    repo: options.repo || defaultRepo,
    token: authToken,
  });
  const pull = await githubClient.getPullRequest(prNumber);
  const headSha = requireText(options.headSha || pull?.head?.sha, "PR head SHA");
  const checkRunsPayload = await githubClient.getCheckRuns(headSha);
  const failedCheckRun = selectFailedCheckRun(checkRunsPayload.check_runs || [], {
    checkName: options.checkName,
    headSha,
  });
  const ids = extractActionsIds(failedCheckRun);
  const runId = options.runId || failedCheckRun.run_id || ids.runId;
  if (!runId) {
    throw new CiDoctorError(
      "missing-run-identity",
      "Failed check run does not expose a GitHub Actions run ID; refusing to inspect ambiguous logs.",
    );
  }

  const [run, jobsPayload, annotations] = await Promise.all([
    githubClient.getWorkflowRun(runId),
    githubClient.getJobsForRun(runId),
    githubClient.getCheckRunAnnotations?.(failedCheckRun.id).catch(() => []),
  ]);
  const failedJob = selectFailedJob(jobsPayload.jobs || [], {
    jobId: options.jobId || ids.jobId,
  });
  const logs = await githubClient.getJobLogs(failedJob.id);

  return normalizeFailureSource({
    annotations,
    checkRun: failedCheckRun,
    job: { ...failedJob, logs },
    logs,
    logSource: "github-actions-job-log",
    pr: {
      number: pull.number || prNumber,
      url: pull.html_url || null,
    },
    headSha,
    repo: options.repo || defaultRepo,
    run,
    workflow: {
      id: run.workflow_id || null,
      name: run.name || failedCheckRun.name || null,
    },
  }, {
    mode: "live",
    repo: options.repo || defaultRepo,
  });
}

function normalizeFailureSource(source = {}, { mode = "fixture", options = {}, repo = defaultRepo } = {}) {
  const validatedRepo = validateRepo(source.repo || repo);
  const pr = normalizePr(source.pr || {
    number: source.prNumber || options.pr,
    url: source.prUrl || null,
  });
  const headSha = source.headSha
    || source.head_sha
    || source.pr?.headSha
    || source.pr?.head?.sha
    || source.checkRun?.head_sha
    || source.checkRun?.headSha
    || options.headSha
    || null;
  const checkRun = normalizeCheckRun(source.checkRun || source.check || {});
  const run = normalizeRun(source.run || source.workflowRun || {});
  const rawJob = source.job || source.failedJob || {};
  const job = normalizeJob(rawJob);
  const annotations = Array.isArray(source.annotations) ? source.annotations : [];
  const logs = collectStringValues([
    source.logs,
    source.stdout,
    source.stderr,
    rawJob.logs,
    rawJob.stdout,
    rawJob.stderr,
    source.error?.message,
  ]);
  const failedStep = normalizeStep(source.failedStep || findFirstFailedStep(job.steps) || {});

  return {
    annotations,
    checkRun,
    failedStep,
    headSha,
    job: {
      ...job,
      logs: logs.join("\n"),
    },
    logSource: source.logSource || (mode === "live" ? "github-actions-job-log" : "fixture"),
    pr,
    repo: validatedRepo,
    run,
    workflow: normalizeWorkflow(source.workflow || run.workflow || {}),
  };
}

function normalizePr(pr = {}) {
  if (typeof pr === "number") {
    return { number: pr, url: null };
  }

  return {
    number: pr.number || null,
    url: pr.url || pr.html_url || null,
  };
}

function normalizeCheckRun(checkRun = {}) {
  return {
    conclusion: checkRun.conclusion || null,
    details_url: checkRun.details_url || checkRun.detailsUrl || null,
    head_sha: checkRun.head_sha || checkRun.headSha || null,
    id: checkRun.id || null,
    name: checkRun.name || null,
    run_id: checkRun.run_id || checkRun.runId || null,
    status: checkRun.status || null,
  };
}

function normalizeRun(run = {}) {
  return {
    conclusion: run.conclusion || null,
    id: run.id || run.run_id || run.runId || null,
    name: run.name || run.display_title || null,
    status: run.status || null,
    workflow_id: run.workflow_id || run.workflowId || null,
  };
}

function normalizeWorkflow(workflow = {}) {
  return {
    id: workflow.id || workflow.workflow_id || null,
    name: workflow.name || null,
  };
}

function normalizeJob(job = {}) {
  const steps = Array.isArray(job.steps) ? job.steps.map(normalizeStep) : [];
  return {
    conclusion: job.conclusion || null,
    id: job.id || null,
    name: job.name || null,
    status: job.status || null,
    steps,
  };
}

function publicJobMetadata(job = {}) {
  return {
    conclusion: job.conclusion || null,
    id: job.id || null,
    name: job.name || null,
    status: job.status || null,
    steps: job.steps || [],
  };
}

function normalizeStep(step = {}) {
  return {
    command: step.command || step.run || null,
    conclusion: step.conclusion || step.outcome || null,
    name: step.name || null,
    number: step.number || step.stepNumber || null,
  };
}

function findFirstFailedStep(steps = []) {
  return steps.find((step) => safeConclusionFailures.has(step.conclusion));
}

function collectLogText(source) {
  return collectStringValues([
    source.checkRun?.output?.summary,
    source.checkRun?.output?.text,
    source.job?.logs,
    source.annotations?.map((annotation) => annotation.message).join("\n"),
  ]).join("\n");
}

function collectEvidenceSnippets({ annotations = [], env = {}, failedStep = {}, logText = "" } = {}) {
  const lines = [];
  if (failedStep.name) {
    lines.push(`failed step: ${failedStep.name}`);
  }
  if (failedStep.command) {
    lines.push(`failed command: ${failedStep.command}`);
  }
  for (const annotation of annotations) {
    if (annotation.message) {
      lines.push(annotation.path ? `${annotation.path}: ${annotation.message}` : annotation.message);
    }
  }
  for (const line of String(logText).split(/\r?\n/)) {
    if (isEvidenceLine(line)) {
      lines.push(line);
    }
  }

  const snippets = [];
  const seen = new Set();
  for (const line of lines) {
    const snippet = sanitizeEvidenceSnippet(line, { env });
    if (!snippet || seen.has(snippet)) {
      continue;
    }
    seen.add(snippet);
    snippets.push(snippet);
    if (snippets.length >= maxEvidenceSnippets) {
      break;
    }
  }
  return snippets;
}

function sanitizeEvidenceSnippet(value, options = {}) {
  const redacted = redactCiText(value, options).replace(/\s+/g, " ").trim();
  if (!redacted) {
    return "";
  }
  if (unsafeOutputPatterns.some((pattern) => pattern.test(redacted))) {
    return "[omitted unsafe instruction from CI output]";
  }
  return redacted.length > maxEvidenceLineChars
    ? `${redacted.slice(0, maxEvidenceLineChars - 3)}...`
    : redacted;
}

function isEvidenceLine(line) {
  return matchesAny(String(line), [
    /\bassertionerror\b/i,
    /\berr_assertion\b/i,
    /\berror:/i,
    /\bfailed\b/i,
    /\bhttp (?:401|403|429)\b/i,
    /\bnot ok\b/i,
    /\bnpm err!/i,
    /\brate limit\b/i,
    /\bsyntaxerror\b/i,
    /\btimed out\b/i,
  ]);
}

function classificationResult(type, confidence) {
  const metadata = {
    "auth-rate-limit-failure": {
      minimalRepairInstruction:
        "Confirm the CI Doctor GitHub read token, rate limit state, and failed-check identity; do not change repository settings or validation.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to GitHub authentication, permission, or API rate-limit failure.",
      suspectedRepairArea: "process-scoped GitHub auth or API access diagnostics",
    },
    "build-syntax-failure": {
      minimalRepairInstruction:
        "Fix the syntax or module error named by the failed build evidence, then rerun the full required validation set.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to a build/static syntax failure.",
      suspectedRepairArea: "file or module named by the build evidence",
    },
    "dependency-environment-failure": {
      minimalRepairInstruction:
        "Inspect the install or runner environment failure and prepare a narrow fix; dependency or workflow changes require explicit approval.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to install, registry, runner, or environment setup failure.",
      suspectedRepairArea: "dependency installation or CI runner environment",
    },
    "lint-static-failure": {
      minimalRepairInstruction:
        "Fix the static-check finding named by the lint evidence, then rerun the full required validation set.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to lint or static-check failure.",
      suspectedRepairArea: "file or static-check target named by the lint evidence",
    },
    "pr-metadata-failure": {
      minimalRepairInstruction:
        "Repair the PR body metadata so it matches the required template and preserves the full validation evidence.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to required PR metadata or template validation.",
      suspectedRepairArea: "PR body metadata",
    },
    "test-failure": {
      minimalRepairInstruction:
        "Fix the failing test or implementation path named by the evidence, then rerun the full required validation set.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to an automated test failure.",
      suspectedRepairArea: "test or implementation path named by the failure evidence",
    },
    "timeout-flake": {
      minimalRepairInstruction:
        "Investigate the timed-out or cancelled job with the same validation requirements intact; do not treat it as passing.",
      recommendedNextRole: "Coder",
      rationale: "The evidence points to timeout, cancellation, or runner instability.",
      suspectedRepairArea: "job timeout or runner stability",
    },
    "unknown-ci-failure": {
      minimalRepairInstruction:
        "Inspect the bounded evidence manually and produce a narrower repair issue before changing validation or workflow behavior.",
      recommendedNextRole: "Coder",
      rationale: "The available evidence was insufficient for a precise classification.",
      suspectedRepairArea: "unknown CI failure area",
    },
  };
  return {
    type,
    confidence,
    ...metadata[type],
  };
}

function selectFailedCheckRun(checkRuns = [], { checkName = null, headSha = null } = {}) {
  const failed = checkRuns.filter((checkRun) => {
    if (headSha && checkRun.head_sha && checkRun.head_sha !== headSha) {
      throw new CiDoctorError(
        "stale-check-run",
        `Check run ${checkRun.name || checkRun.id || "unknown"} is not tied to the PR head SHA.`,
      );
    }
    return checkRun.status === "completed" && safeConclusionFailures.has(checkRun.conclusion);
  });

  const candidates = checkName
    ? failed.filter((checkRun) => checkRun.name === checkName || String(checkRun.id) === String(checkName))
    : failed;

  if (candidates.length === 0) {
    throw new CiDoctorError("missing-failed-check", "No failed completed check run was available for CI Doctor inspection.");
  }
  if (candidates.length > 1) {
    throw new CiDoctorError(
      "ambiguous-failed-check",
      "Multiple failed check runs are present; provide --check-name or --run-id before inspecting logs.",
    );
  }
  return candidates[0];
}

function selectFailedJob(jobs = [], { jobId = null } = {}) {
  const failed = jobs.filter((job) => job.status === "completed" && safeConclusionFailures.has(job.conclusion));
  const candidates = jobId
    ? failed.filter((job) => String(job.id) === String(jobId) || job.name === jobId)
    : failed;

  if (candidates.length === 0) {
    throw new CiDoctorError("missing-failed-job", "No failed completed GitHub Actions job was available for CI Doctor inspection.");
  }
  if (candidates.length > 1) {
    throw new CiDoctorError(
      "ambiguous-failed-job",
      "Multiple failed jobs are present; provide --job-id before inspecting logs.",
    );
  }
  return candidates[0];
}

function extractActionsIds(checkRun = {}) {
  const detailsUrl = checkRun.details_url || checkRun.detailsUrl || "";
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)(?:\/job\/(\d+))?/);
  return {
    jobId: match?.[2] || null,
    runId: match?.[1] || null,
  };
}

function parseRepo(value) {
  return validateRepo(value).split("/");
}

function validateRepo(value) {
  const repo = String(value || "").trim();
  if (repo !== defaultRepo) {
    throw new CiDoctorError(
      "wrong-repo",
      `CI Doctor is scoped to ${defaultRepo}; refusing to inspect ${repo || "unknown"}.`,
    );
  }
  return repo;
}

function normalizeNumericId(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new CiDoctorError("missing-identity", `${label} is required and must be numeric.`);
  }
  return text;
}

function requireText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new CiDoctorError("missing-identity", `${label} is required.`);
  }
  return text;
}

function readArgValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CiDoctorError("invalid-argument", `${name} requires a value.`);
  }
  return value;
}

function assertReadOnlyGitHubPath(path) {
  if (!readOnlyGitHubPathPatterns.some((pattern) => pattern.test(path))) {
    throw new CiDoctorError("unsafe-github-endpoint", `Refusing non-read or out-of-scope GitHub endpoint: ${path}`);
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

function createCiDoctorAuthError(message) {
  const error = new CiDoctorError("missing-or-invalid-github-auth", message);
  error.ciDoctorAuthError = true;
  return error;
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function collectStringValues(values = []) {
  return values
    .flat()
    .filter((value) => typeof value === "string" && value.trim());
}

function inferCommand(logText) {
  const commandMatch = String(logText).match(/\b(?:npm test|npm run build|npm run lint|npm ci|node --test|node --check[^\r\n]*)/);
  return commandMatch?.[0] || null;
}

function buildResidualRisk(source, evidenceSnippets) {
  const risks = [];
  if (!source.headSha) {
    risks.push("PR head SHA was unavailable in the source evidence.");
  }
  if (!source.run?.id) {
    risks.push("workflow run identity was unavailable");
  }
  if (!source.job?.id) {
    risks.push("job identity was unavailable");
  }
  if (evidenceSnippets.length === 0) {
    risks.push("no bounded evidence snippet was available");
  }
  return risks.length > 0
    ? risks.join("; ")
    : "bounded log evidence was available; raw logs were not retained or printed";
}

function formatBullets(values, emptyMessage) {
  if (!values || values.length === 0) {
    return [`- ${emptyMessage}`];
  }
  return values.map((value) => `- ${value}`);
}

function isSecretLikeEnvName(name) {
  return /(?:AUTH|KEY|PASSWORD|PRIVATE|SECRET|TOKEN)/i.test(name);
}

function usageText() {
  return [
    "Usage:",
    "  node scripts/ci-doctor.js --fixture path/to/fixture.json [--json]",
    "  node scripts/ci-doctor.js --repo urkrass/Tanchiki --pr 123 [--check-name name] [--run-id id] [--job-id id] [--json]",
    "",
    "CI Doctor is read-only. Live mode requires GH_TOKEN or GITHUB_TOKEN and refuses wrong-repo or ambiguous failed-job inputs.",
  ].join("\n");
}

export class CiDoctorError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "CiDoctorError";
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
