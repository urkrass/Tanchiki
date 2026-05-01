import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReviewerAppInstallationToken,
  readReviewerAppEnvironment,
  validatePrivateKeyPath,
} from "./reviewer-app-token.js";
import {
  EvidenceError,
  collectPrEvidence,
  defaultMaxDiffChars,
  defaultRepo,
  validateMaxDiffChars,
} from "./reviewer-evidence.js";
import {
  createGitHubClient,
  evaluateReviewGates,
  getReviewBodyRefusalReason,
  inspectPullRequest,
} from "./reviewer-review-pr.js";

export const defaultOpenAiModel = "gpt-5.5";
export const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

const reviewBodyMaxChars = 12000;
const decisionValues = new Set([
  "APPROVED_FOR_MERGE",
  "CHANGES_REQUESTED",
  "HUMAN_REVIEW_REQUIRED",
  "BLOCKED",
]);
const confidenceValues = new Set(["low", "medium", "high"]);
const severityValues = new Set(["blocking", "warning", "note"]);
const policyStopLabels = new Set([
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "blocked",
  "human-only",
  "risk:human-only",
]);
const checkKeys = [
  "pr_state_ok",
  "metadata_ok",
  "checks_ok",
  "scope_ok",
  "forbidden_files_ok",
  "review_cadence_ok",
];

export const reviewerDecisionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "confidence", "summary", "findings", "checks", "review_body_markdown"],
  properties: {
    decision: {
      type: "string",
      enum: [...decisionValues],
    },
    confidence: {
      type: "string",
      enum: [...confidenceValues],
    },
    summary: {
      type: "string",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "file", "message"],
        properties: {
          severity: {
            type: "string",
            enum: [...severityValues],
          },
          file: {
            type: ["string", "null"],
          },
          message: {
            type: "string",
          },
        },
      },
    },
    checks: {
      type: "object",
      additionalProperties: false,
      required: checkKeys,
      properties: Object.fromEntries(checkKeys.map((key) => [key, { type: "boolean" }])),
    },
    review_body_markdown: {
      type: "string",
    },
  },
};

