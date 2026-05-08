const defaultRepo = "urkrass/Tanchiki";
const activeLinearProject = "Tanchiki — Playable Tank RPG Prototype";
const reviewCadence = "paired-review";
const defaultMaxDiffChars = 60000;
const minMaxDiffChars = 2000;
const maxMaxDiffChars = 200000;
const gitHubEvidenceAuthGuidance = [
  "GitHub evidence collection requires normal read-only GitHub auth through GH_TOKEN or GITHUB_TOKEN.",
  "Set it before running reviewer:agent, for example: $env:GH_TOKEN = gh auth token",
  "This token is only for read-only PR evidence collection.",
  "It is not the Reviewer App submission token; live reviewer:agent creates the Reviewer App token internally only after local preflight, OpenAI output validation, and review-body validation pass.",
].join(" ");

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

const metadataSectionHeading = "## Role / Type / Risk / Validation";
const metadataFieldDefinitions = {
  role: {
    aliases: new Map([
      ["architect", "architect"],
      ["coder", "coder"],
      ["test", "test"],
      ["tester", "test"],
      ["reviewer", "reviewer"],
      ["release", "release"],
    ]),
    canonicalSuffixes: new Set(["architect", "coder", "test", "reviewer", "release"]),
    fieldName: "Role",
    prefix: "role:",
  },
  type: {
    aliases: identityAliasMap(["architecture", "docs", "gameplay", "harness", "movement", "progression", "test", "ui"]),
    canonicalSuffixes: new Set(["architecture", "docs", "gameplay", "harness", "movement", "progression", "test", "ui"]),
    fieldName: "Type",
    prefix: "type:",
  },
  risk: {
    aliases: identityAliasMap(["low", "medium", "high", "human-only"]),
    canonicalSuffixes: new Set(["low", "medium", "high", "human-only"]),
    fieldName: "Risk",
    prefix: "risk:",
  },
  validation: {
    aliases: identityAliasMap(["docs", "gameplay", "harness", "movement", "progression", "test", "ui"]),
    canonicalSuffixes: new Set(["docs", "gameplay", "harness", "movement", "progression", "test", "ui"]),
    fieldName: "Validation profile",
    prefix: "validation:",
  },
};

