import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GITHUB_API_URL = "https://api.github.com";
const LINEAR_API_URL = "https://api.linear.app/graphql";
const ROLE_LABELS = ["role:architect", "role:coder", "role:test", "role:reviewer", "role:release"];
const TYPE_LABELS = [
  "type:architecture",
  "type:docs",
  "type:gameplay",
  "type:harness",
  "type:movement",
  "type:progression",
  "type:test",
  "type:ui",
];
const RISK_LABELS = ["risk:human-only", "risk:high", "risk:medium", "risk:low"];
const VALIDATION_LABELS = [
  "validation:docs",
  "validation:gameplay",
  "validation:harness",
  "validation:movement",
  "validation:progression",
  "validation:test",
  "validation:ui",
];
const STOP_LABELS = [
  "blocked",
  "human-only",
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "risk:human-only",
];
const AUTOMATION_READY_LABEL = "automation-ready";
const ACTIVE_CANDIDATE_STATUS = "Todo";
const ACTIVE_CANDIDATE_STATUS_TYPE = "unstarted";
const CANCELED_STATUSES = ["Canceled", "Cancelled", "Duplicate", "Abandoned", "Skipped"];
const TERMINAL_STATUSES = ["Done", "Canceled", "Cancelled", "Abandoned", "Skipped"];
const REVIEWER_BOT_LOGINS = ["tanchiki-reviewer[bot]", "tanchiki-reviewer"];
const PAIRED_REVIEW_DECISION_ALIASES = [
  ["APPROVED_FOR_MERGE", ["APPROVED FOR MERGE", "APPROVED_FOR_MERGE"]],
  ["CHANGES_REQUESTED", ["CHANGES REQUESTED", "CHANGES_REQUESTED"]],
  ["HUMAN_REVIEW_REQUIRED", ["HUMAN REVIEW REQUIRED", "HUMAN_REVIEW_REQUIRED"]],
  ["BLOCKED", ["BLOCKED"]],
];

export function decideConductorStep(input = {}) {
  const state = normalizeState(input);

  if (!state.activeProject) {
    return stopDecision({
      activeProject: "MISSING",
      evidence: ["Active Linear project was not provided."],
      reason: "missing-active-project",
      nextAction: "Provide --active-project or TANCHIKI_ACTIVE_LINEAR_PROJECT before running a conductor step.",
    });
  }

  if (state.activeProjectAmbiguous || state.activeProjects.length > 1) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: [
        `Active project candidates: ${state.activeProjects.join(", ") || "ambiguous project marker"}.`,
      ],
      reason: "ambiguous-active-project",
      nextAction: "Choose exactly one active Linear project before running the conductor.",
    });
  }

  if (!state.reviewCadence) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: ["Campaign review cadence is missing."],
      reason: "missing-review-cadence",
      nextAction: "Record review_cadence before conductor promotion.",
    });
  }

  if (state.reviewCadence !== "paired-review" && state.reviewCadence !== "final-audit") {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: [`Campaign review cadence is ${state.reviewCadence}.`],
      reason: "unsupported-review-cadence",
      nextAction:
        "Resolve review cadence to review_cadence: paired-review or review_cadence: final-audit before implementation promotion.",
    });
  }

  const wrongProjectIssues = state.issues
    .filter((issue) => issue.project && issue.project !== state.activeProject)
    .map((issue) => `${formatIssue(issue)} project: ${issue.project}.`);
  if (wrongProjectIssues.length > 0) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: wrongProjectIssues,
      reason: "wrong-active-project",
      nextAction: "Use issues from the declared active Linear project only.",
    });
  }

  const blockedTransitions = [];
  const liveReviewerSyncTransitions = findReviewerReviewSyncTransitions(state, blockedTransitions);
  const transitions = state.syncOnly
    ? liveReviewerSyncTransitions
    : [
      ...findProducerPrReadyTransitions(state, blockedTransitions),
      ...findReviewerCompletedTransitions(state),
      ...findHumanMergeCompleteTransitions(state, blockedTransitions),
      ...findReleaseReadyTransitions(state),
    ];

  if (transitions.length > 1) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: transitions.map((transition) => `${transition.transition}: ${formatIssue(transition.targetIssue)}`),
      reason: "multiple-eligible-transitions",
      nextAction: "Human or Planner/Groomer must remove ambiguity so one next issue is eligible.",
    });
  }

  if (transitions.length === 1) {
    return transitions[0];
  }

  if (blockedTransitions.length > 0) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: blockedTransitions,
      reason: "blocked-transition",
      nextAction: "Resolve the listed blocker before promoting another campaign issue.",
    });
  }

  return stopDecision({
    activeProject: state.activeProject,
    evidence: ["No eligible Conductor transition was found."],
    reason: "no-eligible-issue",
    nextAction: "Wait for a producer PR, reviewer outcome, merge outcome, or release-ready state.",
  });
}

export function formatDecision(decision) {
  const lines = [
    "Conductor step",
    `Active project: ${decision.activeProject}`,
    `Decision: ${decision.decision}`,
    `Reason: ${decision.reason}`,
  ];

  if (decision.transition) {
    lines.push(`Transition: ${decision.transition}`);
  }
  if (decision.targetIssue) {
    lines.push(`Target issue: ${formatIssue(decision.targetIssue)}`);
  }

  lines.push("Evidence:");
  for (const item of decision.evidence) {
    lines.push(`- ${item}`);
  }

  if (decision.proposedMutation) {
    lines.push("Proposed mutation:");
    lines.push(`- issue: ${decision.proposedMutation.issueId}`);
    lines.push(`- state: ${decision.proposedMutation.state || "unchanged"}`);
    lines.push(`- add labels: ${decision.proposedMutation.addLabels.join(", ") || "none"}`);
    lines.push(`- comment: ${decision.proposedMutation.comment}`);
  }

  lines.push(`Next action: ${decision.nextAction}`);
  return lines.join("\n");
}

export function decideCandidateReport(input = {}) {
  const state = normalizeCandidateReportState(input);

  if (!state.activeProject) {
    return candidateReportStop({
      activeProject: "MISSING",
      evidence: ["Active Linear project was not provided."],
      reason: "missing-active-project",
      nextAction: "Provide --active-project or TANCHIKI_ACTIVE_LINEAR_PROJECT before running a candidate report.",
    });
  }

  if (state.activeProjectAmbiguous || state.activeProjects.length > 1) {
    return candidateReportStop({
      activeProject: state.activeProject,
      evidence: [`Active project candidates: ${state.activeProjects.join(", ") || "ambiguous project marker"}.`],
      reason: "ambiguous-active-project",
      nextAction: "Choose exactly one active Linear project before reporting conductor candidates.",
    });
  }

  const candidates = state.issues
    .filter(hasAutomationReady)
    .sort(compareIssuesById)
    .map((issue) => classifyCandidateIssue(issue, state.activeProject));
  const activeCandidates = candidates.filter((candidate) => candidate.classification === "active");

  if (activeCandidates.length === 1) {
    const active = activeCandidates[0];
    return {
      activeProject: state.activeProject,
      candidates,
      decision: "report",
      evidence: [
        `Found ${candidates.length} automation-ready issue(s) in the active project.`,
        `${active.id} is the only active automation-ready candidate.`,
      ],
      nextAction: `Run Dispatcher for ${active.id} (${active.metadata.role}).`,
      readOnly: true,
      reason: "one-active-candidate",
    };
  }

  if (activeCandidates.length > 1) {
    return {
      activeProject: state.activeProject,
      candidates,
      decision: "report",
      evidence: [
        `Found ${candidates.length} automation-ready issue(s) in the active project.`,
        `Active candidates: ${activeCandidates.map((candidate) => candidate.id).join(", ")}.`,
      ],
      nextAction: "Do not run Dispatcher; run Planner/Groomer or human triage so exactly one issue is exposed.",
      readOnly: true,
      reason: "multiple-active-candidates",
    };
  }

  return {
    activeProject: state.activeProject,
    candidates,
    decision: "report",
    evidence: [
      `Found ${candidates.length} automation-ready issue(s) in the active project.`,
      "No active automation-ready candidate is eligible for Dispatcher.",
    ],
    nextAction: "Do not run Dispatcher; resolve blockers or queue grooming first.",
    readOnly: true,
    reason: "no-active-candidate",
  };
}

