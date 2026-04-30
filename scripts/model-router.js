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
const GATE_LABELS = ["blocked", "needs-human-approval", "human-only", "risk:human-only"];
const STOP_LABELS = ["merge:do-not-merge", "merge:human-required", ...GATE_LABELS];
const MODEL_HINTS = ["frontier", "cheap", "local-ok", "human-only"];
const REVIEW_CADENCES = ["paired-review", "final-audit", "let-architect-decide"];

export function routeIssue(metadata) {
  const issue = normalizeIssue(metadata);
  const stopConditions = [];

  requireValue(stopConditions, "active Linear project", issue.activeProject);
  requireValue(stopConditions, "next issue", issue.id || issue.title);
  requireValue(stopConditions, "issue state", issue.status);
  requireValue(stopConditions, "review cadence", issue.reviewCadence);
  requireValue(stopConditions, "model_hint", issue.modelHint);
  requireValue(stopConditions, "context pack", issue.contextPack);

  if (issue.reviewCadence && !REVIEW_CADENCES.includes(issue.reviewCadence)) {
    stopConditions.push(`review cadence is not allowed: ${issue.reviewCadence}`);
  }
  if (issue.modelHint && !MODEL_HINTS.includes(issue.modelHint)) {
    stopConditions.push(`model_hint is not allowed: ${issue.modelHint}`);
  }

  const roleLabels = matchingLabels(issue.labels, ROLE_LABELS);
  const typeLabels = matchingLabels(issue.labels, TYPE_LABELS);
  const riskLabels = matchingLabels(issue.labels, RISK_LABELS);
  const validationLabels = matchingLabels(issue.labels, VALIDATION_LABELS);

  requireExactlyOne(stopConditions, "role", roleLabels, "role:*");
  requireExactlyOne(stopConditions, "type", typeLabels, "type:*");
  requireExactlyOne(stopConditions, "risk", riskLabels, "risk:*");
  requireExactlyOne(stopConditions, "validation", validationLabels, "validation:*");

  const gateLabels = matchingLabels(issue.labels, GATE_LABELS);
  const stopLabels = matchingLabels(issue.labels, STOP_LABELS);
  if (gateLabels.length > 0) {
    stopConditions.push(`human or gate labels present: ${gateLabels.join(", ")}`);
  }
  if (stopLabels.length > 0) {
    stopConditions.push(`stop labels present: ${stopLabels.join(", ")}`);
  }
  if (issue.blockedBy.length > 0) {
    stopConditions.push(`unresolved blockers present: ${issue.blockedBy.join(", ")}`);
  }
  if (issue.status && issue.status !== "Todo") {
    stopConditions.push(`issue status is not Todo: ${issue.status}`);
  }

  const role = stripPrefix(roleLabels[0], "role:");
  const type = stripPrefix(typeLabels[0], "type:");
  const risk = stripPrefix(riskLabels[0], "risk:");
  const validation = stripPrefix(validationLabels[0], "validation:");

  if (role === "reviewer") {
    validateReviewerPr(stopConditions, issue);
  }

  const recommendedModelClass = chooseModelClass(issue, {
    role,
    type,
    risk,
    validation,
  });
  const requiredIdentity = chooseIdentity(issue, role);
  const recommendedPrompt = choosePrompt(issue, role);

  return {
    run: stopConditions.length === 0,
    nextIssue: formatIssue(issue),
    activeLinearProject: issue.activeProject || "UNKNOWN",
    role: role || "UNKNOWN",
    type: type || "UNKNOWN",
    risk: risk || "UNKNOWN",
    validation: validation || "UNKNOWN",
    reviewCadence: issue.reviewCadence || "UNKNOWN",
    modelHint: issue.modelHint || "UNKNOWN",
    recommendedModelClass,
    requiredIdentity,
    recommendedPrompt,
    requiredContextPack: issue.contextPack || "UNKNOWN",
    validationProfile: validation ? `validation:${validation}` : "UNKNOWN",
    stopConditions: stopConditions.length > 0 ? stopConditions : ["none"],
    nextHumanAction:
      stopConditions.length > 0
        ? "Fix the listed stop conditions before running an agent."
        : `Run ${recommendedPrompt} for ${formatIssue(issue)}.`,
  };
}

export function formatRecommendation(recommendation) {
  return [
    recommendation.run ? "RUN" : "DO NOT RUN",
    `next issue: ${recommendation.nextIssue}`,
    `active Linear project: ${recommendation.activeLinearProject}`,
    `role/type/risk/validation: ${recommendation.role} / ${recommendation.type} / ${recommendation.risk} / ${recommendation.validation}`,
    `review cadence: ${recommendation.reviewCadence}`,
    `model_hint: ${recommendation.modelHint}`,
    `recommended model class: ${recommendation.recommendedModelClass}`,
    `required identity: ${recommendation.requiredIdentity}`,
    `recommended prompt: ${recommendation.recommendedPrompt}`,
    `required context pack: ${recommendation.requiredContextPack}`,
    `validation profile: ${recommendation.validationProfile}`,
    "stop conditions:",
    ...recommendation.stopConditions.map((condition) => `- ${condition}`),
    `next human action: ${recommendation.nextHumanAction}`,
  ].join("\n");
}

