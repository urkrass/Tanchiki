import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { redactSecureText } from "./secure-runner.js";

export const campaignFactorySchemaVersion = "tanchiki.campaign_factory.plan.v2";
export const defaultActiveProject = "Tanchiki \u2014 Playable Tank RPG Prototype";
export const defaultActiveRepo = "urkrass/Tanchiki";
export const defaultMilestone = "Harness Milestone E \u2014 Planner and Campaign Factory v2";
export const defaultReviewCadence = "paired-review";
export const defaultModelHint = "frontier";

export const defaultHardRules = [
  "no auto-merge",
  "no GitHub label mutation",
  "no stop-label removal",
  "no workflow changes unless explicitly scoped",
  "no dependency changes unless explicitly approved",
  "no secrets printed or written",
  "no gameplay changes",
  "do not touch src/game/movement.js",
  "do not create live campaigns unless fixture/dry-run path is reviewed first",
];

export const requiredValidationCommands = [
  "npm test",
  "npm run build",
  "npm run lint",
  "git diff --check",
];

const allowedRoles = ["Architect", "Coder", "Tester", "Reviewer", "Release"];
const defaultSequence = ["Architect", "Coder", "Tester", "Reviewer", "Release"];
const docsFinalAuditSequence = ["Architect", "Coder", "Reviewer", "Release"];
const requiredInputFields = ["campaign", "milestone", "activeProject", "activeRepo", "goal"];

const allowedValidationProfiles = new Set([
  "validation:docs",
  "validation:gameplay",
  "validation:harness",
  "validation:movement",
  "validation:progression",
  "validation:test",
  "validation:ui",
]);

const allowedRiskProfiles = new Set(["risk:low", "risk:medium", "risk:high", "risk:human-only"]);