export async function main({
  argv = process.argv.slice(2),
  createTokenImpl = createReviewerAppInstallationToken,
  env = process.env,
  fetchImpl = fetch,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let openAiCallAttempted = false;
  let reviewerAppTokenRequested = false;
  let githubReviewSubmitted = false;

  try {
    const options = parseArgs(argv);
    const evidence = await collectPrEvidence({
      fetchImpl,
      issue: options.issue,
      maxDiffChars: options.maxDiffChars,
      pr: options.pr,
      repo: options.repo,
      token: readGitHubToken(env),
    });

    const preflight = evaluateLocalPreflight(evidence);
    if (preflight.refusal_reasons.length > 0) {
      throw new EvidenceError(
        `Local preflight refused before OpenAI: ${preflight.refusal_reasons.join("; ")}`,
      );
    }

    const apiKey = readOpenAiApiKey(env);
    openAiCallAttempted = true;
    const generated = await callOpenAiReviewer({
      apiKey,
      evidence,
      fetchImpl,
      model: options.model || defaultOpenAiModel,
    });
    const evaluation = evaluateReviewerDecision({
      decision: generated.decision,
      evidence,
    });

    if (evaluation.refusal_reasons.length > 0) {
      throw new EvidenceError(`Generated review refused: ${evaluation.refusal_reasons.join("; ")}`);
    }

    const reviewDecision = mapDecisionToReviewPrDecision(generated.decision);
    const reviewBodyRefusal = getReviewBodyRefusalReason(
      reviewDecision,
      generated.decision.review_body_markdown,
    );
    if (reviewBodyRefusal) {
      throw new EvidenceError(`Generated review body refused: ${reviewBodyRefusal}`);
    }

    let submission = {
      allowed: true,
      blocked_reason: null,
      event: mapDecisionToGithubReviewEvent(generated.decision.decision),
      reviewer_app_token_requested: false,
      submitted: false,
    };

    if (!options.dryRun) {
      reviewerAppTokenRequested = true;
      submission = await submitGeneratedReview({
        body: generated.decision.review_body_markdown,
        createTokenImpl,
        decision: reviewDecision,
        env,
        fetchImpl,
        issue: options.issue,
        pr: options.pr,
        repo: options.repo,
      });
      githubReviewSubmitted = submission.submitted;
    }

    stdout(JSON.stringify({
      mode: "api-backed-reviewer-agent",
      dry_run: options.dryRun,
      requested_model: options.model || defaultOpenAiModel,
      openai_call_made: true,
      github_review_submitted: githubReviewSubmitted,
      mapped_github_event: submission.event,
      reviewer_app_token_requested: reviewerAppTokenRequested,
      submission_allowed: submission.allowed,
      submission_blocked_reason: submission.blocked_reason,
      evidence_summary: summarizeEvidenceForOutput(evidence),
      local_checks: evaluation.local_checks,
      local_gate_refusals: evaluation.refusal_reasons,
      decision: generated.decision,
      openai_usage: generated.usage,
    }, null, 2));
    return 0;
  } catch (error) {
    if (!(error instanceof EvidenceError)) {
      throw error;
    }

    stderr(`Reviewer Agent OpenAI invocation refused: ${error.message}`);
    stderr(
      openAiCallAttempted
        ? "OpenAI API call was attempted, but no valid review was accepted."
        : "No OpenAI API call was made.",
    );
    stderr(
      reviewerAppTokenRequested
        ? "Reviewer App token path was reached, but no accepted review was submitted."
        : "Reviewer App token path was not reached.",
    );
    stderr(githubReviewSubmitted ? "GitHub review was submitted." : "No GitHub review was submitted.");
    return 1;
  }
}

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    issue: null,
    maxDiffChars: defaultMaxDiffChars,
    model: null,
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

    if (!["--pr", "--issue", "--max-diff-chars", "--model", "--repo"].includes(key)) {
      throw new EvidenceError(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined) {
      throw new EvidenceError(`${key} requires a value.`);
    }
    if (inlineValue === null) {
      index += 1;
    }

    if (key === "--pr") {
      options.pr = parsePrNumber(value);
    } else if (key === "--issue") {
      options.issue = parseIssueId(value);
    } else if (key === "--max-diff-chars") {
      options.maxDiffChars = validateMaxDiffChars(value);
    } else if (key === "--model") {
      options.model = parseModel(value);
    } else if (key === "--repo") {
      options.repo = parseRepo(value);
    }
  }

  if (options.pr === null) {
    throw new EvidenceError("--pr is required.");
  }
  if (!options.issue) {
    throw new EvidenceError("--issue is required.");
  }

  return options;
}

export function readGitHubToken(env = process.env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || null;
}

export function readOpenAiApiKey(env = process.env) {
  const apiKey = env.OPENAI_API_KEY;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new EvidenceError(
      "OPENAI_API_KEY is required. Set it in the environment before running reviewer:agent; the key is read from env only and is never written to disk.",
    );
  }
  return apiKey.trim();
}

