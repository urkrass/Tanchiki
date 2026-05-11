import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  formatMissingAuthChannels,
  getMissingAuthChannels,
  linearAuthChannel,
  linearAuthEnvNames,
  readFirstEnv,
  redactSecureText,
} from "./secure-runner.js";

export const campaignFactorySchemaVersion = "tanchiki.campaign_factory.plan.v2";
export const defaultActiveProject = "Tanchiki \u2014 Playable Tank RPG Prototype";
export const defaultActiveRepo = "urkrass/Tanchiki";
export const defaultMilestone = "Harness Milestone E \u2014 Planner and Campaign Factory v2";
export const defaultReviewCadence = "paired-review";
export const defaultModelHint = "frontier";
export const defaultLinearTeamName = "Marsel";
export const linearApiUrl = "https://api.linear.app/graphql";

export const defaultHardRules = [
  "no live campaign creation without explicit operator confirmation",
  "no duplicate campaign creation",
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
const idempotencyMarker = "Campaign Factory idempotency key:";

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
const disallowedLiveLabels = new Set([
  "blocked",
  "human-only",
  "merge:auto-eligible",
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "risk:human-only",
]);

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
  fetchImpl = fetch,
  fixture = null,
  input = null,
  linearClient = null,
  options = {},
} = {}) {
  const source = fixture ?? input ?? options.input ?? {};
  if (options.live === true || options.mode === "live") {
    return createLiveCampaignFromInput(source, {
      env,
      fetchImpl,
      linearClient,
      options,
    });
  }
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
  const relationEdges = buildRelationEdgesForSequence(sequence, reviewCadence);
  const campaignIdentity = buildCampaignIdentity(normalized, { relationEdges, reviewCadence, sequence });
  const issues = sequence.map((role, index) => buildIssue({
    campaignIdentity,
    hardRules,
    index,
    input: normalized,
    relationEdges,
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
      idempotency_key: campaignIdentity.key,
      name: normalized.campaign,
      review_cadence: reviewCadence,
      risk,
      validation_profile: validationProfile,
    },
    dependency_graph: buildDependencyGraph(issues),
    first_runnable_issue: issues[0]?.temporary_id || null,
    issues,
    live_schema: {
      expected_relation_graph: relationEdges.map(formatRelationEdge),
      relation_count: relationEdges.length,
    },
    linear_team: normalized.linearTeam,
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

  const redactedPlan = redactPlan(plan, redactionOptions);
  return attachLiveCreationPreview(redactedPlan);
}

export const planCampaignIdea = planCampaign;

export async function createLiveCampaignFromInput(rawInput = {}, {
  env = process.env,
  fetchImpl = fetch,
  linearClient = null,
  options = {},
} = {}) {
  const plan = planCampaign(rawInput, { env, mode: "dry-run" });
  return createLiveCampaignFromPlan(plan, {
    env,
    fetchImpl,
    linearClient,
    options: { ...options, live: true, mode: "live" },
  });
}

export async function createLiveCampaignFromPlan(plan, {
  env = process.env,
  fetchImpl = fetch,
  linearClient = null,
  options = {},
} = {}) {
  const findings = getLiveCampaignPreflightFindings(plan, { env, options });
  const redactionOptions = { env };
  if (findings.length > 0) {
    return redactPlan(buildLiveRejectedPlan(plan, {
      findings,
      reason: "live campaign creation gate failed before mutation",
    }), redactionOptions);
  }

  const client = linearClient || createLinearCampaignClient({
    fetchImpl,
    token: readFirstEnv(env, linearAuthEnvNames),
  });
  const createdIssues = [];
  const createdRelations = [];
  try {
    const context = {
      activeProject: plan.active_linear_project,
      milestone: plan.milestone,
      team: plan.linear_team,
    };
    const duplicateCheck = await getDuplicateCampaignCheck(client, plan, context);
    if (options.repairRelations === true) {
      return redactPlan(await repairLiveCampaignRelations({
        client,
        context,
        duplicateCheck,
        plan,
      }), redactionOptions);
    }
    if (duplicateCheck.status !== "none") {
      return redactPlan(buildDuplicateRejectedPlan(plan, duplicateCheck), redactionOptions);
    }

    for (const issue of plan.issues) {
      const created = await client.createIssue(issue, context);
      createdIssues.push({
        id: created.id || created.identifier || issue.temporary_id,
        temporary_id: issue.temporary_id,
        title: issue.title,
        url: created.url || null,
      });
    }

    const createdByTempId = new Map(createdIssues.map((issue) => [issue.temporary_id, issue]));
    createdRelations.push(...await createExpectedBlockingRelations({
      client,
      edges: collectPlanEdges(plan.issues),
      issueByTempId: createdByTempId,
    }));

    const postMutationCheck = await getDuplicateCampaignCheck(client, plan, context);
    if (postMutationCheck.status !== "already_exists") {
      return redactPlan({
        ...plan,
        live_creation: {
          ...plan.live_creation,
          allowed: false,
          created_issues: createdIssues,
          created_relations: createdRelations,
          duplicate_check: duplicateCheck,
          failure: liveFinding(
            "relation-verification-failed",
            "Linear machine-state relation graph could not be verified after mutation.",
            postMutationCheck.relation_check?.missing_relation_edges?.join(",") || "relation-verification-failed",
          ),
          missing_expected_issues: [],
          post_mutation_duplicate_check: postMutationCheck,
          reason: "live campaign creation stopped after relation read-back failed; no cleanup was attempted",
          relation_count: postMutationCheck.relation_check?.actual_relation_count || 0,
          relation_verification: postMutationCheck.relation_check,
          requested: true,
        },
        mode: "live",
        status: "partial-failure",
      }, redactionOptions);
    }

    return redactPlan({
      ...plan,
      live_creation: {
        ...plan.live_creation,
        allowed: true,
        created_relations: createdRelations,
        created_issues: createdIssues,
        dogfood_evidence: {
          created_issue_count: createdIssues.length,
          first_runnable_issue: plan.first_runnable_issue,
          duplicate_check: duplicateCheck,
          expected_relation_graph: plan.live_schema?.expected_relation_graph || plan.dependency_graph,
          forbidden_side_effects: {
            dependency_changes: false,
            gameplay_changes: false,
            github_label_mutation: false,
            movement_file_touched: false,
            stop_label_removal: false,
            workflow_changes: false,
          },
          post_mutation_duplicate_check: postMutationCheck,
          relation_count: postMutationCheck.relation_check.actual_relation_count,
          relation_verification: postMutationCheck.relation_check,
        },
        reason: "live campaign creation completed after explicit confirmation and pre-mutation revalidation",
        relation_count: postMutationCheck.relation_check.actual_relation_count,
        relation_verification: postMutationCheck.relation_check,
        requested: true,
        schema_audit: {
          actual_relation_graph: postMutationCheck.relation_check.actual_relation_graph,
          finding_count: 0,
          machine_state_relation_schema: plan.live_schema?.expected_relation_graph || plan.dependency_graph,
          relation_source: postMutationCheck.relation_check.relation_source,
        },
      },
      mode: "live",
      status: "live-created",
    }, redactionOptions);
  } catch (error) {
    return redactPlan({
      ...plan,
      live_creation: {
        ...plan.live_creation,
        allowed: false,
        created_relations: createdRelations,
        created_issues: createdIssues,
        failure: sanitizeCampaignFactoryError(error, { env }),
        missing_expected_issues: plan.issues
          .slice(createdIssues.length)
          .map((issue) => issue.temporary_id),
        reason: createdIssues.length > 0
          ? "live campaign creation stopped after a partial mutation; no cleanup was attempted"
          : "live campaign creation failed before any issue was created",
        relation_count: createdRelations.length,
        requested: true,
      },
      mode: "live",
      status: createdIssues.length > 0 ? "partial-failure" : "rejected",
    }, redactionOptions);
  }
}

export function getLiveCampaignPreflightFindings(plan, { env = {}, options = {} } = {}) {
  const findings = [];
  const liveRequested = options.live === true || options.mode === "live";
  const repairRequested = options.repairRelations === true;
  if (!liveRequested) {
    findings.push(liveFinding("live-flag-required", "Live campaign creation requires an explicit live mode flag."));
  }
  if (!repairRequested && options.confirmCreateLiveCampaign !== true) {
    findings.push(liveFinding("operator-confirmation-required", "Live campaign creation requires explicit operator confirmation."));
  }
  if (repairRequested && options.confirmRepairRelations !== true) {
    findings.push(liveFinding("operator-repair-confirmation-required", "Live relation repair requires explicit operator confirmation."));
  }

  const expectedPhrase = repairRequested
    ? buildRepairConfirmationPhrase(plan)
    : plan?.live_creation?.confirmation_phrase || buildLiveConfirmationPhrase(plan);
  if (stringValue(options.confirmationPhrase) !== expectedPhrase) {
    findings.push(liveFinding("confirmation-phrase-mismatch", "Live campaign confirmation phrase does not match the planned campaign, action, and active project."));
  }

  const expectedHash = hashCampaignPlan(plan);
  if (stringValue(options.previewHash) !== expectedHash) {
    findings.push(liveFinding("preview-hash-mismatch", "Live campaign preview hash does not match the plan that would be created."));
  }
  if (stringValue(options.team || plan?.linear_team || defaultLinearTeamName) !== (plan?.linear_team || defaultLinearTeamName)) {
    findings.push(liveFinding("linear-team-mismatch", "Live campaign team must match the reviewed dry-run preview."));
  }

  const missingAuth = getMissingAuthChannels(env, [linearAuthChannel]);
  if (missingAuth.length > 0) {
    findings.push(liveFinding(
      "missing-linear-auth",
      `Live campaign creation requires ${formatMissingAuthChannels(missingAuth)}.`,
    ));
  }

  return uniqueFindings([
    ...findings,
    ...validateLiveCampaignPlan(plan),
  ]);
}

export function hashCampaignPlan(plan) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeForHash(stripHashFields(plan))) ?? "null")
    .digest("hex");
}