const campaignSecretEnvNames = [
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

const unsafeRules = [
  {
    id: "premature-live-campaign-creation",
    message: "Live Linear campaign creation is blocked until reviewed dry-run output is approved in a later issue.",
    patterns: [
      /\bcreate\s+(?:a\s+)?live\s+(?:linear\s+)?campaign\b/i,
      /\blive\s+(?:linear\s+)?campaign\s+creation\b/i,
      /\bwrite\s+campaign\s+issues\s+to\s+linear\b/i,
    ],
  },
  {
    id: "auto-merge-request",
    message: "Auto-merge enablement or execution is outside Campaign Factory v2 scope.",
    patterns: [
      /\benable\s+auto-?merge\b/i,
      /\bturn\s+on\s+auto-?merge\b/i,
      /\bauto-?merge\s+(?:this|the|prs?|pull requests?)\b/i,
    ],
  },
  {
    id: "merge-request",
    message: "Merge execution is outside Campaign Factory v2 scope.",
    patterns: [
      /\bgh\s+pr\s+merge\b/i,
      /\bmerge\s+(?:the\s+)?(?:pr|pull request)\b/i,
      /\bperform\s+(?:the\s+)?merge\b/i,
    ],
  },
  {
    id: "github-label-mutation",
    message: "GitHub label mutation is outside Campaign Factory v2 scope.",
    patterns: [
      /\bgh\s+(?:pr|issue)\s+edit\b.*\b(?:add-label|remove-label)\b/i,
      /\b(?:add|apply|remove|mutate)\s+(?:github\s+)?labels?\b/i,
      /\bacceptance\s+labels?\s+(?:apply|mutate|change|remove|add)\b/i,
    ],
  },
  {
    id: "stop-label-removal",
    message: "Stop-label removal is human-controlled and outside Campaign Factory v2 scope.",
    patterns: [
      /\bremove\s+(?:the\s+)?stop\s+labels?\b/i,
      /\bclear\s+(?:the\s+)?stop\s+labels?\b/i,
    ],
  },
  {
    id: "workflow-change",
    message: "Workflow changes require explicit reviewed scope and are rejected by this planner lane.",
    patterns: [
      /\.github\/workflows/i,
      /\.github\\workflows/i,
      /\b(?:change|edit|modify|update|create)\s+(?:github\s+actions?|ci\s+)?workflows?\b/i,
      /\bworkflow\s+(?:change|edit|mutation|rewrite)\b/i,
    ],
  },
  {
    id: "dependency-change",
    message: "Dependency or lockfile changes require explicit approval and are rejected by this planner lane.",
    patterns: [
      /\b(?:add|install|upgrade|update|change)\s+(?:a\s+)?dependenc(?:y|ies)\b/i,
      /\b(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)\b/i,
      /\b(?:npm|pnpm|yarn)\s+(?:install|add)\b/i,
    ],
  },
  {
    id: "repo-settings-change",
    message: "Repository settings, branch protection, and permissions are outside Campaign Factory v2 scope.",
    patterns: [
      /\b(?:repo|repository)\s+settings?\b/i,
      /\bbranch\s+protection\b/i,
      /\breviewer\s+app\s+permissions?\b/i,
      /\bmodify\s+secrets?\b/i,
      /\btoken\s+management\b/i,
    ],
  },
  {
    id: "secret-handling-request",
    message: "Secret printing, writing, or token-management requests are rejected.",
    patterns: [
      /\b(?:print|write|store|commit|persist)\s+(?:the\s+)?(?:secret|token|credential|private key)s?\b/i,
      /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+/i,
      /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/i,
      /\bgithub_pat_[A-Za-z0-9_]+/i,
      /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/i,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    ],
  },
  {
    id: "gameplay-scope",
    message: "Gameplay changes are rejected for harness/planner campaign generation.",
    patterns: [
      /\b(?:change|alter|implement|retune|modify)\s+gameplay\b/i,
      /\b(?:combat|enemy ai|level tuning|pickup behavior|win\/loss)\s+(?:change|rewrite|retune|behavior)\b/i,
    ],
  },
  {
    id: "movement-scope",
    message: "Movement work and src/game/movement.js require explicit human-gated movement scope.",
    patterns: [
      /\bsrc\/game\/movement\.js\b/i,
      /\bsrc\\game\\movement\.js\b/i,
      /\b(?:change|rewrite|touch|modify)\s+(?:grid\s+)?movement\b/i,
      /\bmovement\s+(?:rewrite|collision|interpolation|control feel)\b/i,
    ],
  },
  {
    id: "validation-weakening",
    message: "Validation weakening, disabled tests, or suppressed failures are rejected.",
    patterns: [
      /\bdisable\s+(?:the\s+)?(?:tests?|checks?|ci|validation)\b/i,
      /\bskip\s+(?:the\s+)?(?:tests?|checks?|ci|validation)\b/i,
      /\bsuppress\s+(?:the\s+)?(?:failures?|checks?)\b/i,
      /\bcontinue-on-error\s*:\s*true\b/i,
      /\b(?:treat|mark)\s+(?:missing|failing|pending)\s+checks?\s+as\s+pass/i,
    ],
  },
];

export async function runCampaignFactory({
  env = process.env,
  fixture = null,
  input = null,
  options = {},
} = {}) {
  const source = fixture ?? input ?? options.input ?? {};
  const mode = options.mode || (fixture ? "fixture" : "dry-run");
  return planCampaign(source, { env, mode });
}

export function planCampaign(rawInput = {}, { env = {}, mode = "dry-run" } = {}) {
  const normalized = normalizeInput(rawInput);
  const extraSecrets = collectInputSecrets(rawInput);
  const redactionOptions = { env, extraSecrets };
  const missingFields = requiredInputFields.filter((field) => !normalized[field]);
  const unsafeFindings = [
    ...findUnsafeScope(normalized, redactionOptions),
    ...missingFields.map((field) => ({
      evidence: field,
      id: "missing-required-input",
      message: `Missing required campaign input field: ${field}.`,
    })),
  ];

  if (unsafeFindings.length > 0) {
    return redactPlan(buildRejectedPlan(normalized, {
      mode,
      unsafeFindings,
    }), redactionOptions);
  }

  const validationProfile = selectValidationProfile(normalized);
  const risk = selectRisk(normalized, validationProfile);
  const reviewCadence = selectReviewCadence(normalized, validationProfile, risk);
  const sequence = selectIssueSequence(normalized, validationProfile, reviewCadence);
  const hardRules = uniqueStrings([...defaultHardRules, ...normalized.hardRules]);
  const issues = sequence.map((role, index) => buildIssue({
    hardRules,
    index,
    input: normalized,
    reviewCadence,
    risk,
    sequence,
    validationProfile,
  }));

  const plan = {
    active_linear_project: normalized.activeProject,
    active_repo: normalized.activeRepo,
    campaign: {
      brief: normalized.brief || normalized.goal,
      goal: normalized.goal,
      name: normalized.campaign,
      review_cadence: reviewCadence,
      risk,
      validation_profile: validationProfile,
    },
    dependency_graph: buildDependencyGraph(issues),
    first_runnable_issue: issues[0]?.temporary_id || null,
    issues,
    live_creation: {
      allowed: false,
      reason: "dry-run output must be reviewed before live creation",
      requested: Boolean(normalized.liveCreationRequested),
    },
    milestone: normalized.milestone,
    mode,
    schema_version: campaignFactorySchemaVersion,
    status: "planned",
    unsafe_findings: [],
  };

  return redactPlan(plan, redactionOptions);
}

export const planCampaignIdea = planCampaign;

export function formatCampaignPlanMarkdown(plan) {
  const lines = [
    `# ${plan.campaign?.name || "Campaign Factory v2 Plan"}`,
    "",
    `- Status: ${plan.status}`,
    `- Active Linear project: ${plan.active_linear_project || "missing"}`,
    `- Active repo: ${plan.active_repo || "missing"}`,
    `- Milestone: ${plan.milestone || "missing"}`,
    `- Review cadence: ${plan.campaign?.review_cadence || "missing"}`,
    `- Validation profile: ${plan.campaign?.validation_profile || "missing"}`,
    `- Risk: ${plan.campaign?.risk || "missing"}`,
    `- First runnable issue: ${plan.first_runnable_issue || "none"}`,
    "",
    "## Dependency Graph",
    ...formatList(plan.dependency_graph, "No dependency graph."),
    "",
    "## Issues",
    ...formatIssues(plan.issues),
    "",
    "## Unsafe Findings",
    ...formatUnsafeFindings(plan.unsafe_findings),
    "",
    "## Live Creation",
    `- Allowed: ${plan.live_creation?.allowed === true ? "yes" : "no"}`,
    `- Reason: ${plan.live_creation?.reason || "not specified"}`,
  ];
  return lines.join("\n");
}

export const formatCampaignPlan = formatCampaignPlanMarkdown;

export function redactCampaignFactoryText(value, { env = {}, extraSecrets = [] } = {}) {
  const envSecrets = Object.entries(env)
    .filter(([name, secret]) => isSecretLikeEnvName(name) && typeof secret === "string" && secret.length >= 4)
    .map(([, secret]) => secret);
  const envNamePattern = campaignSecretEnvNames.join("|");

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
    .replace(/\bfake-[A-Za-z0-9_-]*token[A-Za-z0-9_-]*/gi, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "[redacted-jwt]")
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/g, "$1[redacted]@");
}

