import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main as reviewerAgentMain } from "./reviewer-agent.js";
import {
  defaultRepo,
  summarizePrMetadata,
} from "./reviewer-evidence.js";

const githubApiUrl = "https://api.github.com";
const linearApiUrl = "https://api.linear.app/graphql";
const automationReadyLabel = "automation-ready";
const defaultMaxSteps = 10;
const hardMaxSteps = 20;
const roleOrder = ["architect", "coder", "test", "reviewer", "release"];
const terminalStatuses = new Set(["Done", "Canceled", "Cancelled", "Abandoned", "Skipped"]);
const canceledStatuses = new Set(["Canceled", "Cancelled", "Abandoned", "Skipped"]);
const metadataLabels = {
  role: ["role:architect", "role:coder", "role:test", "role:reviewer", "role:release"],
  type: [
    "type:architecture",
    "type:docs",
    "type:gameplay",
    "type:harness",
    "type:movement",
    "type:progression",
    "type:test",
    "type:ui",
  ],
  risk: ["risk:human-only", "risk:high", "risk:medium", "risk:low"],
  validation: [
    "validation:docs",
    "validation:gameplay",
    "validation:harness",
    "validation:movement",
    "validation:progression",
    "validation:test",
    "validation:ui",
  ],
};
const stopLabels = [
  "blocked",
  "human-only",
  "merge:do-not-merge",
  "merge:human-required",
  "needs-human-approval",
  "risk:human-only",
];
const pairedReviewDecisionAliases = [
  ["APPROVED_FOR_MERGE", ["APPROVED FOR MERGE", "APPROVED_FOR_MERGE"]],
  ["CHANGES_REQUESTED", ["CHANGES REQUESTED", "CHANGES_REQUESTED"]],
  ["HUMAN_REVIEW_REQUIRED", ["HUMAN REVIEW REQUIRED", "HUMAN_REVIEW_REQUIRED"]],
  ["BLOCKED", ["BLOCKED"]],
];
const reviewerBotLogins = ["tanchiki-reviewer[bot]", "tanchiki-reviewer"];

export class CampaignRunError extends Error {
  constructor(message) {
    super(message);
    this.name = "CampaignRunError";
  }
}

export function parseArgs(argv) {
  const options = {
    activeProject: "",
    dryRun: false,
    fixture: "",
    json: "",
    maxSteps: defaultMaxSteps,
    repo: defaultRepo,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : arg.slice(equalsIndex + 1);

    if (["--auto-merge", "--enable-auto-merge", "--merge", "--merge-pr"].includes(key)) {
      throw new CampaignRunError("Auto-merge is out of scope for MAR-362.");
    }

    if (key === "--dry-run") {
      if (inlineValue !== null) {
        throw new CampaignRunError("--dry-run does not accept a value.");
      }
      options.dryRun = true;
      continue;
    }

    if (!["--active-project", "--fixture", "--json", "--max-steps", "--repo"].includes(key)) {
      throw new CampaignRunError(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined) {
      throw new CampaignRunError(`${key} requires a value.`);
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
    } else if (key === "--max-steps") {
      options.maxSteps = parseMaxSteps(value);
    } else if (key === "--repo") {
      options.repo = parseRepo(value).join("/");
    }
  }

  if (options.fixture && options.json) {
    throw new CampaignRunError("Provide only one of --fixture or --json.");
  }
  return options;
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  reviewerAgentMainImpl = reviewerAgentMain,
  stderr = console.error,
  stdout = console.log,
} = {}) {
  try {
    const options = parseArgs(argv);
    const inputState = await readInputState({ env, fetchImpl, options });
    const result = await runCampaignStateMachine({
      dryRun: options.dryRun,
      env,
      fetchImpl,
      maxSteps: options.maxSteps,
      reviewerAgentMainImpl,
      state: inputState,
    });
    stdout(formatCampaignRunResult(result));
    return 0;
  } catch (error) {
    if (!(error instanceof CampaignRunError) && !(error instanceof SyntaxError)) {
      throw error;
    }
    stderr(`Campaign run failed: ${sanitizeErrorMessage(error)}`);
    return 1;
  }
}

export async function readInputState({ env = process.env, fetchImpl = globalThis.fetch, options }) {
  if (options.fixture) {
    const state = JSON.parse(readFileSync(options.fixture, "utf8"));
    return { ...state, activeProject: options.activeProject || state.activeProject || "" };
  }
  if (options.json) {
    const state = JSON.parse(options.json);
    return { ...state, activeProject: options.activeProject || state.activeProject || "" };
  }

  const activeProject = options.activeProject || env.TANCHIKI_ACTIVE_LINEAR_PROJECT || "";
  if (!activeProject) {
    return {
      activeProject: "",
      liveReadStop: stopResult({
        activeProject: "MISSING",
        nextAction: "Provide --active-project before running campaign:run.",
        reason: "missing-active-project",
        stopReason: "Active Linear project was not provided.",
      }),
    };
  }

  const linearToken = readLinearToken(env);
  const githubToken = readGitHubToken(env);
  if (!linearToken || !githubToken) {
    const missing = [
      !linearToken ? "Linear API token" : "",
      !githubToken ? "GitHub token" : "",
    ].filter(Boolean).join("; ");
    return {
      activeProject,
      liveReadStop: stopResult({
        activeProject,
        nextAction:
          "Provide Linear and GitHub auth through process environment. Do not print, commit, or write tokens.",
        reason: "missing-auth",
        stopReason: `Missing required auth: ${missing}.`,
      }),
    };
  }
  if (!fetchImpl) {
    return {
      activeProject,
      liveReadStop: stopResult({
        activeProject,
        nextAction: "Run with a Node runtime that provides fetch.",
        reason: "api-unavailable",
        stopReason: "No fetch implementation is available for live API reads.",
      }),
    };
  }

  try {
    const [owner, repoName] = parseRepo(options.repo);
    const linear = createLinearClient({ fetchImpl, token: linearToken });
    const github = createGitHubClient({ fetchImpl, owner, repo: repoName, token: githubToken });
    const [issues, automationReadyLabelId, pullRequests] = await Promise.all([
      linear.listProjectIssues(activeProject),
      linear.getIssueLabelId(automationReadyLabel),
      github.listPullRequests(),
    ]);
    return {
      activeProject,
      automationReadyLabelId,
      issues: issues.map(normalizeLinearIssue),
      prs: await normalizeLivePullRequests({ github, issues, prs: pullRequests }),
      repo: options.repo,
    };
  } catch (error) {
    return {
      activeProject,
      liveReadStop: stopResult({
        activeProject,
        nextAction: "Fix live Linear/GitHub access or rerun with --fixture/--json for deterministic validation.",
        reason: "api-unavailable",
        stopReason: sanitizeErrorMessage(error),
      }),
    };
  }
}