export function formatCandidateReport(report) {
  const lines = [
    "Conductor candidate report",
    `Active project: ${report.activeProject}`,
    `Decision: ${report.decision}`,
    `Reason: ${report.reason}`,
  ];

  lines.push("Evidence:");
  for (const item of report.evidence) {
    lines.push(`- ${item}`);
  }

  if (report.candidates.length === 0) {
    lines.push("Candidates: none");
  } else {
    lines.push("Candidates:");
    for (const candidate of report.candidates) {
      lines.push(`- ${candidate.id}: ${candidate.title || "untitled"}`);
      lines.push(`  classification: ${candidate.classification}`);
      lines.push(`  status: ${candidate.status || "missing"} (${candidate.statusType || "missing"})`);
      lines.push(`  role/type/risk/validation: ${candidate.metadata.role || "missing"} / ${candidate.metadata.type || "missing"} / ${candidate.metadata.risk || "missing"} / ${candidate.metadata.validation || "missing"}`);
      lines.push(`  labels: ${candidate.labels.join(", ") || "none"}`);
      lines.push(`  blockers: ${candidate.blockers.join(", ") || "none"}`);
      lines.push(`  reason: ${candidate.reason}`);
      lines.push(`  next safe action: ${candidate.nextSafeAction}`);
    }
  }

  const ignored = report.candidates.filter((candidate) => ["completed", "canceled"].includes(candidate.classification));
  if (ignored.length > 0) {
    lines.push("Ignored historical automation-ready issues:");
    for (const candidate of ignored) {
      lines.push(`- ${candidate.id}: ${candidate.classification}; ${candidate.reason}`);
    }
  }

  if (report.readOnly) {
    lines.push("Read-only: no Linear or GitHub mutation was applied.");
  }
  lines.push(`Next action: ${report.nextAction}`);
  return lines.join("\n");
}

export function parseArgs(argv) {
  const options = {
    activeProject: "",
    dryRun: false,
    fixture: "",
    json: "",
    pr: "",
    producer: "",
    reportCandidates: false,
    release: "",
    repo: "",
    reviewer: "",
    syncReviewOutcome: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : arg.slice(equalsIndex + 1);

    if (key === "--dry-run") {
      if (inlineValue !== null) {
        throw new ConductorStepError("--dry-run does not accept a value.");
      }
      options.dryRun = true;
      continue;
    }

    if (key === "--report-candidates") {
      if (inlineValue !== null) {
        throw new ConductorStepError("--report-candidates does not accept a value.");
      }
      options.reportCandidates = true;
      continue;
    }

    if (key === "--sync-review-outcome") {
      if (inlineValue !== null) {
        throw new ConductorStepError("--sync-review-outcome does not accept a value.");
      }
      options.syncReviewOutcome = true;
      continue;
    }

    if (!["--active-project", "--fixture", "--json", "--pr", "--producer", "--release", "--repo", "--reviewer"].includes(key)) {
      throw new ConductorStepError(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined) {
      throw new ConductorStepError(`${key} requires a value.`);
    }
    if (inlineValue === null) {
      index += 1;
    }

    if (key === "--active-project") {
      options.activeProject = String(value).trim();
    } else if (key === "--fixture") {
      options.fixture = String(value);
    } else if (key === "--json") {
      options.json = String(value);
    } else if (key === "--pr") {
      options.pr = String(value).trim();
    } else if (key === "--producer") {
      options.producer = String(value).trim();
    } else if (key === "--release") {
      options.release = String(value).trim();
    } else if (key === "--repo") {
      options.repo = String(value).trim();
    } else if (key === "--reviewer") {
      options.reviewer = String(value).trim();
    }
  }

  if (options.fixture && options.json) {
    throw new ConductorStepError("Provide only one of --fixture or --json.");
  }
  if (options.syncReviewOutcome && options.release) {
    throw new ConductorStepError("--sync-review-outcome cannot be combined with --release; post-merge Done/Release sync is separate.");
  }
  if (options.syncReviewOutcome && options.reportCandidates) {
    throw new ConductorStepError("--sync-review-outcome cannot be combined with --report-candidates.");
  }

  return options;
}

export function readInputState({ env = process.env, options }) {
  let state;
  if (options.fixture) {
    state = JSON.parse(readFileSync(options.fixture, "utf8"));
  } else if (options.json) {
    state = JSON.parse(options.json);
  } else {
    state = {
      liveConfig: {
        dryRun: options.dryRun,
        pr: options.pr,
        producer: options.producer,
        release: options.release,
        repo: options.repo,
        reviewer: options.reviewer,
        syncReviewOutcome: options.syncReviewOutcome,
      },
      liveMode: true,
      syncOnly: options.syncReviewOutcome,
    };
  }

  const activeProject = options.activeProject || env.TANCHIKI_ACTIVE_LINEAR_PROJECT || "";
  if (activeProject && !state.activeProject) {
    state.activeProject = activeProject;
  }
  if (options.reportCandidates) {
    state.reportCandidates = true;
  }
  if (options.syncReviewOutcome) {
    state.syncOnly = true;
    state.liveConfig = {
      ...normalizeLiveConfig(state.liveConfig),
      syncReviewOutcome: true,
    };
  }
  return state;
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  stderr = console.error,
  stdout = console.log,
} = {}) {
  try {
    const options = parseArgs(argv);
    const state = readInputState({ env, options });
    if (state.reportCandidates === true) {
      const report = state.liveMode
        ? await runLiveCandidateReport({ env, fetchImpl, state })
        : decideCandidateReport(state);
      stdout(formatCandidateReport(report));
      return 0;
    }
    const decision = state.liveMode
      ? await runLiveConductorStep({ env, fetchImpl, state })
      : decideConductorStep(state);
    stdout(formatDecision(decision));
    return 0;
  } catch (error) {
    if (!(error instanceof ConductorStepError) && !(error instanceof SyntaxError)) {
      throw error;
    }
    stderr(`Conductor step failed: ${error.message}`);
    return 1;
  }
}

export async function runLiveConductorStep({ env = process.env, fetchImpl = globalThis.fetch, state }) {
  const normalized = normalizeState(state);
  if (!normalized.activeProject) {
    return stopDecision({
      activeProject: "MISSING",
      evidence: ["Active Linear project was not provided."],
      reason: "missing-active-project",
      nextAction: "Provide --active-project or TANCHIKI_ACTIVE_LINEAR_PROJECT before running a conductor step.",
    });
  }

  const linearToken = env.LINEAR_API_TOKEN || env.LINEAR_API_KEY || "";
  const githubToken = env.GITHUB_TOKEN || env.GH_TOKEN || "";
  if (!linearToken || !githubToken) {
    const missing = [
      !linearToken ? "Linear API token" : "",
      !githubToken ? "GitHub token" : "",
    ].filter(Boolean).join("; ");
    return stopDecision({
      activeProject: normalized.activeProject,
      evidence: [
        "Live Linear/GitHub sync requires auth scoped to this process.",
        `Missing required auth: ${missing}.`,
      ],
      reason: "missing-auth",
      nextAction:
        "Provide auth through the process environment or use --fixture/--json for deterministic validation. Do not print, commit, or write tokens.",
    });
  }

  const config = {
    ...normalized.liveConfig,
    syncReviewOutcome: normalized.syncOnly || normalized.liveConfig.syncReviewOutcome,
  };
  if (config.syncReviewOutcome && config.release) {
    return stopDecision({
      activeProject: normalized.activeProject,
      evidence: ["--sync-review-outcome was combined with post-merge Release metadata."],
      reason: "incompatible-live-mode",
      nextAction: "Run the review-outcome bridge before merge without --release; run post-merge Done/Release sync separately after human merge.",
    });
  }
  const missingMetadata = [
    !config.repo ? "--repo" : "",
    !config.pr ? "--pr" : "",
    !config.producer ? "--producer" : "",
    !config.reviewer ? "--reviewer" : "",
  ].filter(Boolean);
  if (missingMetadata.length > 0) {
    return stopDecision({
      activeProject: normalized.activeProject,
      evidence: [`Missing live sync metadata: ${missingMetadata.join(", ")}.`],
      reason: "missing-live-metadata",
      nextAction:
        "Pass --repo owner/name, --pr number, --producer issue-id, and --reviewer issue-id so live mode cannot guess.",
    });
  }

  if (!fetchImpl) {
    return stopDecision({
      activeProject: normalized.activeProject,
      evidence: ["No fetch implementation is available for live API reads."],
      reason: "api-unavailable",
      nextAction: "Run with a Node runtime that provides fetch, or use fixture mode.",
    });
  }

  const liveStateResult = await readLiveSyncState({ activeProject: normalized.activeProject, config, env, fetchImpl });
  if (liveStateResult.decision) {
    return liveStateResult;
  }

  const decision = decideConductorStep(liveStateResult.state);
  if (!["promote", "sync"].includes(decision.decision) || !decision.proposedMutation || !decision.proposedMutation.linearIssueId || config.dryRun) {
    if (config.dryRun && decision.proposedMutation) {
      return {
        ...decision,
        evidence: [...decision.evidence, "Dry run requested; no Linear mutation was applied."],
        nextAction: "Rerun without --dry-run only when the proposed mutation is the intended single live transition.",
      };
    }
    return decision;
  }

  return applyLiveMutation({ decision, env, fetchImpl });
}