export function sanitizeCampaignFactoryError(error, options = {}) {
  return redactCampaignFactoryText(error?.message || String(error), options);
}

export function parseArgs(argv = []) {
  const options = {
    json: false,
    mode: "dry-run",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--fixture":
      case "--input":
        options.fixturePath = readArgValue(argv, index, arg);
        options.mode = arg === "--fixture" ? "fixture" : "dry-run";
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--markdown":
        options.json = false;
        break;
      default:
        throw new CampaignFactoryError("invalid-argument", `Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2), {
  env = process.env,
  stderr = (message) => console.error(message),
  stdout = (message) => console.log(message),
} = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    stdout(usageText());
    return { ok: true };
  }

  try {
    if (!options.fixturePath) {
      throw new CampaignFactoryError("missing-input", "Campaign Factory v2 requires --fixture or --input for dry-run planning.");
    }
    const fixture = JSON.parse(await readFile(options.fixturePath, "utf8"));
    const plan = await runCampaignFactory({ env, fixture, options });
    const output = options.json
      ? JSON.stringify(plan, null, 2)
      : formatCampaignPlanMarkdown(plan);
    stdout(redactCampaignFactoryText(output, { env, extraSecrets: collectInputSecrets(fixture) }));
    return { ok: plan.status === "planned", plan };
  } catch (error) {
    stderr(`Campaign Factory v2 failed: ${sanitizeCampaignFactoryError(error, { env })}`);
    return { ok: false, error };
  }
}

function normalizeInput(rawInput = {}) {
  const input = typeof rawInput === "string"
    ? { goal: rawInput }
    : { ...rawInput };
  return {
    activeProject: stringValue(input.activeProject || input.active_linear_project),
    activeRepo: stringValue(input.activeRepo || input.active_repo),
    approvedLiveCreationGate: input.approvedLiveCreationGate || input.approved_live_creation_gate || null,
    brief: stringValue(input.brief),
    campaign: stringValue(input.campaign || input.campaignName || input.name),
    goal: stringValue(input.goal || input.idea),
    hardRules: normalizeStringArray(input.hardRules || input.hard_rules),
    ideaType: normalizeToken(input.ideaType || input.idea_type || input.type),
    liveCreationRequested: Boolean(input.liveCreationRequested || input.live_creation_requested),
    milestone: stringValue(input.milestone),
    modelHint: normalizeModelHint(input.modelHint || input.model_hint),
    requestedSequence: normalizeRoleSequence(input.requestedSequence || input.requested_sequence),
    reviewCadenceHint: normalizeReviewCadence(input.reviewCadenceHint || input.review_cadence_hint || input.reviewCadence),
    riskHint: normalizeRisk(input.riskHint || input.risk),
    scope: normalizeStringArray(input.scope),
    validationHint: normalizeValidationProfile(input.validationHint || input.validation_profile || input.validation),
  };
}

function buildRejectedPlan(input, { mode, unsafeFindings }) {
  return {
    active_linear_project: input.activeProject || null,
    active_repo: input.activeRepo || null,
    campaign: {
      brief: input.brief || input.goal || "",
      goal: input.goal || "",
      name: input.campaign || "",
      review_cadence: null,
      risk: null,
      validation_profile: null,
    },
    dependency_graph: [],
    diagnostics: unsafeFindings.map((finding) => finding.message),
    first_runnable_issue: null,
    issues: [],
    live_creation: {
      allowed: false,
      reason: input.liveCreationRequested
        ? "live campaign creation is blocked until reviewed dry-run output is approved in a later issue"
        : "unsafe or incomplete input prevented campaign planning",
      requested: Boolean(input.liveCreationRequested),
    },
    milestone: input.milestone || null,
    mode,
    recommended_next_step: "Revise the idea into a safe fixture/dry-run input and rerun Campaign Factory v2.",
    schema_version: campaignFactorySchemaVersion,
    status: "rejected",
    unsafe_findings: unsafeFindings,
  };
}

function findUnsafeScope(input, redactionOptions) {
  const findings = [];
  const text = collectIntentText(input);

  if (input.liveCreationRequested) {
    findings.push({
      evidence: "liveCreationRequested: true",
      id: "premature-live-campaign-creation",
      message: "Live Linear campaign creation is blocked until fixture/dry-run behavior is reviewed and a later issue explicitly scopes live creation.",
    });
  }

  for (const rule of unsafeRules) {
    for (const line of text.split(/\r?\n/)) {
      if (isNegatedPolicyLine(line)) {
        continue;
      }
      const pattern = rule.patterns.find((candidate) => candidate.test(line));
      if (pattern) {
        findings.push({
          evidence: redactCampaignFactoryText(line.trim(), redactionOptions),
          id: rule.id,
          message: rule.message,
        });
        break;
      }
    }
  }

  if (input.ideaType === "movement" && input.riskHint !== "risk:human-only") {
    findings.push({
      evidence: input.ideaType,
      id: "movement-human-gate-missing",
      message: "Movement ideas require human-only risk and explicit human-gated movement scope.",
    });
  }

  return uniqueFindings(findings);
}

function collectIntentText(input) {
  return [
    input.campaign,
    input.goal,
    input.brief,
    input.ideaType,
    input.validationHint,
    input.riskHint,
    input.reviewCadenceHint,
    ...input.scope,
    ...input.hardRules,
  ].filter(Boolean).join("\n");
}

function selectValidationProfile(input) {
  if (input.validationHint) {
    return input.validationHint;
  }

  const type = input.ideaType;
  if (type === "docs" || type === "architecture") {
    return "validation:docs";
  }
  if (type === "test") {
    return "validation:test";
  }
  if (type === "ui" || type === "app") {
    return "validation:ui";
  }
  if (type === "gameplay") {
    return "validation:gameplay";
  }
  if (type === "movement") {
    return "validation:movement";
  }
  if (type === "progression") {
    return "validation:progression";
  }
  return "validation:harness";
}

function selectRisk(input, validationProfile) {
  if (input.riskHint) {
    return input.riskHint;
  }
  if (validationProfile === "validation:docs" || validationProfile === "validation:test") {
    return "risk:low";
  }
  if (validationProfile === "validation:movement") {
    return "risk:human-only";
  }
  if (validationProfile === "validation:gameplay" || validationProfile === "validation:progression") {
    return "risk:medium";
  }
  return "risk:medium";
}

function selectReviewCadence(input, validationProfile, risk) {
  if (input.reviewCadenceHint) {
    return input.reviewCadenceHint;
  }
  if (validationProfile === "validation:docs" && risk === "risk:low") {
    return "final-audit";
  }
  return defaultReviewCadence;
}

function selectIssueSequence(input, validationProfile, reviewCadence) {
  if (input.requestedSequence.length > 0) {
    return input.requestedSequence;
  }
  if (validationProfile === "validation:docs" && reviewCadence === "final-audit") {
    return [...docsFinalAuditSequence];
  }
  return [...defaultSequence];
}

function buildIssue({
  hardRules,
  index,
  input,
  reviewCadence,
  risk,
  sequence,
  validationProfile,
}) {
  const role = sequence[index];
  const temporaryId = `campaign-${roleSlug(role)}`;
  const previousRole = sequence[index - 1];
  const nextRole = sequence[index + 1];
  const labels = roleLabels(role, validationProfile, risk);
  const state = index === 0 ? "Todo" : "Backlog";
  const blockedBy = previousRole ? [`campaign-${roleSlug(previousRole)}`] : [];
  const blocks = nextRole ? [`campaign-${roleSlug(nextRole)}`] : [];

  return {
    acceptance_criteria: acceptanceCriteriaForRole(role),
    blocked_by: blockedBy,
    blocks,
    description: issueDescription({
      hardRules,
      input,
      labels,
      reviewCadence,
      role,
      validationProfile,
    }),
    hard_rules: [...hardRules],
    labels,
    role,
    state,
    temporary_id: temporaryId,
    title: titleForRole(input.campaign, role),
    validation: validationForRole(role, validationProfile),
    visible_ui_expectation: "No visible UI changes.",
  };
}

function roleLabels(role, validationProfile, campaignRisk) {
  const roleSlugValue = roleSlug(role);
  if (role === "Architect") {
    return uniqueStrings([
      "role:architect",
      "type:architecture",
      validationProfile === "validation:docs" ? "risk:low" : campaignRisk,
      validationProfile === "validation:docs" ? "validation:docs" : "validation:harness",
      "harness",
      "automation-ready",
    ]);
  }
  if (role === "Release") {
    return ["role:release", "type:docs", "risk:low", "validation:docs", "harness"];
  }
  if (role === "Tester") {
    return uniqueStrings([
      "role:test",
      "type:test",
      campaignRisk,
      validationProfile === "validation:docs" ? "validation:docs" : validationProfile,
      "harness",
      "testing",
    ]);
  }
  return uniqueStrings([
    `role:${roleSlugValue}`,
    typeForValidation(validationProfile),
    campaignRisk,
    validationProfile,
    "harness",
  ]);
}

function issueDescription({
  hardRules,
  input,
  labels,
  reviewCadence,
  role,
  validationProfile,
}) {
  const roleOutput = roleOutputFor(role);
  const validation = validationForRole(role, validationProfile);
  const prMetadata = isPrProducingRole(role)
    ? [
      "",
      "## PR Metadata Requirements",
      "",
      "PR body must preserve the canonical headings:",
      "",
      "- `## Linked Linear Issue`",
      "- `## Role / Type / Risk / Validation`",
      "- `## Summary`",
      "- `## Files Changed`",
      "- `## Tests Run`",
      "- `## Manual QA`",
      "- `## Broad Scan Reason`",
      "- `## Conflict Risk`",
      "- `## Acceptance Labels`",
      "- `## PR Readiness`",
      "- `## Visible UI Expectation`",
      "- `## Known Limitations`",
      "- `## Screenshots/Video`",
    ]
    : [];

  return [
    "## Campaign",
    "",
    input.campaign,
    "",
    "Linear project mode: main-project",
    `Active Linear project: ${input.activeProject}`,
    `Milestone: ${input.milestone}`,
    `Active GitHub repo: ${input.activeRepo}`,
    `review_cadence: ${reviewCadence}`,
    `model_hint: ${input.modelHint || defaultModelHint}`,
    "Campaign context pack: generated by Campaign Factory v2 dry-run.",
    "",
    "## Goal",
    "",
    goalForRole(role, input),
    "",
    "## Scope",
    "",
    ...formatBullets(input.scope.length > 0 ? input.scope : ["Harness scripts/tests/docs only."]),
    "",
    "## Role / Type / Risk / Validation",
    "",
    ...labels
      .filter((label) => /^(role|type|risk|validation):/.test(label))
      .map((label) => `- ${label}`),
    "",
    "## Requirements",
    "",
    ...formatBullets(requirementsForRole(role)),
    "",
    "## Hard Rules",
    "",
    ...formatBullets(hardRules),
    "",
    "## Acceptance Criteria",
    "",
    ...formatBullets(acceptanceCriteriaForRole(role)),
    "",
    "## Validation",
    "",
    ...formatBullets(validation),
    ...prMetadata,
    "",
    "## Visible UI Expectation",
    "",
    "No visible UI changes.",
    "",
    "## Required Output",
    "",
    roleOutput,
  ].join("\n");
}

function titleForRole(campaign, role) {
  const prefix = `${campaign}:`;
  const titles = {
    Architect: "define contract and issue schema",
    Coder: "implement campaign planning/generation helper",
    Tester: "verify generated campaign fixtures and unsafe-scope rejection",
    Reviewer: "paired-review PR",
    Release: "summarize planner usage and remaining gates",
  };
  return `${prefix} ${titles[role]}`;
}

function goalForRole(role, input) {
  const goals = {
    Architect: `Define the contract and issue schema for ${input.campaign}.`,
    Coder: `Implement the scoped Campaign Factory v2 helper for: ${input.goal}`,
    Tester: `Verify generated plans, dependency shaping, dry-run safety, redaction, and unsafe-scope rejection for ${input.campaign}.`,
    Reviewer: `Perform paired-review for the PR implementing ${input.campaign}.`,
    Release: `Summarize ${input.campaign} behavior, validation, review, merge evidence, and remaining gates.`,
  };
  return goals[role];
}

function requirementsForRole(role) {
  const shared = [
    "Preserve active project, repo, milestone, role, type, risk, and validation metadata.",
    "Keep live mutation disabled unless a later reviewed issue explicitly scopes it.",
    "Redact secrets and token-like material before diagnostics or output.",
  ];
  const roleSpecific = {
    Architect: [
      "Define schemas, validation profile rules, review cadence rules, dependencies, and safety gates.",
      "Post architecture notes only.",
    ],
    Coder: [
      "Generate deterministic fixture/dry-run campaign plans.",
      "Emit role issues, labels, dependencies, validation profile, review cadence, and first runnable issue.",
      "Reject unsafe scopes before runnable output is produced.",
    ],
    Tester: [
      "Verify safe fixture output and unsafe fixture rejection.",
      "Confirm dry-run paths do not mutate Linear or GitHub.",
    ],
    Reviewer: [
      "Inspect PR diff, validation, metadata, unsafe-scope handling, and no-live-mutation boundaries.",
      "Post one allowed paired-review decision.",
    ],
    Release: [
      "Summarize shipped planner behavior, validation, review, merge evidence, and remaining live gates.",
    ],
  };
  return [...roleSpecific[role], ...shared];
}

function acceptanceCriteriaForRole(role) {
  const criteria = {
    Architect: [
      "Architecture notes define deterministic input and output schemas.",
      "Architecture notes define dry-run/fixture-first behavior and live creation gate.",
      "No repository files are changed.",
    ],
    Coder: [
      "Helper emits deterministic campaign plans from fixtures.",
      "Only Architect is Todo + automation-ready; downstream issues are Backlog and blocked by upstream issues.",
      "Unsafe scopes are rejected with redacted diagnostics.",
      "No live Linear or GitHub mutation occurs in fixture/dry-run mode.",
    ],
    Tester: [
      "Safe fixture produces complete plan schema.",
      "Unsafe fixture classes reject before runnable output.",
      "Fake token values are absent from output.",
      "Existing harness validation passes.",
    ],
    Reviewer: [
      "Review states APPROVED FOR MERGE, CHANGES REQUESTED, HUMAN REVIEW REQUIRED, or BLOCKED.",
      "Review confirms validation was not weakened and no forbidden mutation was introduced.",
    ],
    Release: [
      "Release summary distinguishes shipped behavior from remaining gates.",
      "Release summary names live campaign creation limitations.",
      "No repository files are changed.",
    ],
  };
  return criteria[role];
}

function validationForRole(role, validationProfile) {
  if (role === "Architect" || role === "Release") {
    return [
      "No code validation required unless files change unexpectedly.",
      "If files change, run `npm test`, `npm run build`, `npm run lint`, and `git diff --check`.",
    ];
  }
  if (role === "Reviewer") {
    return [
      "Verify producer validation evidence.",
      "Rerun focused checks only if needed.",
    ];
  }
  if (validationProfile === "validation:docs") {
    return ["npm test", "npm run build", "npm run lint", "git diff --check"];
  }
  return [...requiredValidationCommands];
}

function roleOutputFor(role) {
  const outputs = {
    Architect: "Post architecture comment to the Architect issue.",
    Coder: "Open a PR against `main`, link it to the Coder issue, and do not merge.",
    Tester: "Post PASS/BLOCKED verification result to the Tester issue.",
    Reviewer: "Post paired-review decision and do not merge.",
    Release: "Post release summary and mark Done only if protocol allows.",
  };
  return outputs[role];
}

function buildDependencyGraph(issues) {
  return issues.slice(1).map((issue, index) => `${issues[index].temporary_id} -> ${issue.temporary_id}`);
}

function typeForValidation(validationProfile) {
  const mapping = {
    "validation:docs": "type:docs",
    "validation:gameplay": "type:gameplay",
    "validation:harness": "type:harness",
    "validation:movement": "type:movement",
    "validation:progression": "type:progression",
    "validation:test": "type:test",
    "validation:ui": "type:ui",
  };
  return mapping[validationProfile] || "type:harness";
}

function isPrProducingRole(role) {
  return role === "Coder" || role === "Tester";
}

function roleSlug(role) {
  return role === "Tester" ? "tester" : String(role || "").toLowerCase();
}

function normalizeRoleSequence(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const sequence = value
    .map((role) => stringValue(role))
    .map((role) => role.toLowerCase() === "test" ? "Tester" : capitalize(role))
    .filter((role) => allowedRoles.includes(role));
  return sequence.length > 0 ? uniqueStrings(sequence) : [];
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return stringValue(value) ? [stringValue(value)] : [];
  }
  return value.map((item) => stringValue(item)).filter(Boolean);
}