export async function runCampaignStateMachine({
  dryRun = false,
  env = process.env,
  fetchImpl = globalThis.fetch,
  maxSteps = defaultMaxSteps,
  reviewerAgentMainImpl = reviewerAgentMain,
  state,
} = {}) {
  const normalized = normalizeState(state);
  const result = createBaseResult({ dryRun, maxSteps, state: normalized });
  if (normalized.liveReadStop) {
    return {
      ...normalized.liveReadStop,
      dryRun,
      maxSteps,
      mutationApplied: false,
      steps: [],
    };
  }

  let workingState = normalized;
  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const decision = decideNextCampaignAction(workingState);
    result.campaignName = decision.campaignName || result.campaignName;
    result.roleIssueIds = decision.roleIssueIds || result.roleIssueIds;
    result.detectedPrNumber = decision.prNumber || result.detectedPrNumber;
    result.currentState = decision.currentState || result.currentState;

    if (decision.kind === "complete") {
      result.completed = true;
      result.reason = decision.reason;
      result.stopReason = "Campaign complete.";
      result.nextAction = "No campaign action remains.";
      return result;
    }

    if (decision.kind === "stop") {
      result.reason = decision.reason;
      result.stopReason = decision.stopReason;
      result.nextAction = decision.nextAction;
      return result;
    }

    if (decision.kind === "operator") {
      result.reason = decision.reason;
      result.stopReason = decision.stopReason;
      result.nextAction = decision.nextAction;
      result.nextPrompt = decision.nextPrompt;
      return result;
    }

    const step = {
      action: decision.action,
      issue: decision.issueId || "",
      mutationApplied: false,
      reason: decision.reason,
      summary: decision.summary,
    };

    if (decision.kind === "reviewer-agent" && dryRun) {
      result.steps.push({
        ...step,
        summary: `${step.summary} (dry-run only; no Reviewer submission)`,
      });
      result.reason = "reviewer-agent-dry-run-planned";
      result.stopReason = "Dry-run stopped before Reviewer Agent execution.";
      result.nextAction = "Rerun without --dry-run only when Reviewer Agent execution is intended.";
      return result;
    }

    if (dryRun) {
      result.steps.push({
        ...step,
        summary: `${step.summary} (dry-run only)`,
      });
      workingState = applyDecisionToMemory(workingState, decision);
      continue;
    }

    const applied = await applyLiveDecision({
      decision,
      env,
      fetchImpl,
      reviewerAgentMainImpl,
      state: workingState,
    });
    result.steps.push({
      ...step,
      mutationApplied: applied.mutationApplied,
      summary: applied.summary || step.summary,
    });
    result.mutationApplied = result.mutationApplied || applied.mutationApplied;
    if (decision.kind === "reviewer-agent") {
      result.reason = "reviewer-agent-submitted";
      result.stopReason = "Reviewer Agent submitted a guarded review.";
      result.nextAction = "Rerun campaign:run after the Reviewer App review is visible for bridge sync.";
      return result;
    }
    workingState = applyDecisionToMemory(workingState, decision);
  }

  result.reason = "max-steps-reached";
  result.stopReason = `Max steps reached: ${maxSteps}.`;
  result.nextAction = "Rerun campaign:run after inspecting the printed actions.";
  return result;
}