export async function runLiveCandidateReport({ env = process.env, fetchImpl = globalThis.fetch, state }) {
  const normalized = normalizeCandidateReportState(state);
  if (!normalized.activeProject) {
    return candidateReportStop({
      activeProject: "MISSING",
      evidence: ["Active Linear project was not provided."],
      reason: "missing-active-project",
      nextAction: "Provide --active-project or TANCHIKI_ACTIVE_LINEAR_PROJECT before running a candidate report.",
    });
  }

  const linearToken = env.LINEAR_API_TOKEN || env.LINEAR_API_KEY || "";
  if (!linearToken) {
    return candidateReportStop({
      activeProject: normalized.activeProject,
      evidence: [
        "Live candidate reporting requires Linear read auth scoped to this process.",
        "Missing required auth: Linear API token.",
      ],
      reason: "missing-linear-auth",
      nextAction:
        "Provide Linear auth through the process environment or use --fixture/--json for deterministic validation. Do not print, commit, or write tokens.",
    });
  }

  if (!fetchImpl) {
    return candidateReportStop({
      activeProject: normalized.activeProject,
      evidence: ["No fetch implementation is available for live Linear API reads."],
      reason: "api-unavailable",
      nextAction: "Run with a Node runtime that provides fetch, or use fixture mode.",
    });
  }

  try {
    const linear = createLinearClient({ fetchImpl, token: linearToken });
    const issues = await linear.listAutomationReadyIssues(normalized.activeProject);
    return decideCandidateReport({
      activeProject: normalized.activeProject,
      issues: issues.map(normalizeLinearCandidateIssueForReport),
    });
  } catch (error) {
    return candidateReportStop({
      activeProject: normalized.activeProject,
      evidence: [sanitizeErrorMessage(error)],
      reason: "api-unavailable",
      nextAction: "Fix live Linear API access or rerun in --fixture/--json mode.",
    });
  }
}

export class ConductorStepError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConductorStepError";
  }
}

async function readLiveSyncState({ activeProject, config, env, fetchImpl }) {
  try {
    const [owner, repoName] = parseRepo(config.repo);
    const prNumber = Number(config.pr);
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      return stopDecision({
        activeProject,
        evidence: [`Invalid PR number: ${config.pr}.`],
        reason: "missing-live-metadata",
        nextAction: "Pass a positive numeric --pr value.",
      });
    }

    const linear = createLinearClient({ fetchImpl, token: env.LINEAR_API_TOKEN || env.LINEAR_API_KEY });
    const github = createGitHubClient({ fetchImpl, owner, repo: repoName, token: env.GITHUB_TOKEN || env.GH_TOKEN });

    const producerIssue = await linear.getIssue(config.producer);
    const reviewerIssue = await linear.getIssue(config.reviewer);
    const releaseIssue = config.release ? await linear.getIssue(config.release) : null;
    const pr = await github.getPullRequest(prNumber);
    const producerComments = await linear.getIssueComments(producerIssue.id);
    const comments = await linear.getIssueComments(reviewerIssue.id);
    const releaseComments = releaseIssue ? await linear.getIssueComments(releaseIssue.id) : [];
    const automationReadyLabelId = releaseIssue ? await linear.getIssueLabelId("automation-ready") : "";

    if (
      producerIssue.project.name !== activeProject
      || reviewerIssue.project.name !== activeProject
      || (releaseIssue && releaseIssue.project.name !== activeProject)
    ) {
      return stopDecision({
        activeProject,
        evidence: [
          `${producerIssue.identifier} project: ${producerIssue.project.name}.`,
          `${reviewerIssue.identifier} project: ${reviewerIssue.project.name}.`,
          ...(releaseIssue ? [`${releaseIssue.identifier} project: ${releaseIssue.project.name}.`] : []),
        ],
        reason: "wrong-active-project",
        nextAction: "Use issues from the declared active Linear project only.",
      });
    }

    if (!releaseIssue && isDoneState(producerIssue.state?.name) && isDoneState(reviewerIssue.state?.name)) {
      return stopDecision({
        activeProject,
        evidence: [
          `${producerIssue.identifier} and ${reviewerIssue.identifier} are already Done.`,
          "Release issue metadata was not provided.",
        ],
        reason: "missing-release-metadata",
        nextAction: "Pass --release issue-id when asking live mode to promote Release readiness.",
      });
    }

    const reviewCadence = extractReviewCadence(producerIssue.description)
      || extractReviewCadence(reviewerIssue.description)
      || extractReviewCadence(releaseIssue?.description)
      || "paired-review";

    return {
      state: {
        activeProject,
        issues: [
          {
            ...normalizeLinearIssueForState(producerIssue),
            comments: producerComments,
            doneStateId: findTeamStateId(producerIssue, "Done"),
            linkedPrNumber: prNumber,
          },
          {
            ...normalizeLinearIssueForState(reviewerIssue),
            comments,
            doneStateId: findTeamStateId(reviewerIssue, "Done"),
            inReviewStateId: findTeamStateId(reviewerIssue, "In Review"),
          },
          ...(releaseIssue
            ? [{
              ...normalizeLinearIssueForState(releaseIssue),
              automationReadyLabelId,
              comments: releaseComments,
              todoStateId: findTeamStateId(releaseIssue, "Todo"),
            }]
            : []),
        ],
        prs: [pr],
        reviewCadence,
        syncOnly: config.syncReviewOutcome === true,
      },
    };
  } catch (error) {
    return stopDecision({
      activeProject,
      evidence: [sanitizeErrorMessage(error)],
      reason: "api-unavailable",
      nextAction: "Fix live Linear/GitHub API access or rerun in --fixture/--json mode.",
    });
  }
}

async function applyLiveMutation({ decision, env, fetchImpl }) {
  const mutation = decision.proposedMutation;
  const linear = createLinearClient({ fetchImpl, token: env.LINEAR_API_TOKEN || env.LINEAR_API_KEY });
  if (mutation.state && !mutation.stateId) {
    return stopDecision({
      activeProject: decision.activeProject,
      evidence: [`${mutation.issueId} is missing the Linear state id for ${mutation.state}.`],
      reason: "missing-linear-state",
      nextAction: "Fix Linear status metadata before running live sync.",
    });
  }
  if (mutation.addLabels.length > 0 && mutation.labelIds.length === 0) {
    return stopDecision({
      activeProject: decision.activeProject,
      evidence: [`${mutation.issueId} is missing Linear label ids for ${mutation.addLabels.join(", ")}.`],
      reason: "missing-linear-label",
      nextAction: "Fix Linear label metadata before running live sync.",
    });
  }

  try {
    if (mutation.state || mutation.addLabels.length > 0) {
      await linear.updateIssue(mutation.linearIssueId, {
        ...(mutation.state ? { stateId: mutation.stateId } : {}),
        ...(mutation.addLabels.length > 0 ? { labelIds: mutation.labelIds } : {}),
      });
    }
    await linear.createComment(mutation.linearIssueId, mutation.comment);
    return {
      ...decision,
      evidence: [
        ...decision.evidence,
        `Linear mutation applied to ${mutation.issueId}: ${mutation.state || "state unchanged"} plus sync comment.`,
      ],
      nextAction: decision.transition === "reviewer-review-sync"
        ? "Conductor applied the Linear review outcome sync and stopped. Human remains responsible for merge; existing post-merge Done sync remains separate."
        : "Conductor applied exactly one Linear sync transition. Do not merge, run another role, or continue in a loop.",
    };
  } catch (error) {
    return stopDecision({
      activeProject: decision.activeProject,
      evidence: [sanitizeErrorMessage(error)],
      reason: "linear-mutation-failed",
      nextAction: "Inspect the paired Reviewer issue before rerunning; avoid duplicate comments or broader mutation.",
    });
  }
}