function normalizeToken(value) {
  return stringValue(value).toLowerCase().replace(/^type:/, "");
}

function normalizeValidationProfile(value) {
  const normalized = stringValue(value).toLowerCase().replace(/^validation:/, "");
  if (!normalized) {
    return "";
  }
  const profile = `validation:${normalized}`;
  return allowedValidationProfiles.has(profile) ? profile : "";
}

function normalizeRisk(value) {
  const normalized = stringValue(value).toLowerCase().replace(/^risk:/, "");
  if (!normalized) {
    return "";
  }
  const profile = `risk:${normalized}`;
  return allowedRiskProfiles.has(profile) ? profile : "";
}

function normalizeReviewCadence(value) {
  const normalized = stringValue(value).toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return "";
  }
  if (["paired-review", "final-audit", "let-architect-decide"].includes(normalized)) {
    return normalized;
  }
  return "";
}

function normalizeModelHint(value) {
  const normalized = stringValue(value).toLowerCase().replace(/^model_hint:\s*/, "");
  if (!normalized) {
    return defaultModelHint;
  }
  return ["frontier", "cheap", "local-ok", "human-only"].includes(normalized) ? normalized : defaultModelHint;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function capitalize(value) {
  const text = stringValue(value);
  return text ? `${text[0].toUpperCase()}${text.slice(1).toLowerCase()}` : "";
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueFindings(findings) {
  const seen = new Set();
  const result = [];
  for (const finding of findings) {
    const key = `${finding.id}:${finding.evidence}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(finding);
    }
  }
  return result;
}

function isNegatedPolicyLine(line) {
  return /\b(?:no|do not|don't|never|must not|without)\b/i.test(line);
}

function redactPlan(value, options) {
  if (typeof value === "string") {
    return redactCampaignFactoryText(value, options);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPlan(item, options));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactPlan(entry, options)]));
  }
  return value;
}

function collectInputSecrets(value) {
  try {
    const serialized = JSON.stringify(value ?? "");
    return serialized.match(/\bfake-[A-Za-z0-9_-]*token[A-Za-z0-9_-]*/gi) || [];
  } catch {
    return [];
  }
}

function formatBullets(values) {
  return values.map((value) => `* ${value}`);
}

function formatList(values, emptyMessage) {
  return values?.length > 0 ? values.map((value) => `- ${value}`) : [`- ${emptyMessage}`];
}

function formatIssues(issues = []) {
  if (issues.length === 0) {
    return ["- None"];
  }
  return issues.map((issue) => (
    `- ${issue.temporary_id}: ${issue.title} (${issue.state}; ${issue.labels.join(", ")})`
  ));
}

function formatUnsafeFindings(findings = []) {
  if (findings.length === 0) {
    return ["- None"];
  }
  return findings.map((finding) => `- ${finding.id}: ${finding.message}`);
}

function readArgValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CampaignFactoryError("invalid-argument", `${name} requires a value.`);
  }
  return value;
}

function isSecretLikeEnvName(name) {
  return /(?:AUTH|KEY|PASSWORD|PRIVATE|SECRET|TOKEN)/i.test(name);
}

function usageText() {
  return [
    "Usage:",
    "  node scripts/campaign-factory-v2.js --fixture path/to/fixture.json [--json]",
    "  node scripts/campaign-factory-v2.js --input path/to/input.json [--markdown]",
    "",
    "Campaign Factory v2 is dry-run only. It emits campaign plans and rejects unsafe scopes without creating Linear or GitHub mutations.",
  ].join("\n");
}

export class CampaignFactoryError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "CampaignFactoryError";
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