export function decideNextCampaignAction(state) {
  if (!state.activeProject) {
    return stopAction({
      activeProject: "MISSING",
      nextAction: "Provide --active-project.",
      reason: "missing-active-project",
      stopReason: "Active Linear project was not provided.",
    });
  }

  const wrongProjectIssues = state.issues
    .filter((issue) => issue.project && issue.project !== state.activeProject)
    .map((issue) => `${issue.id} project: ${issue.project}`);
  if (wrongProjectIssues.length > 0) {
    return stopAction({
      activeProject: state.activeProject,
      nextAction: "Use issues from the declared active Linear project only.",
      reason: "wrong-project",
      stopReason: wrongProjectIssues.join("; "),
    });
  }

  const selection = selectActiveCampaign(state);
  if (selection.stop) {
    return selection.stop;
  }

  const campaignIssues = selection.issues;
  const campaignName = selection.campaignName;
  const metadataBlocker = getCampaignMetadataBlocker(campaignIssues);
  if (metadataBlocker) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Fix the campaign issue metadata before running campaign:run again.",
      reason: "bad-metadata",
      roleIssueIds: collectRoleIssueIds(campaignIssues),
      stopReason: metadataBlocker,
    });
  }

  const roleIssues = collectRoleIssues(campaignIssues);
  const roleShapeBlocker = getRoleShapeBlocker(roleIssues);
  if (roleShapeBlocker) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Run Planner/Groomer queue repair before campaign:run.",
      reason: "bad-campaign-shape",
      roleIssueIds: collectRoleIssueIds(campaignIssues),
      stopReason: roleShapeBlocker,
    });
  }

  const roleIssueIds = collectRoleIssueIds(campaignIssues);
  const testerRequired = isTesterRequired(campaignIssues, roleIssues);
  const architect = roleIssues.architect[0];
  const coder = roleIssues.coder[0];
  const tester = roleIssues.test[0] || null;
  const reviewer = roleIssues.reviewer[0];
  const release = roleIssues.release[0];
  if (!architect || !coder || !reviewer || !release || (testerRequired && !tester)) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Repair the campaign queue so required role issues exist.",
      reason: "missing-role-issue",
      roleIssueIds,
      stopReason: "Campaign must include Architect, Coder, Reviewer, Release, and Tester when Shape A requires Tester.",
    });
  }

  if (release && isTerminalIssue(release) && campaignIssues.every(isTerminalOrAbandoned)) {
    return {
      activeProject: state.activeProject,
      campaignName,
      currentState: "complete",
      kind: "complete",
      reason: "campaign-complete",
      roleIssueIds,
    };
  }

  const activeIssues = campaignIssues.filter(isActiveAutomationIssue);
  if (activeIssues.length > 1) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Expose exactly one active automation-ready issue.",
      reason: "multiple-active-candidates",
      roleIssueIds,
      stopReason: `Multiple active candidates: ${activeIssues.map((issue) => issue.id).join(", ")}.`,
    });
  }

  if (activeIssues.length === 1) {
    return handleActiveIssue({
      activeIssue: activeIssues[0],
      campaignName,
      coder,
      release,
      reviewer,
      roleIssueIds,
      state,
      tester,
      testerRequired,
    });
  }

  if (!isTerminalIssue(architect)) {
    if (isPromotableIssue(architect)) {
      return promoteAction({ campaignName, issue: architect, reason: "architect-ready", roleIssueIds, state });
    }
    return waitingForRoleAction({ campaignName, issue: architect, roleIssueIds, state });
  }

  if (isPromotableIssue(coder)) {
    return promoteAction({ campaignName, issue: coder, reason: "architect-done-coder-ready", roleIssueIds, state });
  }

  const prSelection = findProducerPr({ producer: coder, prs: state.prs });
  const pr = prSelection.pr;
  if (!isTerminalIssue(coder)) {
    if (!pr) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        currentState: "coder-waiting-for-pr",
        nextAction: "Run the Coder role until the implementation PR exists.",
        reason: "missing-pr",
        roleIssueIds,
        stopReason: prSelection.blocker || `${coder.id} has no linked PR.`,
      });
    }

    if (testerRequired && tester && !isTerminalIssue(tester)) {
      if (isPromotableIssue(tester)) {
        const readiness = getPrReadinessBlocker({ pr, producer: coder });
        if (readiness) {
          return stopAction({
            activeProject: state.activeProject,
            campaignName,
            currentState: "tester-promotion-blocked",
            nextAction: "Fix the PR readiness blocker before Tester promotion.",
            prNumber: pr.number,
            reason: "pr-not-ready",
            roleIssueIds,
            stopReason: readiness,
          });
        }
        return promoteAction({
          campaignName,
          issue: tester,
          prNumber: pr.number,
          reason: "coder-pr-ready-tester-ready",
          roleIssueIds,
          state,
        });
      }
      return waitingForRoleAction({ campaignName, issue: tester, prNumber: pr.number, roleIssueIds, state });
    }

    if (testerRequired && tester && !isTerminalIssue(tester)) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Complete the required Tester issue before Reviewer promotion.",
        prNumber: pr.number,
        reason: "tester-required-incomplete",
        roleIssueIds,
        stopReason: "Tester is required for this campaign and is incomplete.",
      });
    }

    if (isPromotableIssue(reviewer)) {
      const readiness = getPrReadinessBlocker({ pr, producer: coder });
      if (readiness) {
        return stopAction({
          activeProject: state.activeProject,
          campaignName,
          currentState: "reviewer-promotion-blocked",
          nextAction: "Fix the PR readiness blocker before Reviewer promotion.",
          prNumber: pr.number,
          reason: "pr-not-ready",
          roleIssueIds,
          stopReason: readiness,
        });
      }
      return promoteAction({
        campaignName,
        comment: `Promoted as paired-review Reviewer for open PR #${pr.number}.`,
        issue: reviewer,
        prNumber: pr.number,
        reason: testerRequired ? "tester-done-reviewer-ready" : "coder-pr-ready-reviewer-ready",
        roleIssueIds,
        state,
      });
    }
  }

  if (!pr) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Link or open the implementation PR before continuing.",
      reason: "missing-pr",
      roleIssueIds,
      stopReason: prSelection.blocker || `${coder.id} has no linked PR.`,
    });
  }

  const reviewerDecision = getReviewResult(reviewer);
  if (isReviewerActiveAndReady({ pr, reviewer })) {
    return reviewerAgentAction({
      campaignName,
      pr,
      reviewer,
      roleIssueIds,
      state,
    });
  }

  if (!reviewerDecision) {
    const reviewSelection = selectReviewerBotReview({ pr, reviewer });
    if (reviewSelection.review) {
      return syncReviewAction({
        campaignName,
        decision: reviewSelection.decision,
        pr,
        review: reviewSelection.review,
        reviewer,
        roleIssueIds,
        state,
      });
    }
    if (reviewSelection.blocker && isActiveOrInReview(reviewer)) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Run the paired Reviewer through the Reviewer Agent path.",
        prNumber: pr.number,
        reason: "reviewer-app-review-missing",
        roleIssueIds,
        stopReason: reviewSelection.blocker,
      });
    }
  }

  if (reviewerDecision && !isMergeAllowedReviewResult(reviewerDecision)) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Resolve the paired-review finding before merge or closure.",
      prNumber: pr.number,
      reason: "reviewer-blocked-merge",
      roleIssueIds,
      stopReason: `${reviewer.id} recorded ${reviewerDecision}.`,
    });
  }

  if (reviewerDecision && !pr.merged && pr.state === "open") {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      currentState: "human-merge-gate",
      nextAction: "Human must merge or explicitly abandon the PR.",
      prNumber: pr.number,
      reason: "human-merge-required",
      roleIssueIds,
      stopReason: "Hard gate: human merge required.",
    });
  }

  if (pr.closedUnmerged || (pr.state === "closed" && pr.merged !== true)) {
    return stopAction({
      activeProject: state.activeProject,
      campaignName,
      nextAction: "Record explicit PR abandonment before continuing.",
      prNumber: pr.number,
      reason: "closed-unmerged-pr",
      roleIssueIds,
      stopReason: `PR #${pr.number} is closed without merge.`,
    });
  }

  if (pr.merged) {
    if (!reviewerDecision) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Record a paired-review outcome before post-merge sync.",
        prNumber: pr.number,
        reason: "missing-review-result",
        roleIssueIds,
        stopReason: `PR #${pr.number} is merged, but ${reviewer.id} has no recorded paired-review outcome.`,
      });
    }
    if (!isTerminalIssue(coder)) {
      return doneSyncAction({ campaignName, issue: coder, issueRole: "producer", pr, reviewResult: reviewerDecision, roleIssueIds, state });
    }
    if (!isTerminalIssue(reviewer)) {
      return doneSyncAction({ campaignName, issue: reviewer, issueRole: "reviewer", pr, reviewResult: reviewerDecision, roleIssueIds, state });
    }
    if (isPromotableIssue(release)) {
      return promoteAction({
        campaignName,
        comment: "Promoted Release issue after upstream producer/reviewer outcomes were recorded.",
        issue: release,
        prNumber: pr.number,
        reason: "release-ready",
        roleIssueIds,
        state,
      });
    }
  }

  if (isActiveOrInReview(release) && !isTerminalIssue(release)) {
    return waitingForRoleAction({ campaignName, issue: release, prNumber: pr.number, roleIssueIds, state });
  }

  return stopAction({
    activeProject: state.activeProject,
    campaignName,
    nextAction: "Inspect campaign state; no deterministic transition matched.",
    prNumber: pr.number,
    reason: "no-eligible-transition",
    roleIssueIds,
    stopReason: "No eligible campaign transition was found.",
  });
}

export function formatCampaignRunResult(result) {
  const lines = [
    "Campaign run",
    `Active project: ${result.activeProject || "MISSING"}`,
    `Campaign: ${result.campaignName || "UNKNOWN"}`,
    `Dry run: ${result.dryRun ? "yes" : "no"}`,
    `Max steps: ${result.maxSteps}`,
    `Mutation applied: ${result.mutationApplied ? "true" : "false"}`,
    `Current state: ${result.currentState || "UNKNOWN"}`,
    `Detected PR: ${result.detectedPrNumber ? `#${result.detectedPrNumber}` : "none"}`,
  ];

  lines.push("Role issues:");
  if (Object.keys(result.roleIssueIds || {}).length === 0) {
    lines.push("- none detected");
  } else {
    for (const role of roleOrder) {
      if (result.roleIssueIds[role]) {
        lines.push(`- ${role}: ${result.roleIssueIds[role]}`);
      }
    }
  }

  lines.push("Actions:");
  if (result.steps.length === 0) {
    lines.push("- none");
  } else {
    for (const step of result.steps) {
      lines.push(`- ${step.action}${step.issue ? ` ${step.issue}` : ""}: ${step.summary}; mutation_applied: ${step.mutationApplied}`);
    }
  }

  lines.push(`Stop reason: ${result.stopReason || (result.completed ? "Campaign complete." : "UNKNOWN")}`);
  lines.push(`Reason code: ${result.reason || "none"}`);
  lines.push(`Next action: ${result.nextAction || "none"}`);
  if (result.nextPrompt) {
    lines.push("Next prompt:");
    lines.push(result.nextPrompt);
  }
  return lines.join("\n");
}