function createLinearClient({ fetchImpl, token }) {
  async function graphql(query, variables = {}) {
    const response = await fetchImpl(LINEAR_API_URL, {
      body: JSON.stringify({ query, variables }),
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) {
      throw new ConductorStepError(`Linear API error: ${payload.errors?.[0]?.message || response.status}`);
    }
    return payload.data;
  }

  return {
    async createComment(issueId, body) {
      const data = await graphql(
        `mutation CreateComment($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment { id }
          }
        }`,
        { input: { body, issueId } },
      );
      if (data.commentCreate?.success !== true) {
        throw new ConductorStepError("Linear commentCreate did not report success.");
      }
      return data.commentCreate.comment;
    },
    async getIssue(identifier) {
      const data = await graphql(
        `query GetIssue($id: String!) {
          issue(id: $id) {
            id
            identifier
            title
            description
            url
            state { id name type }
            project { name }
            labels { nodes { id name } }
            relations(first: 50) {
              nodes {
                type
                relatedIssue { identifier title state { name type } }
              }
            }
            inverseRelations(first: 50) {
              nodes {
                type
                issue { identifier title state { name type } }
              }
            }
            team {
              states {
                nodes { id name type }
              }
            }
          }
        }`,
        { id: identifier },
      );
      if (!data.issue) {
        throw new ConductorStepError(`Linear issue not found: ${identifier}`);
      }
      return data.issue;
    },
    async getIssueLabelId(name) {
      const data = await graphql(
        `query GetIssueLabel($name: String!) {
          issueLabels(filter: { name: { eq: $name } }, first: 1) {
            nodes { id name }
          }
        }`,
        { name },
      );
      return data.issueLabels?.nodes?.find((label) => label.name === name)?.id || "";
    },
    async getIssueComments(issueId) {
      const data = await graphql(
        `query GetIssueComments($id: String!) {
          issue(id: $id) {
            comments(first: 50) {
              nodes { id body }
            }
          }
        }`,
        { id: issueId },
      );
      return data.issue?.comments?.nodes || [];
    },
    async listAutomationReadyIssues(activeProject) {
      const data = await graphql(
        `query ReportAutomationReadyIssues($activeProject: String!, $automationReady: String!) {
          issues(
            filter: {
              project: { name: { eq: $activeProject } }
              labels: { name: { eq: $automationReady } }
            }
            first: 100
          ) {
            nodes {
              id
              identifier
              title
              url
              state { id name type }
              project { name }
              labels { nodes { id name } }
              relations(first: 50) {
                nodes {
                  type
                  relatedIssue {
                    identifier
                    title
                    state { name type }
                  }
                }
              }
              inverseRelations(first: 50) {
                nodes {
                  type
                  issue {
                    identifier
                    title
                    state { name type }
                  }
                }
              }
            }
          }
        }`,
        { activeProject, automationReady: AUTOMATION_READY_LABEL },
      );
      return data.issues?.nodes || [];
    },
    async updateIssue(issueId, input) {
      const data = await graphql(
        `mutation UpdateIssueState($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id }
          }
        }`,
        { id: issueId, input },
      );
      if (data.issueUpdate?.success !== true) {
        throw new ConductorStepError("Linear issueUpdate did not report success.");
      }
      return data.issueUpdate.issue;
    },
    async updateIssueState(issueId, stateId) {
      return this.updateIssue(issueId, { stateId });
    },
  };
}

function createGitHubClient({ fetchImpl, owner, repo, token }) {
  async function get(path) {
    const response = await fetchImpl(`${GITHUB_API_URL}${path}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new ConductorStepError(`GitHub API error: ${payload.message || response.status}`);
    }
    return payload;
  }

  return {
    async getPullRequest(number) {
      const pull = await get(`/repos/${owner}/${repo}/pulls/${number}`);
      const reviews = await get(`/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`);
      const checkReadiness = await getCommitReadiness({ get, owner, pull, repo });
      return {
        baseRefName: pull.base?.ref || "",
        checks: checkReadiness.checks,
        draft: pull.draft === true,
        headSha: pull.head?.sha || "",
        labels: normalizeLabels(pull.labels || []),
        linkedIssueIds: [],
        merged: pull.merged === true,
        metadata: checkReadiness.metadata,
        number: pull.number,
        reviews: reviews.map(normalizeReview),
        state: pull.state,
        url: pull.html_url,
      };
    },
  };
}

async function getCommitReadiness({ get, pull }) {
  const sha = pull.head?.sha || "";
  if (!sha) {
    return { checks: "missing", metadata: "missing" };
  }

  const checkPayload = await get(`/repos/${pull.base.repo.full_name}/commits/${sha}/check-runs?per_page=100`);
  const runs = checkPayload.check_runs || [];
  const metadataRun = runs.find((run) => run.name === "Required PR body sections");
  const nonMetadataRuns = runs.filter((run) => run.name !== "Required PR body sections");

  return {
    checks: normalizeCheckRuns(nonMetadataRuns),
    metadata: metadataRun ? normalizeCheckRuns([metadataRun]) : "missing",
  };
}

function normalizeCheckRuns(runs) {
  if (runs.length === 0) {
    return "missing";
  }
  const failing = runs.find((run) => {
    if (run.status !== "completed") {
      return true;
    }
    return !["success", "neutral", "skipped"].includes(run.conclusion);
  });
  return failing ? (failing.conclusion || failing.status || "pending") : "passing";
}

function normalizeLinearIssueForState(issue) {
  const labelNodes = issue.labels?.nodes || [];
  return {
    blockedBy: extractLinearBlockedBy(issue).map((blocker) => blocker.id).filter(Boolean),
    blocks: extractLinearBlocks(issue).map((blocked) => blocked.id).filter(Boolean),
    id: issue.identifier,
    labelIds: labelNodes.map((label) => label.id).filter(Boolean),
    labels: normalizeLabels(labelNodes),
    linearId: issue.id,
    project: issue.project?.name || "",
    status: issue.state?.name || "",
    title: issue.title || "",
  };
}

function findTeamStateId(issue, name) {
  return issue.team?.states?.nodes?.find((state) => state.name === name)?.id || "";
}

function extractReviewCadence(text = "") {
  const match = text.match(/review_cadence:\s*(paired-review|final-audit|let-architect-decide)/);
  return match?.[1] || "";
}

function parseRepo(repo) {
  const parts = String(repo).split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ConductorStepError(`Invalid repo: ${repo}. Expected owner/name.`);
  }
  return parts;
}

function sanitizeErrorMessage(error) {
  const message = error?.message || String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/Authorization:\s*[^\s]+/gi, "Authorization: [redacted]");
}

function findProducerPrReadyTransitions(state, blockedTransitions) {
  if (state.reviewCadence !== "paired-review") {
    return [];
  }

  const transitions = [];
  for (const producer of state.issues.filter(isProducerIssue)) {
    if (isTerminalIssue(producer)) {
      continue;
    }

    const reviewer = findPairedReviewer(state.issues, producer);
    if (!reviewer || isTerminalIssue(reviewer) || hasAutomationReady(reviewer) || getReviewResult(reviewer)) {
      continue;
    }

    const pr = findLinkedPr(state.prs, producer);
    const blocker = getProducerPrReadinessBlocker({ pr, producer, reviewer });
    if (blocker) {
      blockedTransitions.push(blocker);
      continue;
    }

    const metadataBlocker = getMetadataBlocker(reviewer);
    if (metadataBlocker) {
      blockedTransitions.push(`${formatIssue(reviewer)}: ${metadataBlocker}`);
      continue;
    }
    if (hasReviewerBotReview(pr)) {
      blockedTransitions.push(`PR #${pr.number} already has a tanchiki-reviewer[bot] review; sync or triage that review before Reviewer promotion.`);
      continue;
    }

    transitions.push({
      activeProject: state.activeProject,
      decision: "promote",
      evidence: [
        `${formatIssue(producer)} has open PR #${pr.number}.`,
        "PR is open, non-draft, unmerged, metadata-ready, and checks are passing.",
        `${formatIssue(reviewer)} is the blocked paired Reviewer issue.`,
      ],
      nextAction: `Run the paired Reviewer for ${formatIssue(reviewer)} after applying the proposed promotion.`,
      proposedMutation: {
        addLabels: ["automation-ready"],
        comment: `Promoted as paired-review Reviewer for open PR #${pr.number}.`,
        issueId: reviewer.id,
        state: "Todo",
      },
      reason: "producer-pr-ready",
      targetIssue: reviewer,
      transition: "producer-pr-ready",
    });
  }

  return transitions;
}

function findReviewerReviewSyncTransitions(state, blockedTransitions) {
  if (state.reviewCadence !== "paired-review") {
    return [];
  }

  const transitions = [];
  for (const producer of state.issues.filter(isProducerIssue)) {
    if (isTerminalIssue(producer)) {
      continue;
    }

    const reviewer = findPairedReviewer(state.issues, producer);
    if (!reviewer) {
      blockedTransitions.push(`${formatIssue(producer)} has no paired Reviewer issue to sync.`);
      continue;
    }
    if (isTerminalIssue(reviewer)) {
      blockedTransitions.push(`${formatIssue(reviewer)} is terminal and cannot receive a pre-merge review outcome sync.`);
      continue;
    }

    const pr = findLinkedPr(state.prs, producer);
    const readinessBlocker = getProducerPrReadinessBlocker({ pr, producer, reviewer });
    if (readinessBlocker) {
      blockedTransitions.push(readinessBlocker);
      continue;
    }

    const metadataBlocker = getMetadataBlocker(reviewer);
    if (metadataBlocker) {
      blockedTransitions.push(`${formatIssue(reviewer)}: ${metadataBlocker}`);
      continue;
    }

    const reviewSelection = selectReviewerBotReview({ pr, reviewer });
    if (reviewSelection.blocker) {
      blockedTransitions.push(reviewSelection.blocker);
      continue;
    }

    const comment = buildReviewerSyncComment({
      activeProject: state.activeProject,
      decision: reviewSelection.decision,
      pr,
      review: reviewSelection.review,
    });

    transitions.push({
      activeProject: state.activeProject,
      decision: "sync",
      evidence: [
        `${formatIssue(producer)} has linked PR #${pr.number}.`,
        "PR is open, non-draft, unmerged, targets main, metadata-ready, and checks are passing.",
        `${formatIssue(reviewer)} is the paired Reviewer issue.`,
        `Valid Reviewer App review by ${reviewSelection.review.authorLogin}: ${reviewSelection.decision}.`,
        "Bridge mode records the Linear paired-review outcome only.",
      ],
      nextAction:
        "Apply the Linear review outcome sync, then stop. Human remains responsible for merge; existing Conductor post-merge Done sync remains separate.",
      proposedMutation: {
        addLabels: [],
        comment,
        issueId: reviewer.id,
        linearIssueId: reviewer.linearId || reviewer.id,
        state: reviewer.status === "In Review" ? "" : "In Review",
        stateId: reviewer.inReviewStateId || "",
      },
      reason: "valid-reviewer-bot-review",
      targetIssue: reviewer,
      transition: "reviewer-review-sync",
    });
  }

  return transitions;
}

function findReviewerCompletedTransitions(state) {
  const transitions = [];
  for (const reviewer of state.issues.filter((issue) => getRole(issue) === "reviewer")) {
    if (isTerminalIssue(reviewer) || !getReviewResult(reviewer)) {
      continue;
    }

    const producer = findIssue(state.issues, reviewer.producerId);
    const pr = producer ? findLinkedPr(state.prs, producer) : findLinkedPr(state.prs, reviewer);
    if (!pr || pr.state !== "open" || pr.merged === true) {
      continue;
    }

    transitions.push({
      activeProject: state.activeProject,
      decision: "comment",
      evidence: [
        `${formatIssue(reviewer)} recorded review result: ${getReviewResult(reviewer)}.`,
        `PR #${pr.number} is still open.`,
        "Conductor v1 records state only and does not merge.",
      ],
      nextAction: "Human or normal merge process decides the PR outcome; Conductor must not merge.",
      proposedMutation: {
        addLabels: [],
        comment: `Reviewer result recorded for PR #${pr.number}: ${getReviewResult(reviewer)}. Conductor does not merge.`,
        issueId: reviewer.id,
        state: "",
      },
      reason: "reviewer-completed-pr-open",
      targetIssue: reviewer,
      transition: "reviewer-completed",
    });
  }
  return transitions;
}

function findHumanMergeCompleteTransitions(state, blockedTransitions) {
  if (state.reviewCadence !== "paired-review") {
    return [];
  }

  const transitions = [];
  for (const producer of state.issues.filter(isProducerIssue)) {
    const reviewer = findPairedReviewer(state.issues, producer);
    const pr = findLinkedPr(state.prs, producer);
    if (!pr) {
      continue;
    }

    if (pr.closedUnmerged || (pr.state === "closed" && pr.merged !== true)) {
      blockedTransitions.push(`PR #${pr.number} is closed without merge.`);
      continue;
    }

    if (!pr.merged) {
      continue;
    }

    if (!reviewer) {
      blockedTransitions.push(`${formatIssue(producer)} has merged PR #${pr.number}, but no paired Reviewer issue was found.`);
      continue;
    }

    const producerBlocker = getMetadataBlocker(producer);
    if (producerBlocker) {
      blockedTransitions.push(`${formatIssue(producer)}: ${producerBlocker}`);
      continue;
    }

    const reviewerBlocker = getMetadataBlocker(reviewer);
    if (reviewerBlocker) {
      blockedTransitions.push(`${formatIssue(reviewer)}: ${reviewerBlocker}`);
      continue;
    }

    const reviewResult = getReviewResult(reviewer);
    if (!reviewResult) {
      blockedTransitions.push(`PR #${pr.number} is merged, but ${formatIssue(reviewer)} has no recorded paired-review outcome.`);
      continue;
    }

    if (!isMergeAllowedReviewResult(reviewResult)) {
      blockedTransitions.push(`${formatIssue(reviewer)} recorded ${reviewResult}; Conductor cannot mark Done for merged PR #${pr.number}.`);
      continue;
    }

    if (isTerminalIssue(producer) && isTerminalIssue(reviewer)) {
      continue;
    }

    if (!isTerminalIssue(producer)) {
      if (hasDoneSyncComment(producer, "producer", pr)) {
        blockedTransitions.push(`${formatIssue(producer)} already has a producer Done sync comment for PR #${pr.number}.`);
        continue;
      }

      transitions.push({
        activeProject: state.activeProject,
        decision: "sync",
        evidence: [
          `PR #${pr.number} is merged.`,
          `${formatIssue(reviewer)} recorded paired-review result: ${reviewResult}.`,
          `${formatIssue(producer)} is not Done.`,
        ],
        nextAction:
          "Apply the producer Done sync, then rerun conductor for the paired Reviewer Done sync.",
        proposedMutation: {
          addLabels: [],
          comment: buildDoneSyncComment({
            activeProject: state.activeProject,
            issueRole: "producer",
            pr,
            reviewResult,
          }),
          issueId: producer.id,
          labelIds: [],
          linearIssueId: producer.linearId || producer.id,
          state: "Done",
          stateId: producer.doneStateId || "",
        },
        reason: "producer-merged-pr-done-sync",
        targetIssue: producer,
        transition: "producer-done-sync",
      });
      continue;
    }

    if (!isTerminalIssue(reviewer)) {
      if (hasDoneSyncComment(reviewer, "reviewer", pr)) {
        blockedTransitions.push(`${formatIssue(reviewer)} already has a reviewer Done sync comment for PR #${pr.number}.`);
        continue;
      }

      transitions.push({
        activeProject: state.activeProject,
        decision: "sync",
        evidence: [
          `PR #${pr.number} is merged.`,
          `${formatIssue(producer)} is Done.`,
          `${formatIssue(reviewer)} recorded paired-review result: ${reviewResult}.`,
        ],
        nextAction:
          "Apply the paired Reviewer Done sync, then rerun conductor for Release readiness.",
        proposedMutation: {
          addLabels: [],
          comment: buildDoneSyncComment({
            activeProject: state.activeProject,
            issueRole: "reviewer",
            pr,
            reviewResult,
          }),
          issueId: reviewer.id,
          labelIds: [],
          linearIssueId: reviewer.linearId || reviewer.id,
          state: "Done",
          stateId: reviewer.doneStateId || "",
        },
        reason: "reviewer-merged-pr-done-sync",
        targetIssue: reviewer,
        transition: "reviewer-done-sync",
      });
    }
  }
  return transitions;
}

function findReleaseReadyTransitions(state) {
  const releaseIssues = state.issues.filter((issue) => getRole(issue) === "release" && !isTerminalIssue(issue));
  if (releaseIssues.length === 0) {
    return [];
  }

  const upstream = state.issues.filter((issue) => getRole(issue) !== "release");
  const upstreamComplete = upstream.length > 0 && upstream.every(isTerminalOrAbandoned);
  if (!upstreamComplete) {
    return [];
  }

  return releaseIssues.map((release) => {
    const metadataBlocker = getMetadataBlocker(release);
    if (metadataBlocker) {
      return stopDecision({
        activeProject: state.activeProject,
        evidence: [`${formatIssue(release)}: ${metadataBlocker}`],
        reason: "release-metadata-blocked",
        nextAction: "Fix release issue metadata before promotion.",
      });
    }

    return {
      activeProject: state.activeProject,
      decision: "promote",
      evidence: [
        "All upstream producer/reviewer issues are Done or explicitly abandoned.",
        `${formatIssue(release)} is the Release issue.`,
      ],
      nextAction: `Run Release for ${formatIssue(release)} after applying the proposed promotion.`,
      proposedMutation: {
        addLabels: ["automation-ready"],
        comment: "Promoted Release issue after upstream producer/reviewer outcomes were recorded.",
        issueId: release.id,
        labelIds: getLabelIdsWithAddedLabel(release, release.automationReadyLabelId),
        linearIssueId: release.linearId || release.id,
        state: "Todo",
        stateId: release.todoStateId || "",
      },
      reason: "release-ready",
      targetIssue: release,
      transition: "release-ready",
    };
  });
}

function getProducerPrReadinessBlocker({ pr, producer, reviewer }) {
  if (!pr) {
    return `${formatIssue(producer)} blocks ${formatIssue(reviewer)}: missing linked PR.`;
  }
  if (hasStopLabel(producer)) {
    return `${formatIssue(producer)} has stop or human-gate labels: ${matchingLabels(producer.labels, STOP_LABELS).join(", ")}.`;
  }
  if (hasStopLabel(reviewer)) {
    return `${formatIssue(reviewer)} has stop or human-gate labels: ${matchingLabels(reviewer.labels, STOP_LABELS).join(", ")}.`;
  }
  if (hasStopLabel(pr)) {
    return `PR #${pr.number} has stop labels: ${matchingLabels(pr.labels, STOP_LABELS).join(", ")}.`;
  }
  if (pr.closedUnmerged || (pr.state === "closed" && pr.merged !== true)) {
    return `PR #${pr.number} is closed without merge.`;
  }
  if (pr.state !== "open") {
    return `PR #${pr.number} is not open: ${pr.state || "UNKNOWN"}.`;
  }
  if (pr.draft === true) {
    return `PR #${pr.number} is still Draft. In paired-review mode, the producer must mark the PR ready for review before the Reviewer issue can run.`;
  }
  if (pr.merged === true) {
    return `PR #${pr.number} is already merged; paired-review promotion requires an open PR.`;
  }
  if (pr.baseRefName && pr.baseRefName !== "main") {
    return `PR #${pr.number} targets ${pr.baseRefName}; expected main.`;
  }
  if (!isPassing(pr.checks)) {
    return `PR #${pr.number} checks are not passing: ${formatReadiness(pr.checks)}.`;
  }
  if (!isPassing(pr.metadata)) {
    return `PR #${pr.number} metadata is not passing: ${formatReadiness(pr.metadata)}.`;
  }
  return "";
}

function selectReviewerBotReview({ pr, reviewer }) {
  const reviews = normalizeList(pr.reviews);
  if (reviews.length === 0) {
    return { blocker: `PR #${pr.number} has no reviews to sync.` };
  }

  const botReviews = reviews.filter((review) => isReviewerBotLogin(review.authorLogin));
  if (botReviews.length === 0) {
    return {
      blocker: `PR #${pr.number} has no review by tanchiki-reviewer[bot]; review actors: ${reviews.map((review) => review.authorLogin || "UNKNOWN").join(", ")}.`,
    };
  }

  const validReviews = [];
  const blockers = [];
  for (const review of botReviews) {
    const decisionResult = extractPairedReviewDecision(review.body);
    if (decisionResult.blocker) {
      blockers.push(`Review ${formatReviewId(review)}: ${decisionResult.blocker}`);
      continue;
    }
    if (!pr.headSha || !review.commitId) {
      blockers.push(`Review ${formatReviewId(review)} is missing PR head SHA or review commit SHA.`);
      continue;
    }
    if (review.commitId !== pr.headSha) {
      blockers.push(`Review ${formatReviewId(review)} is stale: ${review.commitId} does not match current PR head ${pr.headSha}.`);
      continue;
    }
    if (isReviewAlreadySynced(reviewer, review)) {
      blockers.push(`Review ${formatReviewId(review)} was already synced to ${formatIssue(reviewer)}.`);
      continue;
    }
    validReviews.push({ decision: decisionResult.decision, review });
  }

  if (validReviews.length > 1) {
    return {
      blocker: `PR #${pr.number} has multiple valid tanchiki-reviewer[bot] reviews; stop for human triage.`,
    };
  }
  if (validReviews.length === 1) {
    return validReviews[0];
  }

  return {
    blocker: blockers[0] || `PR #${pr.number} has no valid tanchiki-reviewer[bot] review to sync.`,
  };
}

function hasReviewerBotReview(pr) {
  return normalizeList(pr.reviews).some((review) => isReviewerBotLogin(review.authorLogin));
}

function extractPairedReviewDecision(body = "") {
  const text = String(body);
  const matches = PAIRED_REVIEW_DECISION_ALIASES
    .filter(([, aliases]) => aliases.some((alias) => hasDecisionAlias(text, alias)))
    .map(([decision]) => decision);
  if (matches.length !== 1) {
    return {
      blocker: `review body must contain exactly one paired-review decision; found ${matches.length}.`,
    };
  }
  return { decision: matches[0] };
}

function hasDecisionAlias(text, alias) {
  const escaped = escapeRegExp(alias);
  const pattern = new RegExp(`(^|[^A-Z0-9_])${escaped}([^A-Z0-9_]|$)`);
  return pattern.test(text);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isReviewerBotLogin(login = "") {
  return REVIEWER_BOT_LOGINS.includes(String(login).toLowerCase());
}

function isReviewAlreadySynced(reviewer, review) {
  const reviewId = formatReviewId(review);
  if (reviewer.syncedReviewIds.includes(reviewId) || reviewer.syncedReviewIds.includes(review.id)) {
    return true;
  }
  return reviewer.comments.some((comment) => {
    const body = comment.body || "";
    return body.includes(`Conductor live sync review id: ${reviewId}`)
      || (review.htmlUrl && body.includes(review.htmlUrl));
  });
}

function buildReviewerSyncComment({ activeProject, decision, pr, review }) {
  return [
    "## Conductor Live Sync",
    "",
    `Active Linear project: ${activeProject}`,
    `PR: #${pr.number} ${pr.url || ""}`.trim(),
    `Review actor: ${review.authorLogin}`,
    `Review state: ${review.state || "UNKNOWN"}`,
    `Decision: ${decision}`,
    `Conductor live sync review id: ${formatReviewId(review)}`,
    `Review URL: ${review.htmlUrl || "unavailable"}`,
    `Head SHA: ${pr.headSha}`,
    "Checks/metadata: passing",
    "",
    "Synced the paired Reviewer issue to `In Review` and recorded the Reviewer App decision.",
    "Next action: stop. Human remains responsible for merge. Existing Conductor post-merge Done sync remains separate.",
    "Conductor did not merge, mark Done, apply labels, remove labels, remove stop labels, submit a review, run another role, or continue in a loop.",
  ].join("\n");
}

function buildDoneSyncComment({ activeProject, issueRole, pr, reviewResult }) {
  return [
    "## Conductor Done Sync",
    "",
    `Active Linear project: ${activeProject}`,
    `PR: #${pr.number} ${pr.url || ""}`.trim(),
    `Merged: ${pr.merged === true ? "yes" : "unknown"}`,
    `Review result: ${reviewResult}`,
    `Conductor done sync target: ${issueRole}`,
    "",
    `Synced the ${issueRole} issue to \`Done\` after the linked PR was merged and the paired-review outcome was recorded.`,
    "Next action: rerun conductor for the next single transition. Conductor did not merge, apply GitHub labels, remove stop labels, run another role, or continue in a loop.",
  ].join("\n");
}

function hasDoneSyncComment(issue, issueRole, pr) {
  return issue.comments.some((comment) => {
    const body = comment.body || "";
    return body.includes("## Conductor Done Sync")
      && body.includes(`Conductor done sync target: ${issueRole}`)
      && body.includes(`PR: #${pr.number}`);
  });
}

function isMergeAllowedReviewResult(result = "") {
  const text = String(result).trim();
  return text === "APPROVED_FOR_MERGE" || text === "APPROVED FOR MERGE";
}

function formatReviewId(review) {
  return String(review.id || review.htmlUrl || review.commitId || "UNKNOWN");
}

function getMetadataBlocker(issue) {
  const groups = [
    ["role", matchingLabels(issue.labels, ROLE_LABELS), "role:*"],
    ["type", matchingLabels(issue.labels, TYPE_LABELS), "type:*"],
    ["risk", matchingLabels(issue.labels, RISK_LABELS), "risk:*"],
    ["validation", matchingLabels(issue.labels, VALIDATION_LABELS), "validation:*"],
  ];

  for (const [name, labels, pattern] of groups) {
    if (labels.length !== 1) {
      return `${name} metadata must have exactly one ${pattern}; found ${labels.length || "none"}.`;
    }
  }
  if (hasStopLabel(issue)) {
    return `stop or human-gate labels present: ${matchingLabels(issue.labels, STOP_LABELS).join(", ")}.`;
  }
  return "";
}

function normalizeCandidateReportState(input) {
  const campaign = input.campaign || {};
  return {
    activeProject: String(input.activeProject || campaign.activeProject || "").trim(),
    activeProjectAmbiguous: input.activeProjectAmbiguous === true,
    activeProjects: normalizeList(input.activeProjects || campaign.activeProjects),
    issues: normalizeList(input.issues).map(normalizeCandidateIssue),
  };
}

function normalizeCandidateIssue(issue) {
  const state = issue.state && typeof issue.state === "object" ? issue.state : {};
  const project = issue.project && typeof issue.project === "object" ? issue.project.name : issue.project;
  const id = String(issue.identifier || issue.id || issue.key || "").trim();
  return {
    ...issue,
    blockedBy: normalizeCandidateBlockers(issue.blockedBy || issue.blockers || issue.blocked_by),
    id,
    labels: normalizeLabels(issue.labels),
    project: String(project || "").trim(),
    status: String(issue.status || state.name || issue.stateName || "").trim(),
    statusType: String(issue.statusType || issue.stateType || state.type || "").trim(),
    title: issue.title || "",
  };
}

function normalizeCandidateBlockers(blockers = []) {
  return normalizeList(blockers).map((blocker) => {
    if (typeof blocker === "string") {
      return {
        id: blocker,
        status: "",
        statusType: "",
        title: "",
      };
    }
    const state = blocker.state && typeof blocker.state === "object" ? blocker.state : {};
    return {
      id: String(blocker.identifier || blocker.id || blocker.key || "").trim(),
      status: String(blocker.status || state.name || blocker.stateName || "").trim(),
      statusType: String(blocker.statusType || blocker.stateType || state.type || "").trim(),
      title: blocker.title || "",
    };
  });
}

function normalizeLinearCandidateIssueForReport(issue) {
  return {
    blockedBy: extractLinearBlockedBy(issue),
    id: issue.identifier,
    labels: normalizeLabels(issue.labels?.nodes || []),
    project: issue.project?.name || "",
    status: issue.state?.name || "",
    statusType: issue.state?.type || "",
    title: issue.title || "",
  };
}

function extractLinearBlockedBy(issue) {
  const blockers = [];
  for (const relation of issue.relations?.nodes || []) {
    if (isBlockedByRelationType(relation.type) && relation.relatedIssue) {
      blockers.push(normalizeCandidateBlockerFromLinearIssue(relation.relatedIssue));
    }
  }
  for (const relation of issue.inverseRelations?.nodes || []) {
    if (isBlockingRelationType(relation.type) && relation.issue) {
      blockers.push(normalizeCandidateBlockerFromLinearIssue(relation.issue));
    }
  }
  return blockers;
}

function extractLinearBlocks(issue) {
  const blocked = [];
  for (const relation of issue.relations?.nodes || []) {
    if (isBlockingRelationType(relation.type) && relation.relatedIssue) {
      blocked.push(normalizeCandidateBlockerFromLinearIssue(relation.relatedIssue));
    }
  }
  for (const relation of issue.inverseRelations?.nodes || []) {
    if (isBlockedByRelationType(relation.type) && relation.issue) {
      blocked.push(normalizeCandidateBlockerFromLinearIssue(relation.issue));
    }
  }
  return blocked;
}

function normalizeCandidateBlockerFromLinearIssue(issue) {
  return {
    id: issue.identifier || "",
    status: issue.state?.name || "",
    statusType: issue.state?.type || "",
    title: issue.title || "",
  };
}

function isBlockedByRelationType(type = "") {
  const normalized = String(type).toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "blockedby" || normalized === "isblockedby";
}

function isBlockingRelationType(type = "") {
  const normalized = String(type).toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "blocks" || normalized === "isblocking";
}

function classifyCandidateIssue(issue, activeProject) {
  const metadata = getCandidateMetadata(issue);
  const blockers = issue.blockedBy.filter((blocker) => !isResolvedCandidateBlocker(blocker));
  const summary = {
    blockers: blockers.map((blocker) => blocker.id || blocker.title || "UNKNOWN"),
    id: issue.id,
    labels: issue.labels,
    metadata,
    status: issue.status,
    statusType: issue.statusType,
    title: issue.title,
  };

  if (isCompletedCandidate(issue)) {
    return {
      ...summary,
      classification: "completed",
      nextSafeAction: "Ignore historical completed automation-ready issue; no Dispatcher action.",
      reason: `${issue.id} is already completed, so its automation-ready label is historical and ignored.`,
    };
  }

  if (isCanceledCandidate(issue)) {
    return {
      ...summary,
      classification: "canceled",
      nextSafeAction: "Ignore terminal canceled automation-ready issue; no Dispatcher action.",
      reason: `${issue.id} is canceled or abandoned, so it is not an active candidate.`,
    };
  }

  if (!issue.project || issue.project !== activeProject) {
    return {
      ...summary,
      classification: "unsafe",
      nextSafeAction: "Do not run Dispatcher; triage project membership before exposing this issue.",
      reason: `${issue.id} is not confirmed in the active project.`,
    };
  }

  if (!issue.status || !issue.statusType) {
    return {
      ...summary,
      classification: "unsafe",
      nextSafeAction: "Do not run Dispatcher; restore deterministic Linear status metadata first.",
      reason: `${issue.id} is missing status or status type metadata.`,
    };
  }

  const metadataBlocker = getCandidateMetadataBlocker(issue);
  if (metadataBlocker) {
    return {
      ...summary,
      classification: "unsafe",
      nextSafeAction: "Do not run Dispatcher; fix Level 5 metadata before exposing this issue.",
      reason: `${issue.id}: ${metadataBlocker}`,
    };
  }

  const stopLabels = matchingLabels(issue.labels, STOP_LABELS);
  if (stopLabels.length > 0) {
    return {
      ...summary,
      classification: "unsafe",
      nextSafeAction: "Do not run Dispatcher; human or Planner/Groomer must resolve the stop labels.",
      reason: `${issue.id} has stop or human-gate labels: ${stopLabels.join(", ")}.`,
    };
  }

  if (isCampaignUmbrella(issue)) {
    return {
      ...summary,
      classification: "unsafe",
      nextSafeAction: "Do not run Dispatcher; expose a concrete role issue instead.",
      reason: `${issue.id} appears to be a parent or campaign umbrella issue.`,
    };
  }

  if (blockers.length > 0) {
    return {
      ...summary,
      classification: "blocked",
      nextSafeAction: "Do not run Dispatcher; resolve the listed Linear blocked-by relation first.",
      reason: `${issue.id} has unresolved blocker(s): ${blockers.map((blocker) => blocker.id || "UNKNOWN").join(", ")}.`,
    };
  }

  if (issue.status === ACTIVE_CANDIDATE_STATUS && issue.statusType === ACTIVE_CANDIDATE_STATUS_TYPE) {
    return {
      ...summary,
      classification: "active",
      nextSafeAction: `Run Dispatcher for ${issue.id} (${metadata.role}).`,
      reason: `${issue.id} is Todo, unstarted, in the active project, and has exact Level 5 metadata.`,
    };
  }

  return {
    ...summary,
    classification: "unsafe",
    nextSafeAction: "Do not run Dispatcher; queue state is not a safe active candidate.",
    reason: `${issue.id} has non-candidate status ${issue.status} (${issue.statusType}).`,
  };
}

function candidateReportStop({ activeProject, evidence, nextAction, reason }) {
  return {
    activeProject,
    candidates: [],
    decision: "report",
    evidence,
    nextAction,
    readOnly: true,
    reason,
  };
}

function getCandidateMetadata(issue) {
  return {
    role: labelSuffix(matchingLabels(issue.labels, ROLE_LABELS)[0], "role:"),
    risk: labelSuffix(matchingLabels(issue.labels, RISK_LABELS)[0], "risk:"),
    type: labelSuffix(matchingLabels(issue.labels, TYPE_LABELS)[0], "type:"),
    validation: labelSuffix(matchingLabels(issue.labels, VALIDATION_LABELS)[0], "validation:"),
  };
}

function getCandidateMetadataBlocker(issue) {
  const groups = [
    ["role", matchingLabels(issue.labels, ROLE_LABELS), "role:*"],
    ["type", matchingLabels(issue.labels, TYPE_LABELS), "type:*"],
    ["risk", matchingLabels(issue.labels, RISK_LABELS), "risk:*"],
    ["validation", matchingLabels(issue.labels, VALIDATION_LABELS), "validation:*"],
  ];
  for (const [name, labels, pattern] of groups) {
    if (labels.length !== 1) {
      return `${name} metadata must have exactly one ${pattern}; found ${labels.length || "none"}.`;
    }
  }
  return "";
}

function labelSuffix(label = "", prefix = "") {
  return label.startsWith(prefix) ? label.slice(prefix.length) : "";
}

function isCompletedCandidate(issue) {
  return issue.statusType === "completed" || issue.status === "Done";
}

function isCanceledCandidate(issue) {
  return issue.statusType === "canceled" || CANCELED_STATUSES.includes(issue.status);
}

function isResolvedCandidateBlocker(blocker) {
  return isCompletedCandidate(blocker) || isCanceledCandidate(blocker);
}

function isCampaignUmbrella(issue) {
  if (issue.isParent === true || issue.isCampaignUmbrella === true || Number(issue.childCount || 0) > 0) {
    return true;
  }
  return normalizeList(issue.children).length > 0;
}

function compareIssuesById(a, b) {
  return String(a.id || "").localeCompare(String(b.id || ""), undefined, { numeric: true });
}

function normalizeState(input) {
  const campaign = input.campaign || {};
  return {
    activeProject: String(input.activeProject || campaign.activeProject || "").trim(),
    activeProjectAmbiguous: input.activeProjectAmbiguous === true,
    activeProjects: normalizeList(input.activeProjects || campaign.activeProjects),
    issues: normalizeList(input.issues).map(normalizeIssue),
    liveConfig: normalizeLiveConfig(input.liveConfig),
    liveMode: input.liveMode === true,
    prs: normalizeList(input.prs || input.pullRequests).map(normalizePr),
    reviewCadence: normalizeCadence(input.reviewCadence || input.review_cadence || campaign.reviewCadence),
    syncOnly: input.syncOnly === true,
  };
}

function normalizeIssue(issue) {
  const comments = normalizeList(issue.comments).map(normalizeComment);
  return {
    ...issue,
    blockedBy: normalizeList(issue.blockedBy || issue.blockers),
    blocks: normalizeList(issue.blocks),
    comments,
    labels: normalizeLabels(issue.labels),
    outcome: issue.outcome || "",
    reviewResult: issue.reviewResult || issue.githubReviewResult || issue.review_result || extractRecordedReviewResult(comments),
    status: issue.status || issue.state || "",
    syncedReviewIds: normalizeList(issue.syncedReviewIds || issue.syncedReviews),
  };
}

function normalizePr(pr) {
  return {
    ...pr,
    baseRefName: pr.baseRefName || pr.baseRef || pr.base || "",
    headSha: pr.headSha || pr.headSHA || pr.sha || "",
    labels: normalizeLabels(pr.labels),
    linkedIssueIds: normalizeList(pr.linkedIssueIds || pr.issues || pr.issueIds),
    reviews: normalizeList(pr.reviews).map(normalizeReview),
    state: pr.state || "unknown",
  };
}

function normalizeLiveConfig(config = {}) {
  return {
    dryRun: config.dryRun === true,
    pr: String(config.pr || "").trim(),
    producer: String(config.producer || "").trim(),
    release: String(config.release || "").trim(),
    repo: String(config.repo || "").trim(),
    reviewer: String(config.reviewer || "").trim(),
    syncReviewOutcome: config.syncReviewOutcome === true,
  };
}

function normalizeComment(comment) {
  if (typeof comment === "string") {
    return { body: comment };
  }
  return {
    body: comment.body || "",
    id: comment.id || "",
    url: comment.url || "",
  };
}

function normalizeReview(review) {
  return {
    authorLogin: review.authorLogin || review.login || review.author?.login || review.user?.login || "",
    body: review.body || "",
    commitId: review.commitId || review.commit_id || review.sha || "",
    htmlUrl: review.htmlUrl || review.html_url || review.url || "",
    id: String(review.id || review.node_id || ""),
    state: review.state || "",
    submittedAt: review.submittedAt || review.submitted_at || "",
  };
}

function extractRecordedReviewResult(comments) {
  for (const comment of comments) {
    const body = comment.body || "";
    if (!body.includes("Conductor Live Sync") && !body.includes("Conductor live sync review id:")) {
      continue;
    }
    const decisionResult = extractPairedReviewDecision(body);
    if (!decisionResult.blocker) {
      return decisionResult.decision;
    }
  }
  return "";
}

function getLabelIdsWithAddedLabel(issue, labelId) {
  if (!labelId) {
    return [];
  }
  return Array.from(new Set([...normalizeList(issue.labelIds), labelId]));
}

function isDoneState(stateName = "") {
  return stateName === "Done";
}

function stopDecision({ activeProject, evidence, nextAction, reason }) {
  return {
    activeProject,
    decision: "stop",
    evidence,
    nextAction,
    proposedMutation: null,
    reason,
    targetIssue: null,
    transition: "",
  };
}

function findPairedReviewer(issues, producer) {
  return issues.find((issue) => {
    if (getRole(issue) !== "reviewer") {
      return false;
    }
    return (
      issue.producerId === producer.id ||
      issue.pairedProducerId === producer.id ||
      issue.reviewsIssue === producer.id ||
      producer.blocks.includes(issue.id) ||
      issue.blockedBy.includes(producer.id)
    );
  });
}

function findLinkedPr(prs, issue) {
  const explicitNumber = issue.prNumber || issue.linkedPrNumber;
  const explicitUrl = issue.prUrl || issue.linkedPrUrl;
  return prs.find((pr) => {
    if (explicitNumber && Number(pr.number) === Number(explicitNumber)) {
      return true;
    }
    if (explicitUrl && pr.url === explicitUrl) {
      return true;
    }
    return pr.linkedIssueIds.includes(issue.id);
  });
}

function findIssue(issues, id) {
  return issues.find((issue) => issue.id === id);
}

function isProducerIssue(issue) {
  const role = getRole(issue);
  return role === "coder" || role === "test";
}

function getRole(issue) {
  return matchingLabels(issue.labels, ROLE_LABELS)[0]?.slice("role:".length) || "";
}

function getReviewResult(issue) {
  return issue.reviewResult || issue.githubReviewResult || issue.review_result || "";
}

function isTerminalIssue(issue) {
  return TERMINAL_STATUSES.includes(issue.status);
}

function isTerminalOrAbandoned(issue) {
  return isTerminalIssue(issue) || issue.outcome === "abandoned" || issue.abandoned === true;
}

function hasAutomationReady(issue) {
  return issue.labels.includes(AUTOMATION_READY_LABEL);
}

function hasStopLabel(item) {
  return matchingLabels(item.labels, STOP_LABELS).length > 0;
}

function isPassing(value) {
  if (value === true || value === "passing" || value === "success" || value === "passed") {
    return true;
  }
  if (value && typeof value === "object") {
    return value.state === "passing" || value.status === "passing" || value.passed === true;
  }
  return false;
}

function formatReadiness(value) {
  if (value && typeof value === "object") {
    return value.state || value.status || JSON.stringify(value);
  }
  return value || "UNKNOWN";
}

function normalizeList(value = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

function normalizeLabels(labels = []) {
  return labels.map((label) => {
    if (typeof label === "string") {
      return label;
    }
    return label.name || label.id || "";
  }).filter(Boolean);
}

function normalizeCadence(value = "") {
  return String(value).replace(/^review_cadence:\s*/, "").trim();
}

function matchingLabels(labels = [], allowed = []) {
  return labels.filter((label) => allowed.includes(label));
}

function formatIssue(issue) {
  if (!issue) {
    return "UNKNOWN";
  }
  if (issue.id && issue.title) {
    return `${issue.id} - ${issue.title}`;
  }
  return issue.id || issue.title || "UNKNOWN";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
