import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
const TERMINAL_STATUSES = ["Done", "Canceled", "Cancelled", "Abandoned", "Skipped"];

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

  if (state.liveMode) {
    return stopDecision({
      activeProject: state.activeProject,
      evidence: [
        "Standalone Linear/GitHub mutation is not implemented in Conductor v1.",
        "The deterministic transition core is available through --fixture or --json.",
      ],
      reason: "standalone-mutation-not-implemented",
      nextAction:
        "Run this command from an agent wrapper that supplies state and applies the proposed mutation, or pass --fixture to inspect the deterministic core.",
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

  const blockedTransitions = [];
  const transitions = [
    ...findProducerPrReadyTransitions(state, blockedTransitions),
    ...findReviewerCompletedTransitions(state),
    ...findHumanMergeCompleteTransitions(state),
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

export function parseArgs(argv) {
  const options = {
    activeProject: "",
    fixture: "",
    json: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : arg.slice(equalsIndex + 1);

    if (!["--active-project", "--fixture", "--json"].includes(key)) {
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
    }
  }

  if (options.fixture && options.json) {
    throw new ConductorStepError("Provide only one of --fixture or --json.");
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
    state = { liveMode: true };
  }

  const activeProject = options.activeProject || env.TANCHIKI_ACTIVE_LINEAR_PROJECT || "";
  if (activeProject && !state.activeProject) {
    state.activeProject = activeProject;
  }
  return state;
}

export function main({
  argv = process.argv.slice(2),
  env = process.env,
  stderr = console.error,
  stdout = console.log,
} = {}) {
  try {
    const options = parseArgs(argv);
    const state = readInputState({ env, options });
    const decision = decideConductorStep(state);
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

export class ConductorStepError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConductorStepError";
  }
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

function findHumanMergeCompleteTransitions(state) {
  const transitions = [];
  for (const producer of state.issues.filter(isProducerIssue)) {
    const reviewer = findPairedReviewer(state.issues, producer);
    const pr = findLinkedPr(state.prs, producer);
    if (!reviewer || !pr?.merged || !getReviewResult(reviewer)) {
      continue;
    }
    if (isTerminalIssue(producer) && isTerminalIssue(reviewer)) {
      continue;
    }

    transitions.push(stopDecision({
      activeProject: state.activeProject,
      evidence: [
        `PR #${pr.number} is merged.`,
        `${formatIssue(reviewer)} recorded review result: ${getReviewResult(reviewer)}.`,
        "Conductor v1 does not implement Linear Done transitions.",
      ],
      reason: "merged-pr-done-transition-not-implemented",
      nextAction:
        "Mark producer/reviewer Done only through the existing protocol or human/operator action, then rerun Conductor for Release.",
    }));
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
        state: "Todo",
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
  if (!isPassing(pr.checks)) {
    return `PR #${pr.number} checks are not passing: ${formatReadiness(pr.checks)}.`;
  }
  if (!isPassing(pr.metadata)) {
    return `PR #${pr.number} metadata is not passing: ${formatReadiness(pr.metadata)}.`;
  }
  return "";
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

function normalizeState(input) {
  const campaign = input.campaign || {};
  return {
    activeProject: String(input.activeProject || campaign.activeProject || "").trim(),
    activeProjectAmbiguous: input.activeProjectAmbiguous === true,
    activeProjects: normalizeList(input.activeProjects || campaign.activeProjects),
    issues: normalizeList(input.issues).map(normalizeIssue),
    liveMode: input.liveMode === true,
    prs: normalizeList(input.prs || input.pullRequests).map(normalizePr),
    reviewCadence: normalizeCadence(input.reviewCadence || input.review_cadence || campaign.reviewCadence),
  };
}

function normalizeIssue(issue) {
  return {
    ...issue,
    blockedBy: normalizeList(issue.blockedBy || issue.blockers),
    labels: normalizeLabels(issue.labels),
    outcome: issue.outcome || "",
    status: issue.status || issue.state || "",
  };
}

function normalizePr(pr) {
  return {
    ...pr,
    labels: normalizeLabels(pr.labels),
    linkedIssueIds: normalizeList(pr.linkedIssueIds || pr.issues || pr.issueIds),
    state: pr.state || "unknown",
  };
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
  return issue.labels.includes("automation-ready");
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
  const exitCode = main();
  process.exitCode = exitCode;
}