function handleActiveIssue({ activeIssue, campaignName, coder, release, reviewer, roleIssueIds, state, tester, testerRequired }) {
  const role = getRole(activeIssue);
  if (["architect", "coder", "test", "release"].includes(role)) {
    return waitingForRoleAction({ campaignName, issue: activeIssue, roleIssueIds, state });
  }

  if (role === "reviewer") {
    const prSelection = findProducerPr({ producer: coder, prs: state.prs });
    if (!prSelection.pr) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Link or open the implementation PR before Reviewer execution.",
        reason: "missing-pr",
        roleIssueIds,
        stopReason: prSelection.blocker || `${coder.id} has no linked PR.`,
      });
    }
    if (testerRequired && tester && !isTerminalIssue(tester)) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Complete Tester verification before Reviewer execution.",
        prNumber: prSelection.pr.number,
        reason: "tester-required-incomplete",
        roleIssueIds,
        stopReason: "Tester is required for this campaign and is incomplete.",
      });
    }
    const readiness = getPrReadinessBlocker({ pr: prSelection.pr, producer: coder });
    if (readiness) {
      return stopAction({
        activeProject: state.activeProject,
        campaignName,
        nextAction: "Fix the PR readiness blocker before Reviewer execution.",
        prNumber: prSelection.pr.number,
        reason: "pr-not-ready",
        roleIssueIds,
        stopReason: readiness,
      });
    }
    return reviewerAgentAction({
      campaignName,
      pr: prSelection.pr,
      reviewer,
      roleIssueIds,
      state,
    });
  }

  return stopAction({
    activeProject: state.activeProject,
    campaignName,
    nextAction: "Fix the active issue role metadata.",
    reason: "unsupported-active-role",
    roleIssueIds,
    stopReason: `${activeIssue.id} has unsupported active role ${role || "missing"}.`,
  });
}

function promoteAction({ campaignName, comment = "", issue, prNumber = null, reason, roleIssueIds, state }) {
  return {
    action: "promote",
    activeProject: state.activeProject,
    campaignName,
    currentState: `${getRole(issue)}-promotion-ready`,
    issueId: issue.id,
    kind: "mutation",
    mutation: {
      addLabels: [automationReadyLabel],
      comment: comment || `Promoted ${issue.id} for ${getRole(issue)} execution.`,
      issue,
      state: "Todo",
    },
    prNumber,
    reason,
    roleIssueIds,
    summary: `Promote ${issue.id} to Todo + automation-ready`,
  };
}

function syncReviewAction({ campaignName, decision, pr, review, reviewer, roleIssueIds, state }) {
  return {
    action: "sync-review",
    activeProject: state.activeProject,
    campaignName,
    currentState: "reviewer-app-review-ready",
    issueId: reviewer.id,
    kind: "mutation",
    mutation: {
      addLabels: [],
      comment: buildReviewerSyncComment({
        activeProject: state.activeProject,
        decision,
        pr,
        review,
      }),
      issue: reviewer,
      state: reviewer.status === "In Review" ? "" : "In Review",
    },
    prNumber: pr.number,
    reason: "valid-reviewer-app-review",
    roleIssueIds,
    summary: `Sync Reviewer App review ${formatReviewId(review)} to ${reviewer.id}`,
  };
}

function doneSyncAction({ campaignName, issue, issueRole, pr, reviewResult, roleIssueIds, state }) {
  return {
    action: "done-sync",
    activeProject: state.activeProject,
    campaignName,
    currentState: `${issueRole}-done-sync-ready`,
    issueId: issue.id,
    kind: "mutation",
    mutation: {
      addLabels: [],
      comment: buildDoneSyncComment({
        activeProject: state.activeProject,
        issueRole,
        pr,
        reviewResult,
      }),
      issue,
      state: "Done",
    },
    prNumber: pr.number,
    reason: `${issueRole}-merged-pr-done-sync`,
    roleIssueIds,
    summary: `Sync ${issue.id} to Done after merged PR #${pr.number}`,
  };
}

function reviewerAgentAction({ campaignName, pr, reviewer, roleIssueIds, state }) {
  return {
    action: "reviewer-agent",
    activeProject: state.activeProject,
    campaignName,
    currentState: "reviewer-agent-ready",
    issueId: reviewer.id,
    kind: "reviewer-agent",
    prNumber: pr.number,
    reason: "reviewer-agent-ready",
    roleIssueIds,
    summary: `Run Reviewer Agent for ${reviewer.id} and PR #${pr.number}`,
  };
}

function waitingForRoleAction({ campaignName, issue, prNumber = null, roleIssueIds, state }) {
  const role = getRole(issue);
  return {
    activeProject: state.activeProject,
    campaignName,
    currentState: `${role}-operator-required`,
    kind: "operator",
    nextAction: `Run ${role} role for ${issue.id}.`,
    nextPrompt: buildRolePrompt({ activeProject: state.activeProject, issue, role }),
    prNumber,
    reason: `${role}-operator-required`,
    roleIssueIds,
    stopReason: `${issue.id} is active and requires ${role} execution.`,
  };
}

function stopAction({ activeProject, campaignName = "", currentState = "", nextAction, prNumber = null, reason, roleIssueIds = {}, stopReason }) {
  return {
    activeProject,
    campaignName,
    currentState,
    kind: "stop",
    nextAction,
    prNumber,
    reason,
    roleIssueIds,
    stopReason,
  };
}

function stopResult({ activeProject, nextAction, reason, stopReason }) {
  return {
    activeProject,
    campaignName: "",
    completed: false,
    currentState: "stopped",
    detectedPrNumber: null,
    dryRun: false,
    maxSteps: defaultMaxSteps,
    mutationApplied: false,
    nextAction,
    reason,
    roleIssueIds: {},
    steps: [],
    stopReason,
  };
}

function createBaseResult({ dryRun, maxSteps, state }) {
  return {
    activeProject: state.activeProject || "",
    campaignName: "",
    completed: false,
    currentState: "starting",
    detectedPrNumber: null,
    dryRun,
    maxSteps,
    mutationApplied: false,
    nextAction: "",
    nextPrompt: "",
    reason: "",
    roleIssueIds: {},
    steps: [],
    stopReason: "",
  };
}