export async function callOpenAiReviewer({
  apiKey,
  evidence,
  fetchImpl = fetch,
  model = defaultOpenAiModel,
} = {}) {
  if (!apiKey) {
    throw new EvidenceError("OPENAI_API_KEY is required.");
  }

  let response;
  try {
    response = await fetchImpl(openAiResponsesUrl, {
      body: JSON.stringify(createOpenAiRequest({ evidence, model })),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    throw new EvidenceError(`OpenAI API request failed before a response was received: ${error.message}`);
  }

  if (!response.ok) {
    throw new EvidenceError(
      `OpenAI API request failed with HTTP ${response.status}. Check OPENAI_API_KEY and model access.`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new EvidenceError(`OpenAI API response was not valid JSON: ${error.message}`);
  }

  if (payload.status && payload.status !== "completed") {
    throw new EvidenceError(`OpenAI API response status was ${payload.status}, not completed.`);
  }
  if (payload.error?.message) {
    throw new EvidenceError("OpenAI API response contained an error.");
  }

  const outputText = extractOpenAiOutputText(payload);
  const decision = parseReviewerDecisionText(outputText);
  return {
    decision,
    usage: sanitizeOpenAiUsage(payload.usage),
  };
}

export function createOpenAiRequest({ evidence, model = defaultOpenAiModel } = {}) {
  return {
    model,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: buildReviewerPrompt(),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ evidence }, null, 2),
          },
        ],
      },
    ],
    max_output_tokens: 4000,
    reasoning: {
      effort: "medium",
    },
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "tanchiki_reviewer_decision",
        strict: true,
        schema: reviewerDecisionSchema,
      },
    },
  };
}

export function buildReviewerPrompt() {
  return [
    "You are the constrained Tanchiki Reviewer App reviewer agent.",
    "Review only the compact evidence packet supplied by the user. Do not assume access to the whole repo.",
    "Return strict JSON only. Do not include prose outside JSON.",
    "Use the required decision vocabulary exactly: APPROVED_FOR_MERGE, CHANGES_REQUESTED, HUMAN_REVIEW_REQUIRED, or BLOCKED.",
    "For paired-review, verify the PR is open, non-draft, and unmerged.",
    "Verify PR body metadata, required validation evidence, changed-file scope, check status, labels, review cadence, and protected surfaces.",
    "Treat src/game/movement.js as blocked unless the evidence explicitly approves movement work.",
    "Treat CI, workflow, dependency, deployment, GitHub setting, branch protection, and auto-merge behavior changes as blocked unless explicitly scoped.",
    "Never ask to merge, label, remove labels, push, edit files, edit issues, run Dispatcher, run Conductor, run Codex, or mark Linear Done.",
    "Never apply or ask a human to apply merge:auto-eligible unless the evidence explicitly says this is a low-risk auto-merge burn-in lane.",
    "If evidence is missing, ambiguous, contradictory, or unsafe, choose HUMAN_REVIEW_REQUIRED or BLOCKED instead of approval.",
  ].join("\n");
}

export function extractOpenAiOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload?.output || []) {
    if (typeof item?.text === "string") {
      chunks.push(item.text);
    }
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();
  if (!text) {
    throw new EvidenceError("OpenAI API response did not contain output text.");
  }
  return text;
}

export function parseReviewerDecisionText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new EvidenceError(`OpenAI reviewer output was not valid JSON: ${error.message}`);
  }

  return validateReviewerDecision(parsed);
}

export function validateReviewerDecision(value) {
  assertPlainObject(value, "reviewer decision");
  assertAllowedKeys(value, reviewerDecisionSchema.required, "reviewer decision");

  if (!decisionValues.has(value.decision)) {
    throw new EvidenceError(`Reviewer decision is unknown: ${String(value.decision)}`);
  }
  if (!confidenceValues.has(value.confidence)) {
    throw new EvidenceError(`Reviewer confidence is unknown: ${String(value.confidence)}`);
  }
  if (!isNonEmptyString(value.summary)) {
    throw new EvidenceError("Reviewer summary must be a non-empty string.");
  }
  if (!Array.isArray(value.findings)) {
    throw new EvidenceError("Reviewer findings must be an array.");
  }
  for (const [index, finding] of value.findings.entries()) {
    assertPlainObject(finding, `finding ${index}`);
    assertAllowedKeys(finding, ["severity", "file", "message"], `finding ${index}`);
    if (!severityValues.has(finding.severity)) {
      throw new EvidenceError(`Finding ${index} has unknown severity.`);
    }
    if (finding.file !== null && typeof finding.file !== "string") {
      throw new EvidenceError(`Finding ${index} file must be a string or null.`);
    }
    if (!isNonEmptyString(finding.message)) {
      throw new EvidenceError(`Finding ${index} message must be a non-empty string.`);
    }
  }

  assertPlainObject(value.checks, "reviewer checks");
  assertAllowedKeys(value.checks, checkKeys, "reviewer checks");
  for (const key of checkKeys) {
    if (typeof value.checks[key] !== "boolean") {
      throw new EvidenceError(`Reviewer check ${key} must be boolean.`);
    }
  }

  if (!isNonEmptyString(value.review_body_markdown)) {
    throw new EvidenceError("Reviewer review_body_markdown must be a non-empty string.");
  }
  if (value.review_body_markdown.length > reviewBodyMaxChars) {
    throw new EvidenceError(`Reviewer review_body_markdown exceeds ${reviewBodyMaxChars} characters.`);
  }

  return value;
}