function normalizeIssue(metadata) {
  const issue = metadata.issue || metadata;
  return {
    activeProject: metadata.activeProject || issue.activeProject || issue.project || "",
    blockedBy: normalizeList(issue.blockedBy || issue.blockers || metadata.blockedBy),
    contextPack: issue.contextPack || metadata.contextPack || "",
    id: issue.id || issue.identifier || "",
    labels: normalizeLabels(issue.labels || metadata.labels),
    modelHint: normalizeModelHint(issue.modelHint || issue.model_hint || metadata.modelHint || metadata.model_hint),
    pr: issue.pr || metadata.pr || null,
    reviewCadence: normalizeReviewCadence(
      issue.reviewCadence || issue.review_cadence || metadata.reviewCadence || metadata.review_cadence,
    ),
    status: normalizeStatus(issue.status || issue.state || ""),
    title: issue.title || "",
  };
}

function chooseIdentity(issue, role) {
  if (role === "reviewer" && issue.pr) {
    return "Reviewer App";
  }
  if (issue.modelHint === "human-only" || issue.labels.includes("human-only") || issue.labels.includes("risk:human-only")) {
    return "human-only";
  }
  return "normal GitHub";
}

function chooseModelClass(issue, labels) {
  if (issue.modelHint === "human-only" || labels.risk === "human-only") {
    return "human-only";
  }
  if (
    issue.modelHint === "frontier" ||
    labels.risk === "medium" ||
    labels.risk === "high" ||
    labels.type === "movement" ||
    labels.role === "architect" ||
    labels.role === "reviewer" ||
    isTrustBoundary(issue, labels)
  ) {
    return "frontier";
  }
  if (issue.modelHint === "local-ok" && labels.risk === "low" && isLowCostLane(labels)) {
    return "local-ok";
  }
  if (issue.modelHint === "cheap" && labels.risk === "low" && isLowCostLane(labels)) {
    return "cheap";
  }
  return "frontier";
}

function choosePrompt(issue, role) {
  if (issue.modelHint === "human-only" || issue.labels.includes("human-only") || issue.labels.includes("risk:human-only")) {
    return "human gate";
  }
  if (role === "reviewer" && issue.pr) {
    return "prompts/short/reviewer-app-dispatcher.md";
  }
  if (role === "release") {
    return "prompts/short/release.md";
  }
  return "prompts/short/dispatcher.md";
}

function validateReviewerPr(stopConditions, issue) {
  if (!issue.pr) {
    stopConditions.push("Reviewer issue is missing PR readiness details");
    return;
  }
  if (!issue.pr.number && !issue.pr.url) {
    stopConditions.push("Reviewer PR details must include a PR number or URL");
  }
  if (issue.reviewCadence === "paired-review") {
    if (issue.pr.state !== "open") {
      stopConditions.push(`paired-review PR is not open: ${issue.pr.state || "UNKNOWN"}`);
    }
    if (issue.pr.draft === true) {
      stopConditions.push("paired-review PR is Draft");
    }
    if (issue.pr.merged === true) {
      stopConditions.push("paired-review PR is already merged");
    }
    if (issue.pr.checks !== "passing") {
      stopConditions.push(`paired-review PR checks are not passing: ${issue.pr.checks || "UNKNOWN"}`);
    }
  }
}

function isLowCostLane(labels) {
  return ["docs", "harness", "test"].includes(labels.type) || labels.role === "release";
}

function isTrustBoundary(issue, labels) {
  const haystack = `${issue.title} ${issue.contextPack}`.toLowerCase();
  return (
    labels.type === "architecture" ||
    haystack.includes("trust-boundary") ||
    haystack.includes("auto-merge") ||
    haystack.includes("reviewer app") ||
    haystack.includes("safety policy") ||
    haystack.includes("ci/workflow") ||
    haystack.includes("deployment") ||
    haystack.includes("dependency") ||
    haystack.includes("security") ||
    haystack.includes("protected-file")
  );
}

function normalizeLabels(labels = []) {
  return labels.map((label) => {
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

function normalizeModelHint(value = "") {
  return String(value).replace(/^model_hint:\s*/, "").trim();
}

function normalizeReviewCadence(value = "") {
  return String(value).replace(/^review_cadence:\s*/, "").trim();
}

function normalizeStatus(value = "") {
  const status = typeof value === "string" ? value : value.name || "";
  return status.trim();
}

function matchingLabels(labels, allowed) {
  return labels.filter((label) => allowed.includes(label));
}

function requireExactlyOne(stopConditions, name, labels, pattern) {
  if (labels.length !== 1) {
    stopConditions.push(`${name} metadata must have exactly one ${pattern}; found ${labels.length || "none"}`);
  }
}

function requireValue(stopConditions, name, value) {
  if (!value) {
    stopConditions.push(`missing ${name}`);
  }
}

function stripPrefix(value = "", prefix) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : "";
}

function formatIssue(issue) {
  if (issue.id && issue.title) {
    return `${issue.id} - ${issue.title}`;
  }
  return issue.id || issue.title || "UNKNOWN";
}

function readCliInput(args) {
  const fixtureIndex = args.indexOf("--fixture");
  if (fixtureIndex !== -1) {
    return JSON.parse(readFileSync(args[fixtureIndex + 1], "utf8"));
  }
  const jsonIndex = args.indexOf("--json");
  if (jsonIndex !== -1) {
    return JSON.parse(args[jsonIndex + 1]);
  }
  throw new Error("Usage: node scripts/model-router.js --fixture <path> or --json '<metadata>'");
}

function main() {
  const metadata = readCliInput(process.argv.slice(2));
  console.log(formatRecommendation(routeIssue(metadata)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`model-router dry-run failed: ${error.message}`);
    process.exitCode = 1;
  }
}