function selectActiveCampaign(state) {
  const campaignGroups = groupIssuesByCampaign(state.issues);
  if (campaignGroups.size === 0) {
    return {
      stop: stopAction({
        activeProject: state.activeProject,
        nextAction: "Ensure campaign issues include a ## Campaign section.",
        reason: "no-active-campaign",
        stopReason: "No active campaign detected.",
      }),
    };
  }

  const activeCandidates = [];
  for (const [campaignName, issues] of campaignGroups.entries()) {
    for (const issue of issues) {
      if (isActiveAutomationIssue(issue)) {
        activeCandidates.push({ campaignName, issue });
      }
    }
  }

  if (activeCandidates.length > 1) {
    return {
      stop: stopAction({
        activeProject: state.activeProject,
        nextAction: "Expose exactly one active automation-ready issue.",
        reason: "ambiguous-active-campaign",
        stopReason: `Multiple active candidates exist: ${activeCandidates.map(({ issue }) => issue.id).join(", ")}.`,
      }),
    };
  }

  if (activeCandidates.length === 1) {
    const campaignName = activeCandidates[0].campaignName;
    return { campaignName, issues: campaignGroups.get(campaignName) };
  }

  const selectable = [];
  for (const [campaignName, issues] of campaignGroups.entries()) {
    if (issues.some((issue) => !isTerminalOrAbandoned(issue)) || (campaignGroups.size === 1 && issues.length > 0)) {
      const campaignState = { ...state, issues };
      const hasPossibleTransition = hasDeterministicTransitionCandidate(campaignState);
      if (hasPossibleTransition || campaignGroups.size === 1) {
        selectable.push({ campaignName, issues });
      }
    }
  }

  if (selectable.length === 1) {
    return selectable[0];
  }

  return {
    stop: stopAction({
      activeProject: state.activeProject,
      nextAction: selectable.length > 1
        ? "Specify or expose one active campaign."
        : "Promote the next campaign issue with Conductor or provide a fixture with one campaign.",
      reason: selectable.length > 1 ? "ambiguous-active-campaign" : "no-active-campaign",
      stopReason: selectable.length > 1
        ? `Multiple campaigns could be active: ${selectable.map((item) => item.campaignName).join("; ")}.`
        : "No active campaign detected.",
    }),
  };
}

function hasDeterministicTransitionCandidate(state) {
  const roleIssues = collectRoleIssues(state.issues);
  const architect = roleIssues.architect[0];
  const coder = roleIssues.coder[0];
  const tester = roleIssues.test[0];
  const reviewer = roleIssues.reviewer[0];
  const release = roleIssues.release[0];
  if (architect && !isTerminalIssue(architect) && isPromotableIssue(architect)) {
    return true;
  }
  if (architect && isTerminalIssue(architect) && coder && isPromotableIssue(coder)) {
    return true;
  }
  if (coder && reviewer) {
    const pr = findProducerPr({ producer: coder, prs: state.prs }).pr;
    if (pr && tester && isPromotableIssue(tester)) {
      return true;
    }
    if (pr && reviewer && isPromotableIssue(reviewer)) {
      return true;
    }
    if (pr?.merged && (!isTerminalIssue(coder) || !isTerminalIssue(reviewer))) {
      return true;
    }
  }
  if (release && isPromotableIssue(release)) {
    return true;
  }
  return release && isTerminalIssue(release) && state.issues.every(isTerminalOrAbandoned);
}

function groupIssuesByCampaign(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const campaignName = issue.campaignName || extractCampaignName(issue.description);
    if (!campaignName) {
      continue;
    }
    if (!groups.has(campaignName)) {
      groups.set(campaignName, []);
    }
    groups.get(campaignName).push({ ...issue, campaignName });
  }
  return groups;
}

function getCampaignMetadataBlocker(issues) {
  for (const issue of issues) {
    const metadataBlocker = getMetadataBlocker(issue);
    if (metadataBlocker) {
      return `${issue.id}: ${metadataBlocker}`;
    }
  }
  return "";
}

function getMetadataBlocker(issue) {
  for (const [name, allowedLabels] of Object.entries(metadataLabels)) {
    const matches = matchingLabels(issue.labels, allowedLabels);
    if (matches.length !== 1) {
      return `${name} metadata must have exactly one ${name}:* label; found ${matches.length || "none"}.`;
    }
  }
  const matchedStopLabels = matchingLabels(issue.labels, stopLabels);
  if (matchedStopLabels.length > 0) {
    return `stop or human-gate labels present: ${matchedStopLabels.join(", ")}.`;
  }
  return "";
}

function collectRoleIssues(issues) {
  const roles = Object.fromEntries(roleOrder.map((role) => [role, []]));
  for (const issue of issues) {
    const role = getRole(issue);
    if (role && roles[role]) {
      roles[role].push(issue);
    }
  }
  return roles;
}

function collectRoleIssueIds(issues) {
  const roleIssues = collectRoleIssues(issues);
  return Object.fromEntries(
    Object.entries(roleIssues)
      .filter(([, issuesForRole]) => issuesForRole.length > 0)
      .map(([role, issuesForRole]) => [role, issuesForRole.map((issue) => issue.id).join(", ")]),
  );
}

function getRoleShapeBlocker(roleIssues) {
  for (const [role, issues] of Object.entries(roleIssues)) {
    const nonTerminal = issues.filter((issue) => !isTerminalOrAbandoned(issue));
    if (nonTerminal.length > 1) {
      return `Multiple non-terminal ${role} issues are present: ${nonTerminal.map((issue) => issue.id).join(", ")}.`;
    }
  }
  return "";
}

function isTesterRequired(campaignIssues, roleIssues) {
  if (roleIssues.test.length > 0) {
    return true;
  }
  const text = campaignIssues.map((issue) => `${issue.description}\n${issue.comments.map((comment) => comment.body).join("\n")}`).join("\n");
  if (/Shape\s*A/i.test(text) || /Tester is required/i.test(text) || /Tester-required/i.test(text)) {
    return true;
  }
  if (/Shape\s*B/i.test(text) || /without Tester/i.test(text) || /no Tester/i.test(text)) {
    return false;
  }
  return false;
}