export function evaluateReviewerDecision({ decision, evidence }) {
  const localChecks = computeLocalChecks(evidence);
  const refusalReasons = [
    ...findForbiddenModelOutputReasons(decision),
  ];

  if (decision.decision === "APPROVED_FOR_MERGE") {
    for (const [key, passed] of Object.entries(localChecks)) {
      if (!passed) {
        refusalReasons.push(`approval blocked because local gate ${key} failed`);
      }
    }
    for (const [key, passed] of Object.entries(decision.checks)) {
      if (!passed) {
        refusalReasons.push(`approval blocked because model check ${key} was false`);
      }
    }
    for (const reason of findApprovalVetoReasons(evidence)) {
      refusalReasons.push(reason);
    }
  }

  return {
    local_checks: localChecks,
    refusal_reasons: refusalReasons,
  };
}

export function evaluateLocalPreflight(evidence) {
  const localChecks = computeLocalChecks(evidence);
  const refusalReasons = [];

  for (const [key, passed] of Object.entries(localChecks)) {
    if (!passed) {
      refusalReasons.push(`local gate ${key} failed`);
    }
  }
  for (const reason of findApprovalVetoReasons(evidence)) {
    refusalReasons.push(reason);
  }

  return {
    local_checks: localChecks,
    refusal_reasons: refusalReasons,
  };
}

export function computeLocalChecks(evidence) {
  const prState = evidence?.pr?.state || {};
  const metadata = evidence?.pr_metadata || {};

  return {
    pr_state_ok: prState.open === true && prState.draft !== true && prState.merged !== true,
    metadata_ok:
      metadata.required_headings_ok === true
      && metadata.mentions_linked_issue === true
      && metadata.role_type_risk_validation_ok === true,
    checks_ok: evidence?.checks?.state === "passing",
    scope_ok:
      metadata.role_type_risk_validation_ok === true
      && findUnscopedAdministrativeFiles(evidence).length === 0,
    forbidden_files_ok: (evidence?.protected_surfaces?.forbidden_file_findings || []).length === 0,
    review_cadence_ok: evidence?.review_cadence === "paired-review",
  };
}