export function buildLiveConfirmationPhrase(plan) {
  return `CREATE LIVE CAMPAIGN: ${plan?.campaign?.name || ""} IN ${plan?.active_linear_project || ""}`;
}

export function buildRepairConfirmationPhrase(plan) {
  return `REPAIR LIVE CAMPAIGN RELATIONS: ${plan?.campaign?.name || ""} IN ${plan?.active_linear_project || ""}`;
}

export function formatCampaignPlanMarkdown(plan) {
  const lines = [
    `# ${plan.campaign?.name || "Campaign Factory v2 Plan"}`,
    "",
    `- Status: ${plan.status}`,
    `- Active Linear project: ${plan.active_linear_project || "missing"}`,
    `- Active repo: ${plan.active_repo || "missing"}`,
    `- Milestone: ${plan.milestone || "missing"}`,
    `- Linear team: ${plan.linear_team || "missing"}`,
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
    `- Preview hash: ${plan.live_creation?.preview_hash || "none"}`,
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
      case "--live":
        options.live = true;
        options.mode = "live";
        break;
      case "--confirm-create-live-campaign":
        options.confirmCreateLiveCampaign = true;
        break;
      case "--repair-relations":
        options.repairRelations = true;
        break;
      case "--confirm-repair-relations":
        options.confirmRepairRelations = true;
        break;
      case "--confirmation-phrase":
        options.confirmationPhrase = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--preview-hash":
        options.previewHash = readArgValue(argv, index, arg);
        index += 1;
        break;
      case "--team":
        options.team = readArgValue(argv, index, arg);
        index += 1;
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
    return { ok: ["already_exists", "live-created", "planned", "relations-repaired"].includes(plan.status), plan };
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
    idempotencyKey: stringValue(input.idempotencyKey || input.idempotency_key || input.campaignIdempotencyKey || input.campaign_idempotency_key),
    ideaType: normalizeToken(input.ideaType || input.idea_type || input.type),
    linearTeam: stringValue(input.linearTeam || input.linear_team || input.team || defaultLinearTeamName),
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
    linear_team: input.linearTeam || defaultLinearTeamName,
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

function buildLiveRejectedPlan(plan, { findings, reason }) {
  const sourcePlan = plan && typeof plan === "object" ? plan : {};
  return {
    ...sourcePlan,
    live_creation: {
      ...sourcePlan.live_creation,
      allowed: false,
      findings,
      reason,
      requested: true,
    },
    mode: "live",
    status: "rejected",
    unsafe_findings: [...(sourcePlan.unsafe_findings || []), ...findings],
  };
}

function buildDuplicateRejectedPlan(plan, duplicateCheck) {
  const reason = duplicateCheck.status === "already_exists"
    ? "matching campaign already exists with verified Linear relation graph; no live mutation was performed"
    : duplicateCheck.status === "issues_only"
      ? "matching campaign issues exist but Linear relation graph is incomplete; no live mutation was performed"
      : "partial matching campaign exists; no live mutation was performed";
  const finding = liveFinding(
    duplicateCheck.status,
    reason,
    duplicateCheck.matching_issue_ids.join(",") || duplicateCheck.status,
  );

  return {
    ...plan,
    live_creation: {
      ...plan.live_creation,
      allowed: false,
      created_relations: [],
      created_issues: [],
      duplicate_check: duplicateCheck,
      findings: [finding],
      relation_verification: duplicateCheck.relation_check,
      reason,
      requested: true,
    },
    mode: "live",
    status: duplicateCheck.status,
    unsafe_findings: [...(plan.unsafe_findings || []), finding],
  };
}

async function repairLiveCampaignRelations({ client, context, duplicateCheck, plan }) {
  if (duplicateCheck.status === "already_exists") {
    return buildDuplicateRejectedPlan(plan, duplicateCheck);
  }
  if (duplicateCheck.status !== "issues_only") {
    const finding = liveFinding(
      "repair-requires-issues-only",
      "Relation repair requires all campaign issues to exist with only expected Linear relations missing.",
      duplicateCheck.status,
    );
    return buildLiveRejectedPlan(plan, {
      findings: [finding],
      reason: "live relation repair gate failed before mutation",
    });
  }

  const issueByTempId = new Map(duplicateCheck.matches
    .filter((issue) => issue.temporary_id)
    .map((issue) => [issue.temporary_id, issue]));
  const missingEdges = collectPlanEdges(plan.issues)
    .filter((edge) => duplicateCheck.relation_check.missing_relation_edges.includes(formatRelationEdge(edge)));
  const createdRelations = await createExpectedBlockingRelations({
    client,
    edges: missingEdges,
    issueByTempId,
  });
  const postRepairCheck = await getDuplicateCampaignCheck(client, plan, context);
  if (postRepairCheck.status !== "already_exists") {
    return {
      ...plan,
      live_creation: {
        ...plan.live_creation,
        allowed: false,
        created_issues: [],
        created_relations: createdRelations,
        duplicate_check: duplicateCheck,
        post_mutation_duplicate_check: postRepairCheck,
        reason: "live relation repair stopped after relation read-back failed; no cleanup was attempted",
        relation_count: postRepairCheck.relation_check?.actual_relation_count || 0,
        relation_verification: postRepairCheck.relation_check,
        requested: true,
      },
      mode: "live",
      status: "partial-failure",
    };
  }

  return {
    ...plan,
    live_creation: {
      ...plan.live_creation,
      allowed: true,
      created_issues: [],
      created_relations: createdRelations,
      duplicate_check: duplicateCheck,
      post_mutation_duplicate_check: postRepairCheck,
      reason: "live campaign relations repaired after explicit operator confirmation and machine-state verification",
      relation_count: postRepairCheck.relation_check.actual_relation_count,
      relation_repair: {
        created_relation_count: createdRelations.length,
        repaired_edges: createdRelations.map((relation) => relation.edge),
      },
      relation_verification: postRepairCheck.relation_check,
      requested: true,
      schema_audit: {
        actual_relation_graph: postRepairCheck.relation_check.actual_relation_graph,
        finding_count: 0,
        machine_state_relation_schema: plan.live_schema?.expected_relation_graph || plan.dependency_graph,
        relation_source: postRepairCheck.relation_check.relation_source,
      },
    },
    mode: "live",
    status: "relations-repaired",
  };
}

async function getDuplicateCampaignCheck(client, plan, context) {
  if (typeof client.findExistingCampaignIssues !== "function") {
    throw new CampaignFactoryError(
      "duplicate-check-unavailable",
      "Live campaign creation requires a duplicate/idempotency lookup before mutation.",
    );
  }
  const existingIssues = await client.findExistingCampaignIssues(plan, context);
  return detectDuplicateCampaign(plan, existingIssues);
}

export function detectDuplicateCampaign(plan, existingIssues = []) {
  const expectedIssues = plan.issues || [];
  const expectedByTitle = new Map(expectedIssues
    .map((issue) => [normalizeComparableText(issue.title), issue]));
  const matches = existingIssues
    .filter((issue) => existingIssueMatchesCampaign(plan, issue))
    .map((issue) => {
      const expectedIssue = expectedByTitle.get(normalizeComparableText(issue.title));
      return {
        id: issue.id || null,
        identifier: issue.identifier || null,
        relations: issue.relations || null,
        inverseRelations: issue.inverseRelations || null,
        state: issue.state?.name || issue.state || null,
        state_type: issue.state?.type || issue.state_type || null,
        temporary_id: expectedIssue?.temporary_id || null,
        title: issue.title || "",
        url: issue.url || null,
      };
    });

  const matchedTemporaryIds = new Set(matches
    .map((issue) => issue.temporary_id)
    .filter(Boolean));
  const relationCheck = buildLinearRelationGraphCheck(plan, matches);
  const hasAllExpectedIssues = expectedIssues.length > 0 && matchedTemporaryIds.size >= expectedIssues.length;
  const hasCompleteRelationGraph = relationCheck.missing_relation_edges.length === 0
    && relationCheck.extra_relation_edges.length === 0;
  const status = matches.length === 0
    ? "none"
    : hasAllExpectedIssues
      ? hasCompleteRelationGraph
        ? "already_exists"
        : relationCheck.extra_relation_edges.length > 0
          ? "inconsistent"
          : "issues_only"
      : "partial_exists";

  return {
    expected_issue_count: expectedIssues.length,
    matched_issue_count: matches.length,
    matched_title_count: matchedTemporaryIds.size,
    matching_issue_ids: matches.map((issue) => issue.identifier || issue.id).filter(Boolean),
    matches,
    relation_check: relationCheck,
    status,
  };
}

function buildLinearRelationGraphCheck(plan, matches) {
  const expectedEdges = collectPlanEdges(plan.issues).map(formatRelationEdge);
  const actualEdges = collectLinearMachineRelationEdges(matches);
  const missingRelationEdges = expectedEdges.filter((edge) => !actualEdges.includes(edge));
  const extraRelationEdges = actualEdges.filter((edge) => !expectedEdges.includes(edge));
  return {
    actual_relation_count: actualEdges.length,
    actual_relation_graph: actualEdges,
    expected_relation_count: expectedEdges.length,
    expected_relation_graph: expectedEdges,
    extra_relation_edges: extraRelationEdges,
    missing_relation_edges: missingRelationEdges,
    relation_source: "Linear machine-state relations",
  };
}

function collectLinearMachineRelationEdges(matches) {
  const issueIdToTempId = new Map();
  const edges = [];
  for (const issue of matches) {
    if (!issue.temporary_id) {
      continue;
    }
    for (const id of [issue.id, issue.identifier]) {
      if (id) {
        issueIdToTempId.set(id, issue.temporary_id);
      }
    }
  }

  for (const issue of matches) {
    if (!issue.temporary_id) {
      continue;
    }
    for (const relation of issue.relations?.nodes || []) {
      const relatedTemporaryId = tempIdForLinearIssue(relation.relatedIssue, issueIdToTempId);
      if (!relatedTemporaryId) {
        continue;
      }
      if (isBlockingRelationType(relation.type)) {
        edges.push(formatRelationEdge({ from: issue.temporary_id, to: relatedTemporaryId }));
      } else if (isBlockedByRelationType(relation.type)) {
        edges.push(formatRelationEdge({ from: relatedTemporaryId, to: issue.temporary_id }));
      }
    }
    for (const relation of issue.inverseRelations?.nodes || []) {
      const sourceTemporaryId = tempIdForLinearIssue(relation.issue, issueIdToTempId);
      if (!sourceTemporaryId) {
        continue;
      }
      if (isBlockingRelationType(relation.type)) {
        edges.push(formatRelationEdge({ from: sourceTemporaryId, to: issue.temporary_id }));
      } else if (isBlockedByRelationType(relation.type)) {
        edges.push(formatRelationEdge({ from: issue.temporary_id, to: sourceTemporaryId }));
      }
    }
  }

  return uniqueStrings(edges).sort();
}

function tempIdForLinearIssue(issue, issueIdToTempId) {
  if (!issue) {
    return "";
  }
  return issueIdToTempId.get(issue.id) || issueIdToTempId.get(issue.identifier) || "";
}

function existingIssueMatchesCampaign(plan, issue) {
  const expectedTitles = new Set((plan.issues || []).map((candidate) => normalizeComparableText(candidate.title)));
  const title = normalizeComparableText(issue?.title);
  const description = stringValue(issue?.description);
  const campaignName = stringValue(plan?.campaign?.name);
  const idempotencyKey = stringValue(plan?.campaign?.idempotency_key);
  const milestoneName = stringValue(
    issue?.projectMilestone?.name
      || issue?.project_milestone?.name
      || issue?.milestone?.name
      || issue?.milestone,
  );

  if (milestoneName && milestoneName !== plan.milestone) {
    return false;
  }
  if (idempotencyKey && description.includes(`${idempotencyMarker} ${idempotencyKey}`)) {
    return true;
  }
  return expectedTitles.has(title) && campaignName && description.includes(campaignName);
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

function buildRelationEdgesForSequence(sequence, reviewCadence) {
  const temporaryIdForRole = (role) => `campaign-${roleSlug(role)}`;
  const hasRole = (role) => sequence.includes(role);
  const edge = (fromRole, toRole) => ({
    from: temporaryIdForRole(fromRole),
    to: temporaryIdForRole(toRole),
  });

  if (
    reviewCadence === "paired-review"
    && hasRole("Architect")
    && hasRole("Coder")
    && hasRole("Tester")
    && hasRole("Reviewer")
    && hasRole("Release")
  ) {
    return [
      edge("Architect", "Coder"),
      edge("Coder", "Tester"),
      edge("Coder", "Reviewer"),
      edge("Tester", "Reviewer"),
      edge("Coder", "Release"),
      edge("Tester", "Release"),
      edge("Reviewer", "Release"),
    ];
  }

  return sequence.slice(1).map((role, index) => edge(sequence[index], role));
}

function buildCampaignIdentity(input, { relationEdges, reviewCadence, sequence }) {
  const basis = {
    active_linear_project: input.activeProject,
    active_repo: input.activeRepo,
    campaign_name: input.campaign,
    issue_titles: sequence.map((role) => titleForRole(input.campaign, role)),
    milestone: input.milestone,
    relation_graph: relationEdges.map(formatRelationEdge),
    review_cadence: reviewCadence,
    role_sequence: sequence,
  };
  const derivedKey = `cfv2:${createHash("sha256")
    .update(JSON.stringify(canonicalizeForHash(basis)))
    .digest("hex")}`;
  const operatorKey = input.idempotencyKey
    ? `cfv2:operator:${createHash("sha256").update(input.idempotencyKey).digest("hex")}`
    : "";

  return {
    basis,
    key: operatorKey || derivedKey,
  };
}

function buildIssue({
  campaignIdentity,
  hardRules,
  index,
  input,
  relationEdges,
  reviewCadence,
  risk,
  sequence,
  validationProfile,
}) {
  const role = sequence[index];
  const temporaryId = `campaign-${roleSlug(role)}`;
  const labels = roleLabels(role, validationProfile, risk);
  const state = index === 0 ? "Todo" : "Backlog";
  const blockedBy = relationEdges
    .filter((edge) => edge.to === temporaryId)
    .map((edge) => edge.from);
  const blocks = relationEdges
    .filter((edge) => edge.from === temporaryId)
    .map((edge) => edge.to);

  return {
    acceptance_criteria: acceptanceCriteriaForRole(role),
    blocked_by: blockedBy,
    blocks,
    description: issueDescription({
      campaignIdentity,
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
  campaignIdentity,
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
    `${idempotencyMarker} ${campaignIdentity.key}`,
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
  return collectPlanEdges(issues).map(formatRelationEdge);
}

function attachLiveCreationPreview(plan) {
  const previewHash = hashCampaignPlan(plan);
  return {
    ...plan,
    live_creation: {
      ...plan.live_creation,
      allowed: false,
      confirmation_phrase: buildLiveConfirmationPhrase(plan),
      preview_hash: previewHash,
      reason: plan.live_creation?.reason || "dry-run output must be reviewed before live creation",
      repair_confirmation_phrase: buildRepairConfirmationPhrase(plan),
      repair_required_flags: [
        "--live",
        "--repair-relations",
        "--confirm-repair-relations",
        "--confirmation-phrase",
        "--preview-hash",
      ],
      required_flags: [
        "--live",
        "--confirm-create-live-campaign",
        "--confirmation-phrase",
        "--preview-hash",
      ],
    },
  };
}

function formatRelationEdge(edge) {
  return `${edge.from} -> ${edge.to}`;
}

function validateLiveCampaignPlan(plan) {
  const findings = [];
  if (!plan || typeof plan !== "object") {
    return [liveFinding("invalid-plan", "Live campaign creation requires a structured campaign plan.")];
  }
  if (plan.schema_version !== campaignFactorySchemaVersion) {
    findings.push(liveFinding("invalid-schema-version", "Campaign plan schema version is not supported for live creation."));
  }
  if (plan.status !== "planned") {
    findings.push(liveFinding("plan-not-planned", "Only a clean planned dry-run campaign may be created live."));
  }
  if (plan.active_linear_project !== defaultActiveProject) {
    findings.push(liveFinding("wrong-active-project", "Live campaign creation is scoped to the active Tanchiki Linear project."));
  }
  if (plan.active_repo !== defaultActiveRepo) {
    findings.push(liveFinding("wrong-active-repo", "Live campaign creation is scoped to urkrass/Tanchiki."));
  }
  if (!stringValue(plan.milestone)) {
    findings.push(liveFinding("missing-milestone", "Live campaign creation requires a milestone."));
  }
  if (plan.linear_team !== defaultLinearTeamName) {
    findings.push(liveFinding("wrong-linear-team", "Live campaign creation is scoped to the Marsel Linear team."));
  }
  if (!stringValue(plan.campaign?.name) || !stringValue(plan.campaign?.goal)) {
    findings.push(liveFinding("missing-campaign-fields", "Live campaign creation requires a campaign name and goal."));
  }
  if (!stringValue(plan.campaign?.idempotency_key)) {
    findings.push(liveFinding("missing-idempotency-key", "Live campaign creation requires a campaign idempotency key."));
  }
  if ((plan.unsafe_findings || []).length > 0) {
    findings.push(liveFinding("unsafe-findings-present", "Live campaign creation requires zero unsafe findings."));
  }
  if (!Array.isArray(plan.issues) || plan.issues.length === 0) {
    findings.push(liveFinding("missing-issues", "Live campaign creation requires generated issues."));
    return findings;
  }

  const temporaryIds = new Set(plan.issues.map((issue) => issue.temporary_id));
  const firstIssue = plan.issues[0];
  if (plan.first_runnable_issue !== firstIssue.temporary_id || firstIssue.role !== "Architect") {
    findings.push(liveFinding("invalid-first-runnable-issue", "Only the Architect issue may be the first runnable issue."));
  }

  for (const [index, issue] of plan.issues.entries()) {
    findings.push(...validateLiveIssue(issue, { index, temporaryIds }));
  }

  findings.push(...verifyGeneratedCampaignSchema(plan));

  const serialized = JSON.stringify(plan);
  if (containsUnredactedSecret(serialized)) {
    findings.push(liveFinding("unredacted-secret-like-output", "Campaign plan contains unredacted token-like material."));
  }

  return findings;
}

export function verifyGeneratedCampaignSchema(plan) {
  if (!plan || !Array.isArray(plan.issues)) {
    return [liveFinding("invalid-plan", "Campaign schema audit requires generated issues.")];
  }

  const findings = [];
  const actualBlockedByEdges = collectPlanEdges(plan.issues).map(formatRelationEdge);
  const actualBlocksEdges = collectPlanBlockEdges(plan.issues).map(formatRelationEdge);
  const declaredEdges = Array.isArray(plan.dependency_graph) ? plan.dependency_graph : [];
  const expectedEdges = expectedRelationEdgesForPlan(plan).map(formatRelationEdge);

  findings.push(...compareRelationSets({
    actual: actualBlockedByEdges,
    expected: expectedEdges,
    extraId: "unexpected-relation-edge",
    missingId: "required-relation-missing",
    source: "blocked_by",
  }));
  findings.push(...compareRelationSets({
    actual: actualBlocksEdges,
    expected: expectedEdges,
    extraId: "blocks-relation-mismatch",
    missingId: "blocks-relation-missing",
    source: "blocks",
  }));
  findings.push(...compareRelationSets({
    actual: declaredEdges,
    expected: actualBlockedByEdges,
    extraId: "dependency-graph-extra-edge",
    missingId: "dependency-graph-mismatch",
    source: "dependency_graph",
  }));

  const liveSchemaEdges = plan.live_schema?.expected_relation_graph;
  if (liveSchemaEdges) {
    findings.push(...compareRelationSets({
      actual: liveSchemaEdges,
      expected: expectedEdges,
      extraId: "live-schema-extra-edge",
      missingId: "live-schema-missing-edge",
      source: "live_schema.expected_relation_graph",
    }));
  }

  return uniqueFindings(findings);
}

function validateLiveIssue(issue, { index, temporaryIds }) {
  const findings = [];
  if (!issue?.temporary_id || !temporaryIds.has(issue.temporary_id)) {
    findings.push(liveFinding("invalid-issue-id", "Generated issue is missing a temporary ID."));
  }
  for (const prefix of ["role:", "type:", "risk:", "validation:"]) {
    const count = countLabelsWithPrefix(issue.labels || [], prefix);
    if (count !== 1) {
      findings.push(liveFinding("label-cardinality", `${issue.temporary_id} must have exactly one ${prefix} label.`));
    }
  }
  const disallowed = (issue.labels || []).filter((label) => (
    disallowedLiveLabels.has(label)
    || label.startsWith("github:")
    || label.startsWith("merge:")
    || /stop-label/i.test(label)
  ));
  if (disallowed.length > 0) {
    findings.push(liveFinding("disallowed-live-label", `${issue.temporary_id} contains disallowed live labels.`));
  }
  if (index === 0) {
    if (issue.role !== "Architect" || issue.state !== "Todo" || !issue.labels?.includes("automation-ready")) {
      findings.push(liveFinding("invalid-architect-runnable-state", "Architect must be Todo and automation-ready."));
    }
  } else if (issue.state !== "Backlog" || issue.labels?.includes("automation-ready")) {
    findings.push(liveFinding("invalid-downstream-state", `${issue.temporary_id} must be Backlog and not automation-ready.`));
  }
  for (const blocker of issue.blocked_by || []) {
    if (!temporaryIds.has(blocker)) {
      findings.push(liveFinding("unknown-blocker", `${issue.temporary_id} references unknown blocker ${blocker}.`));
    }
  }
  for (const blocked of issue.blocks || []) {
    if (!temporaryIds.has(blocked)) {
      findings.push(liveFinding("unknown-blocked-issue", `${issue.temporary_id} references unknown blocked issue ${blocked}.`));
    }
  }
  const requiredDescription = [
    "Active Linear project:",
    "Milestone:",
    "Active GitHub repo:",
    "review_cadence:",
    "## Goal",
    "## Hard Rules",
    "## Acceptance Criteria",
    "## Validation",
    "## Visible UI Expectation",
  ];
  for (const required of requiredDescription) {
    if (!issue.description?.includes(required)) {
      findings.push(liveFinding("missing-issue-description-metadata", `${issue.temporary_id} is missing ${required}.`));
    }
  }
  if (isPrProducingRole(issue.role) && !issue.description?.includes("## PR Metadata Requirements")) {
    findings.push(liveFinding("missing-pr-metadata-requirements", `${issue.temporary_id} is missing PR metadata requirements.`));
  }
  return findings;
}

function collectPlanEdges(issues = []) {
  const edges = [];
  for (const issue of issues) {
    for (const blocker of issue.blocked_by || []) {
      edges.push({ from: blocker, to: issue.temporary_id });
    }
  }
  return edges;
}

async function createExpectedBlockingRelations({ client, edges, issueByTempId }) {
  const createdRelations = [];
  for (const edge of edges) {
    const blockingIssue = issueByTempId.get(edge.from);
    const blockedIssue = issueByTempId.get(edge.to);
    if (!blockingIssue || !blockedIssue) {
      throw new CampaignFactoryError("live-relation-resolution-failed", `Could not resolve relation ${edge.from} -> ${edge.to}.`);
    }
    let alreadyExisted = false;
    let relation;
    try {
      relation = await createBlockingRelationWithClient(client, {
        blockedIssueId: blockedIssue.id,
        blockingIssueId: blockingIssue.id,
      });
    } catch (error) {
      if (!isDuplicateRelationError(error)) {
        throw error;
      }
      alreadyExisted = true;
      relation = { id: `already-existing:${edge.from}->${edge.to}` };
    }
    createdRelations.push({
      already_existed: alreadyExisted,
      blocked_issue_id: blockedIssue.id,
      blocking_issue_id: blockingIssue.id,
      edge: formatRelationEdge(edge),
      id: relation?.id || `${edge.from}->${edge.to}`,
    });
  }
  return createdRelations;
}

function isDuplicateRelationError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("already exists")
    || message.includes("duplicate")
    || message.includes("relation already");
}

async function createBlockingRelationWithClient(client, input) {
  if (typeof client.createBlockingRelation === "function") {
    return client.createBlockingRelation(input);
  }
  if (typeof client.createRelation === "function") {
    return client.createRelation(input);
  }
  throw new CampaignFactoryError(
    "relation-create-unavailable",
    "Live campaign creation requires a Linear relation creation adapter.",
  );
}

function collectPlanBlockEdges(issues = []) {
  const edges = [];
  for (const issue of issues) {
    for (const blocked of issue.blocks || []) {
      edges.push({ from: issue.temporary_id, to: blocked });
    }
  }
  return edges;
}

function expectedRelationEdgesForPlan(plan) {
  const sequence = (plan.issues || []).map((issue) => issue.role);
  return buildRelationEdgesForSequence(sequence, plan.campaign?.review_cadence || defaultReviewCadence);
}

function compareRelationSets({ actual, expected, extraId, missingId, source }) {
  const findings = [];
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  for (const edge of expectedSet) {
    if (!actualSet.has(edge)) {
      findings.push(liveFinding(missingId, `${source} is missing required relation ${edge}.`, `${source}:${edge}`));
    }
  }
  for (const edge of actualSet) {
    if (!expectedSet.has(edge)) {
      findings.push(liveFinding(extraId, `${source} contains unexpected relation ${edge}.`, `${source}:${edge}`));
    }
  }

  return findings;
}

function countLabelsWithPrefix(labels = [], prefix) {
  return labels.filter((label) => label.startsWith(prefix)).length;
}

function containsUnredactedSecret(text) {
  return /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/.test(text)
    || /\bgithub_pat_[A-Za-z0-9_]+/.test(text)
    || /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/.test(text)
    || /\bBearer\s+[A-Za-z0-9._~+/=-]+/.test(text)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)
    || /\bfake-[A-Za-z0-9_-]*token[A-Za-z0-9_-]*/i.test(text);
}

function liveFinding(id, message, evidence = id) {
  return { evidence, id, message };
}

function isBlockedByRelationType(type = "") {
  const normalized = String(type).toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "blockedby" || normalized === "isblockedby";
}

function isBlockingRelationType(type = "") {
  const normalized = String(type).toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "blocks" || normalized === "isblocking";
}

function stripHashFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripHashFields);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => ![
        "confirmation_phrase",
        "preview_hash",
        "repair_confirmation_phrase",
        "repair_required_flags",
        "required_flags",
      ].includes(key))
      .map(([key, entry]) => [key, stripHashFields(entry)]));
  }
  return value;
}