function findProducerPr({ producer, prs }) {
  const attachmentMatches = findPrMatchesFromAttachments({ attachments: producer.attachments, prs });
  if (attachmentMatches.length > 1) {
    return { blocker: `${producer.id} has multiple PR attachments: ${attachmentMatches.map((pr) => `#${pr.number}`).join(", ")}.`, pr: null };
  }
  if (attachmentMatches.length === 1) {
    return { blocker: "", pr: attachmentMatches[0] };
  }

  const bodyMatches = prs.filter((pr) => bodyLinksIssue(pr.body, producer.id));
  if (bodyMatches.length > 1) {
    return { blocker: `Multiple PR bodies link ${producer.id}: ${bodyMatches.map((pr) => `#${pr.number}`).join(", ")}.`, pr: null };
  }
  if (bodyMatches.length === 1) {
    return { blocker: "", pr: bodyMatches[0] };
  }

  const looseMatches = prs.filter((pr) => {
    const haystack = `${pr.headRefName || ""}\n${pr.title || ""}\n${pr.body || ""}`;
    return new RegExp(`\\b${escapeRegExp(producer.id)}\\b`).test(haystack);
  });
  if (looseMatches.length > 1) {
    return { blocker: `Multiple PRs reference ${producer.id}: ${looseMatches.map((pr) => `#${pr.number}`).join(", ")}.`, pr: null };
  }
  if (looseMatches.length === 1) {
    return { blocker: "", pr: looseMatches[0] };
  }
  return { blocker: `${producer.id} has no linked PR.`, pr: null };
}

function findPrMatchesFromAttachments({ attachments, prs }) {
  const attachedNumbers = new Set();
  const attachedUrls = new Set();
  for (const attachment of attachments || []) {
    const url = attachment.url || attachment;
    const number = extractPrNumberFromUrl(url);
    if (number) {
      attachedNumbers.add(Number(number));
    }
    if (url) {
      attachedUrls.add(String(url));
    }
  }
  return prs.filter((pr) => attachedNumbers.has(Number(pr.number)) || attachedUrls.has(pr.url));
}

function bodyLinksIssue(body = "", issueId = "") {
  if (!body || !issueId) {
    return false;
  }
  const exact = new RegExp(`\\b${escapeRegExp(issueId)}\\b`);
  return exact.test(body);
}

function getPrReadinessBlocker({ pr, producer }) {
  const prMetadata = evaluatePrMetadata({ issue: producer, pr });
  if (matchingLabels(pr.labels, stopLabels).length > 0) {
    return `PR #${pr.number} has stop labels: ${matchingLabels(pr.labels, stopLabels).join(", ")}.`;
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
  if (!prMetadata.ok) {
    return `PR #${pr.number} metadata is not passing: ${prMetadata.findings.join("; ")}.`;
  }
  return "";
}

function evaluatePrMetadata({ issue, pr }) {
  if (pr.metadata === "passing" || pr.metadata === true) {
    return { findings: [], ok: true };
  }
  if (pr.metadata && pr.metadata !== "missing") {
    return { findings: [`metadata state: ${formatReadiness(pr.metadata)}`], ok: false };
  }
  if (!pr.body) {
    return { findings: ["PR body is missing."], ok: false };
  }
  const summary = summarizePrMetadata(pr.body, issue.id);
  const findings = [];
  if (!summary.mentions_linked_issue) {
    findings.push(`PR body does not mention ${issue.id}.`);
  }
  if (!summary.required_headings_ok) {
    findings.push(`missing headings: ${summary.missing_headings.join(", ")}`);
  }
  if (!summary.role_type_risk_validation_ok) {
    findings.push(...summary.role_type_risk_validation_findings);
  }
  const expected = {
    risk: getLabelSuffix(issue, "risk:"),
    role: getLabelSuffix(issue, "role:"),
    type: getLabelSuffix(issue, "type:"),
    validation: getLabelSuffix(issue, "validation:"),
  };
  for (const key of Object.keys(expected)) {
    const actual = stripMetadataPrefix(summary[key], key);
    if (actual && expected[key] && actual !== expected[key]) {
      findings.push(`${key} metadata ${summary[key]} does not match issue ${expected[key]}.`);
    }
  }
  return { findings, ok: findings.length === 0 };
}

function stripMetadataPrefix(value, key) {
  const text = String(value || "");
  const prefix = `${key}:`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function selectReviewerBotReview({ pr, reviewer }) {
  const reviews = normalizeList(pr.reviews);
  if (reviews.length === 0) {
    return { blocker: `PR #${pr.number} has no reviews to sync.` };
  }

  const botReviews = reviews.filter((review) => reviewerBotLogins.includes(String(review.authorLogin).toLowerCase()));
  if (botReviews.length === 0) {
    return { blocker: `PR #${pr.number} has no review by tanchiki-reviewer[bot].` };
  }

  const valid = [];
  const blockers = [];
  for (const review of botReviews) {
    const decision = extractPairedReviewDecision(review.body);
    if (decision.blocker) {
      blockers.push(`Review ${formatReviewId(review)}: ${decision.blocker}`);
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
      blockers.push(`Review ${formatReviewId(review)} was already synced to ${reviewer.id}.`);
      continue;
    }
    valid.push({ decision: decision.decision, review });
  }

  if (valid.length > 1) {
    return { blocker: `PR #${pr.number} has multiple valid tanchiki-reviewer[bot] reviews; stop for human triage.` };
  }
  if (valid.length === 1) {
    return valid[0];
  }
  return { blocker: blockers[0] || `PR #${pr.number} has no valid tanchiki-reviewer[bot] review to sync.` };
}

function extractPairedReviewDecision(body = "") {
  const matches = pairedReviewDecisionAliases
    .filter(([, aliases]) => aliases.some((alias) => hasDecisionAlias(body, alias)))
    .map(([decision]) => decision);
  if (matches.length !== 1) {
    return { blocker: `review body must contain exactly one paired-review decision; found ${matches.length}.` };
  }
  return { decision: matches[0] };
}

function hasDecisionAlias(text, alias) {
  const escaped = escapeRegExp(alias);
  return new RegExp(`(^|[^A-Z0-9_])${escaped}([^A-Z0-9_]|$)`).test(String(text));
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

function isReviewerActiveAndReady({ pr, reviewer }) {
  return isActiveAutomationIssue(reviewer) && !getPrReadinessBlocker({ pr, producer: reviewer });
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

function buildRolePrompt({ activeProject, issue, role }) {
  return [
    "Use Linear MCP and GitHub.",
    "",
    `Active Linear project: ${activeProject}`,
    "",
    `Run Dispatcher for ${issue.id} as ${role}.`,
    "Follow the repo harness protocols, including Level 5 risk-gated validation.",
    "Work one issue only.",
    "Do not merge.",
    "Do not mark Done.",
  ].join("\n");
}

async function applyLiveDecision({ decision, env, fetchImpl, reviewerAgentMainImpl, state }) {
  if (decision.kind === "reviewer-agent") {
    return runReviewerAgentForDecision({ decision, env, fetchImpl, reviewerAgentMainImpl, state });
  }

  const linearToken = readLinearToken(env);
  if (!linearToken) {
    throw new CampaignRunError("Linear API token is required before live mutation.");
  }
  const linear = createLinearClient({ fetchImpl, token: linearToken });
  const mutation = decision.mutation;
  const issue = mutation.issue;
  const update = {};
  if (mutation.state) {
    const stateId = findStateId(issue, mutation.state);
    if (!stateId) {
      throw new CampaignRunError(`${issue.id} is missing the Linear state id for ${mutation.state}.`);
    }
    update.stateId = stateId;
  }
  if (mutation.addLabels.length > 0) {
    const automationReadyLabelId = state.automationReadyLabelId || "";
    if (!automationReadyLabelId) {
      throw new CampaignRunError(`${issue.id} is missing Linear label id for ${automationReadyLabel}.`);
    }
    update.labelIds = Array.from(new Set([...issue.labelIds, automationReadyLabelId]));
  }

  if (Object.keys(update).length > 0) {
    await linear.updateIssue(issue.linearId, update);
  }
  await linear.createComment(issue.linearId, mutation.comment);
  const verified = await linear.getIssue(issue.id);
  if (mutation.state && verified.state?.name !== mutation.state) {
    throw new CampaignRunError(`Postcondition failed: ${issue.id} is ${verified.state?.name || "UNKNOWN"}, expected ${mutation.state}.`);
  }
  return {
    mutationApplied: true,
    summary: `${decision.summary}; verified ${issue.id}`,
  };
}

async function runReviewerAgentForDecision({ decision, env, fetchImpl, reviewerAgentMainImpl }) {
  const tempDir = await mkdtemp(join(tmpdir(), "tanchiki-campaign-run-"));
  const artifactPath = join(tempDir, `reviewer-agent-${decision.prNumber}.json`);
  try {
    const dryRunOutput = [];
    const dryRunExit = await reviewerAgentMainImpl({
      argv: [
        "--pr", String(decision.prNumber),
        "--issue", decision.issueId,
        "--dry-run",
        "--output", artifactPath,
      ],
      env,
      fetchImpl,
      stderr: () => {},
      stdout: (line) => dryRunOutput.push(line),
    });
    if (dryRunExit !== 0) {
      throw new CampaignRunError("Reviewer Agent dry-run failed before review submission.");
    }
    const submitOutput = [];
    const submitExit = await reviewerAgentMainImpl({
      argv: ["--submit-from", artifactPath],
      env,
      fetchImpl,
      stderr: () => {},
      stdout: (line) => submitOutput.push(line),
    });
    if (submitExit !== 0) {
      throw new CampaignRunError("Reviewer Agent submit-from artifact failed closed.");
    }
    return {
      mutationApplied: true,
      summary: `Reviewer Agent submitted guarded review for PR #${decision.prNumber}`,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function applyDecisionToMemory(state, decision) {
  if (decision.kind === "reviewer-agent") {
    return state;
  }
  if (!decision.mutation?.issue) {
    return state;
  }
  const targetId = decision.mutation.issue.id;
  return {
    ...state,
    issues: state.issues.map((issue) => {
      if (issue.id !== targetId) {
        return issue;
      }
      const nextLabels = Array.from(new Set([...issue.labels, ...decision.mutation.addLabels]));
      return {
        ...issue,
        comments: decision.mutation.comment
          ? [...issue.comments, { body: decision.mutation.comment }]
          : issue.comments,
        labels: nextLabels,
        status: decision.mutation.state || issue.status,
        statusType: decision.mutation.state === "Done" ? "completed" : issue.statusType,
      };
    }),
  };
}

function normalizeState(input = {}) {
  return {
    activeProject: String(input.activeProject || "").trim(),
    automationReadyLabelId: input.automationReadyLabelId || "",
    issues: normalizeList(input.issues).map(normalizeIssue),
    liveReadStop: input.liveReadStop || null,
    prs: normalizeList(input.prs || input.pullRequests).map(normalizePr),
    repo: input.repo || defaultRepo,
  };
}

function normalizeIssue(issue) {
  const state = issue.state && typeof issue.state === "object" ? issue.state : {};
  const project = issue.project && typeof issue.project === "object" ? issue.project.name : issue.project;
  const description = issue.description || issue.text || "";
  return {
    ...issue,
    attachments: normalizeList(issue.attachments).map(normalizeAttachment),
    blockedBy: normalizeBlockers(issue.blockedBy || issue.blockers || issue.blocked_by),
    blocks: normalizeBlockers(issue.blocks),
    campaignName: issue.campaignName || extractCampaignName(description),
    comments: normalizeList(issue.comments).map(normalizeComment),
    description,
    id: String(issue.identifier || issue.id || issue.key || "").trim(),
    labelIds: normalizeList(issue.labelIds),
    labels: normalizeLabels(issue.labels),
    linearId: issue.linearId || issue.uuid || issue.id || "",
    project: String(project || "").trim(),
    stateIds: issue.stateIds || {},
    status: String(issue.status || state.name || issue.stateName || (typeof issue.state === "string" ? issue.state : "") || "").trim(),
    statusType: String(issue.statusType || issue.stateType || state.type || "").trim(),
    syncedReviewIds: normalizeList(issue.syncedReviewIds || issue.syncedReviews),
    title: issue.title || "",
  };
}

function normalizeBlockers(blockers) {
  return normalizeList(blockers).map((blocker) => {
    if (typeof blocker === "string") {
      return {
        id: blocker,
        status: "",
        statusType: "",
      };
    }
    const state = blocker.state && typeof blocker.state === "object" ? blocker.state : {};
    return {
      id: String(blocker.identifier || blocker.id || blocker.key || "").trim(),
      status: String(blocker.status || state.name || blocker.stateName || "").trim(),
      statusType: String(blocker.statusType || blocker.stateType || state.type || "").trim(),
    };
  });
}

function normalizeAttachment(attachment) {
  if (typeof attachment === "string") {
    return { title: "", url: attachment };
  }
  return {
    title: attachment.title || "",
    url: attachment.url || "",
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

function normalizePr(pr) {
  return {
    ...pr,
    baseRefName: pr.baseRefName || pr.baseRef || pr.base || "",
    body: pr.body || "",
    checks: pr.checks || "missing",
    closedUnmerged: pr.closedUnmerged === true,
    draft: pr.draft === true || pr.isDraft === true,
    headRefName: pr.headRefName || pr.headRef || pr.branch || "",
    headSha: pr.headSha || pr.headSHA || pr.sha || "",
    labels: normalizeLabels(pr.labels),
    metadata: pr.metadata || "missing",
    merged: pr.merged === true,
    number: Number(pr.number),
    reviews: normalizeList(pr.reviews).map(normalizeReview),
    state: pr.state || "unknown",
    title: pr.title || "",
    url: pr.url || pr.htmlUrl || pr.html_url || "",
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
  };
}

function normalizeLinearIssue(issue) {
  const labelNodes = issue.labels?.nodes || [];
  const comments = issue.comments?.nodes || [];
  const attachments = issue.attachments?.nodes || [];
  return normalizeIssue({
    attachments,
    blockedBy: extractLinearBlockedBy(issue),
    blocks: extractLinearBlocks(issue),
    comments,
    description: issue.description || "",
    id: issue.identifier,
    labelIds: labelNodes.map((label) => label.id).filter(Boolean),
    labels: labelNodes,
    linearId: issue.id,
    project: issue.project?.name || "",
    stateIds: Object.fromEntries((issue.team?.states?.nodes || []).map((state) => [state.name, state.id])),
    status: issue.state?.name || "",
    statusType: issue.state?.type || "",
    title: issue.title || "",
  });
}

async function normalizeLivePullRequests({ github, issues, prs }) {
  const issueIds = new Set(issues.map((issue) => issue.identifier).filter(Boolean));
  const relevant = prs.filter((pr) => {
    const haystack = `${pr.title || ""}\n${pr.body || ""}\n${pr.head?.ref || ""}`;
    return [...issueIds].some((issueId) => haystack.includes(issueId));
  });
  return Promise.all(relevant.map(async (pull) => github.hydratePullRequest(pull)));
}

function createLinearClient({ fetchImpl, token }) {
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
      throw new CampaignRunError(`Linear API error: ${payload.errors?.[0]?.message || response.status}`);
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
        throw new CampaignRunError("Linear commentCreate did not report success.");
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
            state { id name type }
            project { name }
            labels { nodes { id name } }
            team { states { nodes { id name type } } }
          }
        }`,
        { id: identifier },
      );
      if (!data.issue) {
        throw new CampaignRunError(`Linear issue not found: ${identifier}`);
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
    async listProjectIssues(activeProject) {
      const issues = [];
      let cursor = null;
      for (let page = 0; page < 5; page += 1) {
        const data = await graphql(
          `query CampaignProjectIssues($activeProject: String!, $cursor: String) {
            issues(
              filter: { project: { name: { eq: $activeProject } } }
              first: 100
              after: $cursor
            ) {
              nodes {
                id
                identifier
                title
                description
                state { id name type }
                project { name }
                labels { nodes { id name } }
                comments(first: 50) { nodes { id body url } }
                attachments(first: 20) { nodes { id title url } }
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
                team { states { nodes { id name type } } }
              }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          { activeProject, cursor },
        );
        issues.push(...(data.issues?.nodes || []));
        if (!data.issues?.pageInfo?.hasNextPage) {
          return issues;
        }
        cursor = data.issues.pageInfo.endCursor;
      }
      throw new CampaignRunError("Linear project issue list is too large to inspect safely.");
    },
    async updateIssue(issueId, input) {
      const data = await graphql(
        `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id }
          }
        }`,
        { id: issueId, input },
      );
      if (data.issueUpdate?.success !== true) {
        throw new CampaignRunError("Linear issueUpdate did not report success.");
      }
      return data.issueUpdate.issue;
    },
  };
}

function createGitHubClient({ fetchImpl, owner, repo, token }) {
  async function request(path) {
    const response = await fetchImpl(`${githubApiUrl}${path}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new CampaignRunError(`GitHub API error: ${payload.message || response.status}`);
    }
    return payload;
  }

  return {
    async hydratePullRequest(pull) {
      const [reviews, readiness] = await Promise.all([
        request(`/repos/${owner}/${repo}/pulls/${pull.number}/reviews?per_page=100`),
        getCommitReadiness({ owner, repo, request, sha: pull.head?.sha || "" }),
      ]);
      return normalizePr({
        baseRefName: pull.base?.ref || "",
        body: pull.body || "",
        checks: readiness.checks,
        draft: pull.draft === true,
        headRefName: pull.head?.ref || "",
        headSha: pull.head?.sha || "",
        labels: pull.labels || [],
        merged: pull.merged === true || Boolean(pull.merged_at),
        metadata: readiness.metadata,
        number: pull.number,
        reviews,
        state: pull.state,
        title: pull.title || "",
        url: pull.html_url || "",
      });
    },
    async listPullRequests() {
      return request(`/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`);
    },
  };
}

async function getCommitReadiness({ owner, repo, request, sha }) {
  if (!sha) {
    return { checks: "missing", metadata: "missing" };
  }
  const payload = await request(`/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`);
  const runs = payload.check_runs || [];
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

function extractLinearBlockedBy(issue) {
  const blockers = [];
  for (const relation of issue.relations?.nodes || []) {
    if (isBlockedByRelationType(relation.type) && relation.relatedIssue) {
      blockers.push(normalizeLinearRelatedIssue(relation.relatedIssue));
    }
  }
  for (const relation of issue.inverseRelations?.nodes || []) {
    if (isBlockingRelationType(relation.type) && relation.issue) {
      blockers.push(normalizeLinearRelatedIssue(relation.issue));
    }
  }
  return blockers;
}

function extractLinearBlocks(issue) {
  const blocked = [];
  for (const relation of issue.relations?.nodes || []) {
    if (isBlockingRelationType(relation.type) && relation.relatedIssue) {
      blocked.push(normalizeLinearRelatedIssue(relation.relatedIssue));
    }
  }
  for (const relation of issue.inverseRelations?.nodes || []) {
    if (isBlockedByRelationType(relation.type) && relation.issue) {
      blocked.push(normalizeLinearRelatedIssue(relation.issue));
    }
  }
  return blocked;
}

function normalizeLinearRelatedIssue(issue) {
  return {
    id: issue.identifier || "",
    status: issue.state?.name || "",
    statusType: issue.state?.type || "",
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

function extractCampaignName(text = "") {
  const match = String(text).match(/## Campaign\s*([\s\S]*?)(?=\n## |$)/);
  if (!match) {
    return "";
  }
  return match[1].split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function extractPrNumberFromUrl(url = "") {
  const match = String(url).match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractRecordedReviewResult(comments) {
  for (const comment of comments) {
    const body = comment.body || "";
    if (!body.includes("Conductor Live Sync") && !body.includes("Conductor live sync review id:")) {
      continue;
    }
    const decision = extractPairedReviewDecision(body);
    if (!decision.blocker) {
      return decision.decision;
    }
  }
  return "";
}

function getReviewResult(issue) {
  return issue.reviewResult || issue.githubReviewResult || issue.review_result || extractRecordedReviewResult(issue.comments);
}

function isPromotableIssue(issue) {
  return issue && !isTerminalOrAbandoned(issue) && !hasAutomationReady(issue) && (!issue.status || issue.status === "Backlog");
}

function isActiveAutomationIssue(issue) {
  return hasAutomationReady(issue)
    && !isTerminalOrAbandoned(issue)
    && (issue.status === "Todo" || issue.statusType === "unstarted");
}

function isActiveOrInReview(issue) {
  return issue && !isTerminalIssue(issue) && ["Todo", "In Review"].includes(issue.status);
}

function isTerminalIssue(issue) {
  return terminalStatuses.has(issue.status) || issue.statusType === "completed";
}

function isTerminalOrAbandoned(issue) {
  return isTerminalIssue(issue) || issue.abandoned === true || issue.outcome === "abandoned" || canceledStatuses.has(issue.status);
}

function hasAutomationReady(issue) {
  return issue.labels.includes(automationReadyLabel);
}

function isMergeAllowedReviewResult(result = "") {
  return result === "APPROVED_FOR_MERGE" || result === "APPROVED FOR MERGE";
}

function isPassing(value) {
  if (value === true || ["passing", "success", "passed"].includes(value)) {
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

function getRole(issue) {
  return getLabelSuffix(issue, "role:");
}

function getLabelSuffix(issue, prefix) {
  return issue.labels.find((label) => label.startsWith(prefix))?.slice(prefix.length) || "";
}

function matchingLabels(labels = [], allowed = []) {
  return labels.filter((label) => allowed.includes(label));
}

function normalizeLabels(labels = []) {
  return normalizeList(labels).map((label) => {
    if (typeof label === "string") {
      return label;
    }
    return label.name || label.id || "";
  }).filter(Boolean);
}

function normalizeList(value = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

function findStateId(issue, stateName) {
  return issue.stateIds?.[stateName] || "";
}

function readLinearToken(env) {
  return env.LINEAR_API_TOKEN || env.LINEAR_API_KEY || "";
}

function readGitHubToken(env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || "";
}

function parseMaxSteps(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > hardMaxSteps) {
    throw new CampaignRunError(`--max-steps must be an integer from 1 to ${hardMaxSteps}.`);
  }
  return parsed;
}

function parseRepo(repo) {
  const parts = String(repo).split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new CampaignRunError(`Invalid repo: ${repo}. Expected owner/name.`);
  }
  return parts;
}

function formatReviewId(review) {
  return String(review.id || review.htmlUrl || review.commitId || "UNKNOWN");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeErrorMessage(error) {
  const message = error?.message || String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/Authorization:\s*[^\s]+/gi, "Authorization: [redacted]")
    .replace(/(GH_TOKEN|GITHUB_TOKEN|LINEAR_API_TOKEN|LINEAR_API_KEY|OPENAI_API_KEY)=\S+/gi, "$1=[redacted]");
}

if (process.argv[1] && process.argv[1].endsWith("campaign-run.js")) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`Campaign run failed: ${sanitizeErrorMessage(error)}`);
      process.exitCode = 1;
    },
  );
}