export function findForbiddenModelOutputReasons(decision) {
  const text = [
    decision.summary,
    decision.review_body_markdown,
    ...(decision.findings || []).map((finding) => `${finding.file || ""} ${finding.message}`),
  ].join("\n");

  const forbiddenPatterns = [
    { pattern: /\bgh\s+pr\s+merge\b/i, reason: "model output requested a gh pr merge command" },
    { pattern: /\bgh\s+pr\s+edit\b/i, reason: "model output requested a gh pr edit command" },
    { pattern: /\bgh\s+issue\s+edit\b/i, reason: "model output requested a gh issue edit command" },
    { pattern: /\bgit\s+push\b/i, reason: "model output requested git push" },
    { pattern: /\bgit\s+commit\b/i, reason: "model output requested git commit" },
    { pattern: /\bmerge:auto-eligible\b/i, reason: "model output attempted merge:auto-eligible" },
    { pattern: /\bremove\s+(?:stop\s+)?labels?\b/i, reason: "model output requested label removal" },
    { pattern: /\bedit\s+files?\b/i, reason: "model output requested file edits" },
    { pattern: /\bchange\s+(?:repo|repository)\s+settings\b/i, reason: "model output requested repository settings changes" },
    { pattern: /\brun\s+(?:the\s+)?dispatcher\b/i, reason: "model output requested Dispatcher" },
    { pattern: /\brun\s+(?:the\s+)?conductor\b/i, reason: "model output requested Conductor" },
    { pattern: /\brun\s+codex\b/i, reason: "model output requested Codex" },
    { pattern: /\bmark\s+(?:the\s+)?(?:linear\s+)?(?:issue\s+)?done\b/i, reason: "model output requested Linear Done" },
    { pattern: /\bapply\s+(?:the\s+)?labels?\b/i, reason: "model output requested label application" },
  ];

  return forbiddenPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ reason }) => reason);
}

export function mapDecisionToGithubReviewEvent(decision) {
  if (decision === "APPROVED_FOR_MERGE") {
    return "APPROVE";
  }
  if (decision === "CHANGES_REQUESTED" || decision === "BLOCKED") {
    return "REQUEST_CHANGES";
  }
  return "COMMENT";
}

export function mapDecisionToReviewPrDecision(decision) {
  const decisionValue = typeof decision === "string" ? decision : decision?.decision;
  if (decisionValue === "APPROVED_FOR_MERGE") {
    return "approve";
  }
  if (decisionValue === "CHANGES_REQUESTED") {
    return "request-changes";
  }
  if (decisionValue === "BLOCKED") {
    return isProcessBlockedDecision(decision) ? "comment" : "request-changes";
  }
  return "comment";
}