const forbiddenFileMatchers = [
  { pattern: /(^|\/)\.env($|\.)/i, reason: "local env file" },
  { pattern: /\.pem$/i, reason: "private key file" },
  { pattern: /reviewer-env\.ps1$/i, reason: "local reviewer env file" },
  { pattern: /^\.github\/workflows\//i, reason: "GitHub workflow file" },
  { pattern: /^src\/game\/movement\.js$/i, reason: "protected movement core" },
];

const policySnippets = {
  pr_acceptance: [
    "Paired-review PRs must be open, non-draft, unmerged, and have required checks and metadata ready before reviewer approval.",
    "Coder and Test agents must not approve, label as accepted, or merge their own PRs.",
    "Stop labels and human-gate labels are hard vetoes for acceptance and auto-merge lanes.",
  ],
  reviewer_app_authority: [
    "Reviewer App identity is limited to PR inspection, PR comments, and PR review submission.",
    "Reviewer App credentials must not merge, label, push, edit issues, remove stop labels, change workflows, change settings, or mark Linear Done.",
  ],
  context_economy: [
    "Do not send or collect the whole repo by default.",
    "Record a broad-scan reason whenever additional repo context is included.",
  ],
  validation: [
    "validation:harness requires npm test, npm run build, npm run lint, and git diff --check.",
    "Harness changes must not alter gameplay, movement, rendering, progression, deployment, dependencies, CI workflows, repository settings, or auto-merge behavior unless explicitly scoped.",
  ],
};

export {
  activeLinearProject,
  defaultMaxDiffChars,
  defaultRepo,
  forbiddenFileMatchers,
  gitHubEvidenceAuthGuidance,
  maxMaxDiffChars,
  minMaxDiffChars,
  policySnippets,
  requiredPrBodyHeadings,
  reviewCadence,
};

export async function collectPrEvidence({
  client,
  fetchImpl = fetch,
  issue,
  maxDiffChars = defaultMaxDiffChars,
  pr,
  repo = defaultRepo,
  token = null,
} = {}) {
  if (!client) {
    client = createGitHubEvidenceClient({ fetchImpl, repo, token });
  }

  const pullRequest = await client.getPullRequest(pr);
  const [githubIssue, files, diff, checks] = await Promise.all([
    client.getIssue(pr),
    client.listPullRequestFiles(pr),
    client.getPullRequestDiff(pr),
    client.getChecks(pullRequest.head?.sha).catch((error) => {
      if (error.githubEvidenceAuthError) {
        throw error;
      }
      return {
        checkRuns: [],
        status: { statuses: [] },
        unavailableReason: error.message,
      };
    }),
  ]);

  const trimmedDiff = trimDiff(diff, maxDiffChars);
  const normalizedFiles = files.map(normalizeChangedFile);
  const prBody = pullRequest.body || "";
  const metadata = summarizePrMetadata(prBody, issue);

  return {
    schema_version: "tanchiki.reviewer_agent.evidence.v1",
    repo,
    active_linear_project: activeLinearProject,
    review_cadence: reviewCadence,
    linked_issue: {
      id: issue,
      summary_available: false,
      unavailable_reason:
        "Linear summary lookup is not part of the evidence-only CLI path; issue id and PR metadata are included.",
    },
    pr: {
      number: pullRequest.number ?? pr,
      url: pullRequest.html_url || null,
      title: pullRequest.title || "",
      body: prBody,
      base_branch: pullRequest.base?.ref || null,
      head_branch: pullRequest.head?.ref || null,
      head_sha: pullRequest.head?.sha || null,
      state: {
        value: pullRequest.state || "unknown",
        open: pullRequest.state === "open",
        draft: pullRequest.draft === true,
        merged: pullRequest.merged === true || Boolean(pullRequest.merged_at),
      },
    },
    changed_files: {
      count: normalizedFiles.length,
      files: normalizedFiles,
    },
    diff: {
      text: trimmedDiff.text,
      truncated: trimmedDiff.truncated,
      chars_original: trimmedDiff.chars_original,
      chars_included: trimmedDiff.chars_included,
      max_diff_chars: maxDiffChars,
    },
    checks: summarizeChecks(checks),
    labels: {
      names: normalizeLabels(githubIssue.labels),
    },
    pr_metadata: metadata,
    role_type_risk_validation: {
      role: metadata.role,
      type: metadata.type,
      risk: metadata.risk,
      validation: metadata.validation,
    },
    policy_snippets: policySnippets,
    protected_surfaces: {
      forbidden_files: forbiddenFileMatchers.map((matcher) => ({
        pattern: matcher.pattern.source,
        reason: matcher.reason,
      })),
      forbidden_file_findings: findForbiddenFiles(normalizedFiles),
      protected_files: ["src/game/movement.js"],
    },
    broad_scan: {
      included: false,
      reason: null,
    },
    safety: {
      openai_call_made: false,
      github_review_submitted: false,
      reviewer_app_token_requested: false,
      secrets_printed: false,
    },
  };
}

export function createGitHubEvidenceClient({ fetchImpl = fetch, repo = defaultRepo, token = null } = {}) {
  const [owner, repoName] = parseRepo(repo);
  const authToken = typeof token === "string" ? token.trim() : "";
  if (!authToken) {
    throw createGitHubEvidenceAuthError("GitHub evidence collection refused before network access.");
  }

  async function request(path, { accept = "application/vnd.github+json", responseType = "json" } = {}) {
    const headers = {
      Accept: accept,
      Authorization: `Bearer ${authToken}`,
      "User-Agent": "tanchiki-reviewer-agent-evidence",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repoName}${path}`, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text();
      if (isGitHubEvidenceAuthFailure(response, body)) {
        throw createGitHubEvidenceAuthError(
          `GitHub API GET ${path} failed with HTTP ${response.status}.`,
        );
      }
      throw new EvidenceError(`GitHub API GET ${path} failed with ${response.status}: ${body}`);
    }

    return responseType === "text" ? response.text() : response.json();
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
      throw new EvidenceError("PR changed-file list is too large to inspect safely.");
    },
    getPullRequestDiff(pr) {
      return request(`/pulls/${pr}`, {
        accept: "application/vnd.github.v3.diff",
        responseType: "text",
      });
    },
    async getChecks(sha) {
      if (!sha) {
        throw new EvidenceError("PR head SHA is unavailable.");
      }
      const [checkRuns, status] = await Promise.all([
        request(`/commits/${sha}/check-runs?per_page=100`),
        request(`/commits/${sha}/status`),
      ]);
      return {
        checkRuns: checkRuns.check_runs || [],
        status,
      };
    },
  };
}

export function summarizePrMetadata(prBody, issue) {
  const missing_headings = requiredPrBodyHeadings.filter((heading) => !prBody.includes(heading));
  const metadata = parsePrRoleTypeRiskValidation(prBody);

  return {
    mentions_linked_issue: prBody.includes(issue),
    required_headings_ok: missing_headings.length === 0,
    missing_headings,
    metadata_section_found: metadata.sectionFound,
    role: metadata.role,
    type: metadata.type,
    risk: metadata.risk,
    validation: metadata.validation,
    role_type_risk_validation_ok: metadata.ok,
    role_type_risk_validation_findings: metadata.findings,
    validation_evidence: {
      tests_run: extractSection(prBody, "## Tests Run"),
      manual_qa: extractSection(prBody, "## Manual QA"),
      broad_scan_reason: extractSection(prBody, "## Broad Scan Reason"),
      conflict_risk: extractSection(prBody, "## Conflict Risk"),
      visible_ui_expectation: extractSection(prBody, "## Visible UI Expectation"),
      known_limitations: extractSection(prBody, "## Known Limitations"),
    },
  };
}

export function parsePrRoleTypeRiskValidation(prBody) {
  const section = extractMetadataSection(prBody);
  const findings = [];
  const values = {
    risk: null,
    role: null,
    type: null,
    validation: null,
  };

  if (!section.found) {
    return {
      ...values,
      findings: [`missing required metadata section: ${metadataSectionHeading}`],
      ok: false,
      sectionFound: false,
    };
  }

  const entries = collectMetadataEntries(section.body);
  for (const [field, definition] of Object.entries(metadataFieldDefinitions)) {
    const fieldEntries = entries[field] || [];
    if (fieldEntries.length === 0) {
      findings.push(`missing required metadata field: ${definition.fieldName}`);
      continue;
    }
    if (fieldEntries.length > 1) {
      findings.push(`duplicate metadata field: ${definition.fieldName}`);
      continue;
    }

    const normalized = normalizeMetadataValue(fieldEntries[0].value, definition);
    if (normalized.finding) {
      findings.push(normalized.finding);
      continue;
    }
    values[field] = normalized.value;
  }

  return {
    ...values,
    findings,
    ok: findings.length === 0 && Object.values(values).every(Boolean),
    sectionFound: true,
  };
}

export function summarizeChecks(checks = {}) {
  const checkRuns = checks.checkRuns || [];
  const latestCheckRuns = latestCheckRunsByIdentity(checkRuns);
  const status = checks.status || {};
  const statuses = status.statuses || [];
  const findings = [];

  if (checks.unavailableReason) {
    return {
      state: "unavailable",
      unavailable_reason: checks.unavailableReason,
      check_run_count: checkRuns.length,
      commit_status_count: statuses.length,
      check_runs: [],
      commit_statuses: [],
      findings: [`Check status could not be read: ${checks.unavailableReason}`],
    };
  }

  for (const checkRun of latestCheckRuns) {
    if (checkRun.status !== "completed") {
      findings.push(`Check run ${checkRun.name} is ${checkRun.status}.`);
    } else if (checkRun.conclusion !== "success") {
      findings.push(`Check run ${checkRun.name} concluded ${checkRun.conclusion}.`);
    }
  }

  for (const commitStatus of statuses) {
    if (commitStatus.state !== "success") {
      findings.push(`Commit status ${commitStatus.context} is ${commitStatus.state}.`);
    }
  }

  if (statuses.length > 0 && status.state && status.state !== "success") {
    findings.push(`Combined commit status is ${status.state}.`);
  }

  const hasChecks = checkRuns.length > 0 || statuses.length > 0;
  return {
    state: chooseCheckState({ checkRuns: latestCheckRuns, findings, hasChecks, statuses }),
    check_run_count: checkRuns.length,
    evaluated_check_run_count: latestCheckRuns.length,
    commit_status_count: statuses.length,
    check_runs: latestCheckRuns.map((checkRun) => ({
      name: checkRun.name,
      status: checkRun.status,
      conclusion: checkRun.conclusion || null,
    })),
    commit_statuses: statuses.map((commitStatus) => ({
      context: commitStatus.context,
      state: commitStatus.state,
    })),
    findings,
  };
}

function latestCheckRunsByIdentity(checkRuns) {
  const latestByIdentity = new Map();

  for (const checkRun of checkRuns) {
    const identity = checkRunIdentity(checkRun);
    const previous = latestByIdentity.get(identity);
    if (!previous || compareCheckRunsByRecency(checkRun, previous) > 0) {
      latestByIdentity.set(identity, checkRun);
    }
  }

  return [...latestByIdentity.values()];
}

function checkRunIdentity(checkRun) {
  const name = String(checkRun.name || "unnamed-check").trim() || "unnamed-check";
  const appSlug = String(checkRun.app?.slug || "").trim();
  const appId = checkRun.app?.id == null ? "" : String(checkRun.app.id).trim();

  if (appSlug || appId) {
    return `app:${appSlug || "unknown"}:${appId || "unknown"}:name:${name}`;
  }

  return `name:${name}`;
}

function compareCheckRunsByRecency(left, right) {
  const leftTime = checkRunRecencyTimestamp(left);
  const rightTime = checkRunRecencyTimestamp(right);
  if (leftTime !== null && rightTime !== null && leftTime > rightTime) {
    return 1;
  }
  if (leftTime !== null && rightTime !== null && leftTime < rightTime) {
    return -1;
  }

  const leftId = checkRunIdValue(left);
  const rightId = checkRunIdValue(right);
  if (leftId > rightId) {
    return 1;
  }
  if (leftId < rightId) {
    return -1;
  }

  if (leftTime !== null && rightTime === null) {
    return 1;
  }
  if (leftTime === null && rightTime !== null) {
    return -1;
  }
  return 0;
}

function checkRunRecencyTimestamp(checkRun) {
  for (const field of ["completed_at", "started_at", "updated_at"]) {
    const value = Date.parse(checkRun[field]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function checkRunIdValue(checkRun) {
  if (checkRun.id == null) {
    return 0n;
  }

  const text = String(checkRun.id).trim();
  return /^\d+$/.test(text) ? BigInt(text) : 0n;
}

export function trimDiff(diff, maxDiffChars = defaultMaxDiffChars) {
  const text = String(diff || "");
  if (text.length <= maxDiffChars) {
    return {
      text,
      truncated: false,
      chars_original: text.length,
      chars_included: text.length,
    };
  }

  return {
    text: text.slice(0, maxDiffChars),
    truncated: true,
    chars_original: text.length,
    chars_included: maxDiffChars,
  };
}

export function validateMaxDiffChars(value) {
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    throw new EvidenceError("--max-diff-chars must be a positive integer.");
  }

  const parsed = Number.parseInt(text, 10);
  if (parsed < minMaxDiffChars || parsed > maxMaxDiffChars) {
    throw new EvidenceError(
      `--max-diff-chars must be between ${minMaxDiffChars} and ${maxMaxDiffChars}.`,
    );
  }
  return parsed;
}

export function parseRepo(value) {
  const text = String(value).trim();
  if (text !== defaultRepo) {
    throw new EvidenceError(`--repo must be ${defaultRepo} for this campaign.`);
  }
  return text.split("/");
}

export class EvidenceError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvidenceError";
  }
}

function createGitHubEvidenceAuthError(reason) {
  const error = new EvidenceError(`${reason} ${gitHubEvidenceAuthGuidance}`);
  error.githubEvidenceAuthError = true;
  return error;
}

function isGitHubEvidenceAuthFailure(response, body = "") {
  const remaining = response.headers?.get?.("x-ratelimit-remaining");
  return (
    response.status === 401
    || response.status === 403
    || response.status === 429
    || remaining === "0"
    || /rate limit|bad credentials|requires authentication|resource not accessible/i.test(body)
  );
}

function normalizeChangedFile(file) {
  return {
    filename: normalizePath(file.filename),
    status: file.status || null,
    additions: numberOrZero(file.additions),
    deletions: numberOrZero(file.deletions),
    changes: numberOrZero(file.changes),
    patch_available: typeof file.patch === "string",
  };
}

function normalizeLabels(labels = []) {
  return labels.map((label) => {
    if (typeof label === "string") {
      return label;
    }
    return label.name || "";
  }).filter(Boolean);
}

function findForbiddenFiles(files) {
  const findings = [];
  for (const file of files) {
    for (const matcher of forbiddenFileMatchers) {
      if (matcher.pattern.test(file.filename)) {
        findings.push({
          file: file.filename,
          reason: matcher.reason,
        });
      }
    }
  }
  return findings;
}

function identityAliasMap(values) {
  return new Map(values.map((value) => [value, value]));
}

function extractMetadataSection(body) {
  const start = body.indexOf(metadataSectionHeading);
  if (start === -1) {
    return {
      body: "",
      found: false,
    };
  }

  const contentStart = start + metadataSectionHeading.length;
  const nextHeadingMatch = body.slice(contentStart).match(/\n##\s+/);
  const contentEnd = nextHeadingMatch ? contentStart + nextHeadingMatch.index : body.length;
  return {
    body: body.slice(contentStart, contentEnd),
    found: true,
  };
}

function collectMetadataEntries(sectionBody) {
  const entries = {
    risk: [],
    role: [],
    type: [],
    validation: [],
  };
  const fieldPattern = /^\s*-\s*(Role|Type|Risk|Validation profile)\s*:\s*(.*?)\s*$/i;

  for (const line of String(sectionBody).split(/\r?\n/)) {
    const match = line.match(fieldPattern);
    if (!match) {
      continue;
    }

    const field = normalizeMetadataFieldName(match[1]);
    entries[field].push({
      line,
      value: match[2],
    });
  }

  return entries;
}

function normalizeMetadataFieldName(name) {
  const normalized = String(name).toLowerCase();
  if (normalized === "validation profile") {
    return "validation";
  }
  return normalized;
}

function normalizeMetadataValue(rawValue, definition) {
  const raw = stripOptionalBackticks(rawValue).trim();
  const lower = raw.toLowerCase();
  if (!lower) {
    return {
      finding: `empty metadata value for ${definition.fieldName}`,
    };
  }
  if (/[,/]/.test(lower)) {
    return {
      finding: `ambiguous metadata value for ${definition.fieldName}: ${raw}`,
    };
  }

  if (lower.startsWith(definition.prefix)) {
    const suffix = lower.slice(definition.prefix.length);
    if (definition.canonicalSuffixes.has(suffix)) {
      return {
        value: `${definition.prefix}${suffix}`,
      };
    }
    return {
      finding: `unknown metadata value for ${definition.fieldName}: ${raw}`,
    };
  }

  if (/^[a-z]+:/.test(lower)) {
    return {
      finding: `unknown metadata value for ${definition.fieldName}: ${raw}`,
    };
  }

  const aliasKey = lower.replace(/[\s_]+/g, "-");
  const suffix = definition.aliases.get(aliasKey);
  if (suffix) {
    return {
      value: `${definition.prefix}${suffix}`,
    };
  }

  return {
    finding: `unknown metadata value for ${definition.fieldName}: ${raw}`,
  };
}

function stripOptionalBackticks(value) {
  let text = String(value || "").trim();
  if (text.startsWith("`") && text.endsWith("`") && text.length >= 2) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function extractSection(body, heading) {
  const start = body.indexOf(heading);
  if (start === -1) {
    return "";
  }

  const contentStart = start + heading.length;
  const nextHeadingMatch = body.slice(contentStart).match(/\n##\s+/);
  const contentEnd = nextHeadingMatch ? contentStart + nextHeadingMatch.index : body.length;
  return body.slice(contentStart, contentEnd).trim();
}

function chooseCheckState({ checkRuns, findings, hasChecks, statuses }) {
  if (!hasChecks) {
    return "unavailable";
  }

  const pendingCheckRun = checkRuns.some((checkRun) => checkRun.status !== "completed");
  const pendingStatus = statuses.some((commitStatus) => commitStatus.state === "pending");
  if (pendingCheckRun || pendingStatus) {
    return "pending";
  }

  return findings.length > 0 ? "failing" : "passing";
}

function normalizePath(path) {
  return String(path).replaceAll("\\", "/");
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}