function canonicalizeForHash(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForHash);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizeForHash(value[key])]));
  }
  return value;
}

export function createLinearCampaignClient({ fetchImpl = fetch, token }) {
  async function graphql(query, variables = {}) {
    const response = await fetchImpl(linearApiUrl, {
      body: JSON.stringify({ query, variables }),
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) {
      throw new CampaignFactoryError("linear-api-error", `Linear API error: ${payload.errors?.[0]?.message || response.status}`);
    }
    return payload.data;
  }

  let contextPromise = null;
  async function resolveContext({ activeProject, milestone, team }) {
    if (!contextPromise) {
      contextPromise = graphql(
        `query CampaignFactoryLiveContext($project: String!, $team: String!, $milestone: String!) {
          projects(filter: { name: { eq: $project } }, first: 2) {
            nodes {
              id
              name
              teams {
                nodes {
                  id
                  name
                  states { nodes { id name type } }
                }
              }
            }
          }
          teams(filter: { name: { eq: $team } }, first: 2) {
            nodes {
              id
              name
              states { nodes { id name type } }
            }
          }
          projectMilestones(filter: { name: { eq: $milestone } }, first: 5) {
            nodes { id name }
          }
          issueLabels(first: 250) {
            nodes { id name }
          }
        }`,
        { milestone, project: activeProject, team },
      ).then((data) => normalizeLinearContext(data, { activeProject, milestone, team }));
    }
    return contextPromise;
  }

  return {
    async findExistingCampaignIssues(_plan, contextInput) {
      await resolveContext(contextInput);
      const data = await graphql(
        `query CampaignFactoryFindDuplicateIssues($project: String!, $milestone: String!) {
          issues(
            filter: {
              project: { name: { eq: $project } }
              projectMilestone: { name: { eq: $milestone } }
            }
            first: 100
          ) {
            nodes {
              id
              identifier
              title
              description
              url
              state { name type }
              projectMilestone { name }
              relations(first: 50) {
                nodes {
                  type
                  relatedIssue { id identifier title state { name type } }
                }
              }
              inverseRelations(first: 50) {
                nodes {
                  type
                  issue { id identifier title state { name type } }
                }
              }
            }
          }
        }`,
        { milestone: contextInput.milestone, project: contextInput.activeProject },
      );
      return data.issues?.nodes || [];
    },
    async createIssue(issue, contextInput) {
      const context = await resolveContext(contextInput);
      const labelIds = issue.labels.map((label) => {
        const labelId = context.labelIds.get(label);
        if (!labelId) {
          throw new CampaignFactoryError("missing-linear-label", `Linear label not found: ${label}`);
        }
        return labelId;
      });
      const stateId = context.stateIds.get(issue.state.toLowerCase());
      if (!stateId) {
        throw new CampaignFactoryError("missing-linear-state", `Linear state not found: ${issue.state}`);
      }
      const input = {
        description: issue.description,
        labelIds,
        projectId: context.projectId,
        projectMilestoneId: context.milestoneId,
        stateId,
        teamId: context.teamId,
        title: issue.title,
      };
      const data = await graphql(
        `mutation CampaignFactoryCreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url }
          }
        }`,
        { input },
      );
      if (data.issueCreate?.success !== true) {
        throw new CampaignFactoryError("linear-issue-create-failed", "Linear issueCreate did not report success.");
      }
      return data.issueCreate.issue;
    },
    async createBlockingRelation({ blockedIssueId, blockingIssueId }) {
      const data = await graphql(
        `mutation CampaignFactoryCreateRelation($input: IssueRelationCreateInput!) {
          issueRelationCreate(input: $input) {
            success
            relation { id }
          }
        }`,
        {
          input: {
            issueId: blockingIssueId,
            relatedIssueId: blockedIssueId,
            type: "blocks",
          },
        },
      );
      if (data.issueRelationCreate?.success !== true) {
        throw new CampaignFactoryError("linear-relation-create-failed", "Linear issueRelationCreate did not report success.");
      }
      return data.issueRelationCreate.relation;
    },
    async createRelation(input) {
      return this.createBlockingRelation(input);
    },
  };
}

function normalizeLinearContext(data, { activeProject, milestone, team }) {
  const project = data.projects?.nodes?.find((candidate) => candidate.name === activeProject);
  if (!project) {
    throw new CampaignFactoryError("linear-project-not-found", `Linear project not found: ${activeProject}`);
  }
  const teamNode = data.teams?.nodes?.find((candidate) => candidate.name === team)
    || project.teams?.nodes?.find((candidate) => candidate.name === team);
  if (!teamNode) {
    throw new CampaignFactoryError("linear-team-not-found", `Linear team not found: ${team}`);
  }
  const milestoneNode = data.projectMilestones?.nodes?.find((candidate) => candidate.name === milestone);
  if (!milestoneNode) {
    throw new CampaignFactoryError("linear-milestone-not-found", `Linear milestone not found: ${milestone}`);
  }
  return {
    labelIds: new Map((data.issueLabels?.nodes || []).map((label) => [label.name, label.id])),
    milestoneId: milestoneNode.id,
    projectId: project.id,
    stateIds: new Map((teamNode.states?.nodes || []).map((state) => [state.name.toLowerCase(), state.id])),
    teamId: teamNode.id,
  };
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

function normalizeComparableText(value) {
  return stringValue(value).toLowerCase().replace(/\s+/g, " ");
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
    "  node scripts/campaign-factory-v2.js --fixture path/to/fixture.json --live --confirm-create-live-campaign --confirmation-phrase <phrase> --preview-hash <hash>",
    "  node scripts/campaign-factory-v2.js --fixture path/to/fixture.json --live --repair-relations --confirm-repair-relations --confirmation-phrase <phrase> --preview-hash <hash>",
    "",
    "Campaign Factory v2 defaults to fixture/dry-run planning. Live Linear campaign creation and relation repair are gated by reviewed preview hash, explicit confirmation, process-scoped Linear auth, and pre-mutation revalidation.",
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