export async function submitGeneratedReview({
  body,
  createTokenImpl = createReviewerAppInstallationToken,
  decision,
  env = process.env,
  fetchImpl = fetch,
  issue,
  pr,
  repo = defaultRepo,
} = {}) {
  try {
    const context = readReviewerAppEnvironment(env);
    validatePrivateKeyPath(context.privateKeyPath);
    assertReviewerPrivateKeyOutsideRepo(context.privateKeyPath);

    const token = await createTokenImpl(context, { fetchImpl });
    const client = createGitHubClient({
      fetchImpl,
      repo,
      token: token.token,
    });
    const options = {
      decision,
      issue,
      pr,
      repo,
    };
    const inspection = await inspectPullRequest(options, client);
    const gateResult = evaluateReviewGates({
      body,
      inspection,
      options,
    });

    if (gateResult.refusalReasons.length > 0) {
      throw new EvidenceError(
        `Reviewer App submission gates refused: ${gateResult.refusalReasons.join("; ")}`,
      );
    }

    const event = mapReviewPrDecisionToGithubEvent(decision);
    await client.submitReview(pr, {
      body,
      event,
    });

    return {
      allowed: true,
      blocked_reason: null,
      event,
      reviewer_app_token_requested: true,
      submitted: true,
    };
  } catch (error) {
    if (error instanceof EvidenceError) {
      throw error;
    }
    throw new EvidenceError(`Reviewer App submission failed closed: ${error.message}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(`Reviewer Agent OpenAI invocation failed: ${error.message}`);
      process.exitCode = 1;
    },
  );
}

function parsePrNumber(value) {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) {
    throw new EvidenceError("--pr must be a positive integer.");
  }
  return Number.parseInt(text, 10);
}

function parseIssueId(value) {
  const text = String(value).trim();
  if (!/^MAR-\d+$/.test(text)) {
    throw new EvidenceError("--issue must match MAR-<number>.");
  }
  return text;
}

function parseModel(value) {
  const text = String(value).trim();
  if (!text) {
    throw new EvidenceError("--model must not be empty.");
  }
  return text;
}

function parseRepo(value) {
  const text = String(value).trim();
  if (text !== defaultRepo) {
    throw new EvidenceError(`--repo must be ${defaultRepo} for this campaign.`);
  }
  return text;
}

function mapReviewPrDecisionToGithubEvent(decision) {
  if (decision === "approve") {
    return "APPROVE";
  }
  if (decision === "request-changes") {
    return "REQUEST_CHANGES";
  }
  return "COMMENT";
}

function isProcessBlockedDecision(decision) {
  if (!decision || typeof decision !== "object") {
    return false;
  }

  const findings = Array.isArray(decision.findings) ? decision.findings : [];
  if (findings.some((finding) => finding.file)) {
    return false;
  }

  const text = [
    decision.summary,
    decision.review_body_markdown,
    ...findings.map((finding) => finding.message),
  ].join("\n");

  return /\b(process|tooling|offline|environment|credential|manual|human|independence)\b/i.test(text);
}

function assertReviewerPrivateKeyOutsideRepo(privateKeyPath) {
  const resolvedPrivateKeyPath = resolve(privateKeyPath);
  const relativePath = relative(repoRoot, resolvedPrivateKeyPath);
  const insideRepo = (
    relativePath !== ""
    && !relativePath.startsWith("..")
    && !isAbsolute(relativePath)
  );

  if (insideRepo) {
    throw new EvidenceError(
      "GITHUB_REVIEWER_PRIVATE_KEY_PATH resolves inside this repository checkout.",
    );
  }
}

function summarizeEvidenceForOutput(evidence) {
  return {
    pr: {
      number: evidence.pr.number,
      url: evidence.pr.url,
      state: evidence.pr.state,
    },
    issue: evidence.linked_issue.id,
    files: evidence.changed_files.count,
    checks: evidence.checks.state,
    diff_truncated: evidence.diff.truncated,
    diff_chars_included: evidence.diff.chars_included,
    max_diff_chars: evidence.diff.max_diff_chars,
  };
}

function sanitizeOpenAiUsage(usage = null) {
  if (!usage || typeof usage !== "object") {
    return null;
  }

  return {
    input_tokens: numberOrNull(usage.input_tokens),
    output_tokens: numberOrNull(usage.output_tokens),
    total_tokens: numberOrNull(usage.total_tokens),
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EvidenceError(`${label} must be an object.`);
  }
}

function assertAllowedKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new EvidenceError(`${label} contains unknown key ${key}.`);
    }
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) {
      throw new EvidenceError(`${label} is missing required key ${key}.`);
    }
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function findApprovalVetoReasons(evidence) {
  const reasons = [];
  const labels = (evidence?.labels?.names || []).map((label) => label.toLowerCase());

  if (labels.some((label) => policyStopLabels.has(label) || label.startsWith("stop:"))) {
    reasons.push("approval blocked because a stop or blocked label is present");
  }
  if (evidence?.role_type_risk_validation?.risk === "risk:human-only") {
    reasons.push("approval blocked because issue risk requires human review");
  }
  if (humanOnlyTypes.has(evidence?.role_type_risk_validation?.type)) {
    reasons.push("approval blocked because issue type requires human review");
  }

  return reasons;
}

const humanOnlyTypes = new Set([
  "type:movement",
  "type:deployment",
  "type:dependency",
  "type:ci",
  "type:security",
]);

function findUnscopedAdministrativeFiles(evidence) {
  const files = evidence?.changed_files?.files || [];
  return files
    .map((file) => file.filename)
    .filter((filename) => [
      /^\.github\//i,
      /^package-lock\.json$/i,
      /^pnpm-lock\.yaml$/i,
      /^yarn\.lock$/i,
      /^netlify\.toml$/i,
      /^vercel\.json$/i,
      /^Dockerfile$/i,
      /^docker-compose\.ya?ml$/i,
    ].some((pattern) => pattern.test(filename)));
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
