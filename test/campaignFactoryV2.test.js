import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignFactorySchemaVersion,
  createLiveCampaignFromPlan,
  defaultActiveProject,
  defaultActiveRepo,
  defaultLinearTeamName,
  defaultMilestone,
  defaultReviewCadence,
  formatCampaignPlan,
  getLiveCampaignPreflightFindings,
  hashCampaignPlan,
  planCampaignIdea,
  redactCampaignFactoryText,
  requiredValidationCommands,
  runCampaignFactory,
  sanitizeCampaignFactoryError,
} from "../scripts/campaign-factory-v2.js";

const fakeToken = "fake-campaign-token-for-tests-only-123456";

function safeHarnessIdea(overrides = {}) {
  return {
    activeProject: defaultActiveProject,
    activeRepo: defaultActiveRepo,
    campaign: "Campaign Factory v2 - idea-to-campaign planner",
    goal: "Build a safer planner layer that turns high-level app or harness ideas into structured Linear campaign plans.",
    hardRules: [
      "no auto-merge",
      "no GitHub label mutation",
      "no stop-label removal",
      "no workflow changes unless explicitly scoped",
      "no dependency changes unless explicitly approved",
      "no secrets printed or written",
      "no gameplay changes",
      "do not touch src/game/movement.js",
      "do not create live campaigns unless fixture/dry-run path is reviewed first",
    ],
    ideaType: "harness",
    milestone: defaultMilestone,
    requestedSequence: ["Architect", "Coder", "Tester", "Reviewer", "Release"],
    reviewCadenceHint: defaultReviewCadence,
    riskHint: "medium",
    scope: [
      "Harness scripts/tests/docs only.",
      "Generate structured campaign plans from high-level ideas.",
      "Reject unsafe scopes before runnable output.",
    ],
    validationHint: "harness",
    ...overrides,
  };
}

test("safe harness ideas produce a deterministic five-issue dry-run campaign plan", async () => {
  const plan = await runCampaignFactory({ env: {}, fixture: safeHarnessIdea() });

  assert.equal(plan.schema_version, campaignFactorySchemaVersion);
  assert.equal(plan.status, "planned");
  assert.equal(plan.mode, "fixture");
  assert.equal(plan.active_linear_project, defaultActiveProject);
  assert.equal(plan.active_repo, defaultActiveRepo);
  assert.equal(plan.linear_team, defaultLinearTeamName);
  assert.equal(plan.milestone, defaultMilestone);
  assert.equal(plan.campaign.review_cadence, "paired-review");
  assert.equal(plan.campaign.validation_profile, "validation:harness");
  assert.equal(plan.campaign.risk, "risk:medium");
  assert.equal(plan.first_runnable_issue, "campaign-architect");
  assert.equal(plan.live_creation.allowed, false);
  assert.equal(plan.live_creation.requested, false);
  assert.deepEqual(plan.issues.map((issue) => issue.role), [
    "Architect",
    "Coder",
    "Tester",
    "Reviewer",
    "Release",
  ]);
  assert.deepEqual(plan.dependency_graph, [
    "campaign-architect -> campaign-coder",
    "campaign-coder -> campaign-tester",
    "campaign-tester -> campaign-reviewer",
    "campaign-reviewer -> campaign-release",
  ]);
});

test("only Architect is Todo and automation-ready; downstream issues are blocked", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "fixture" });
  const architect = issueByRole(plan, "Architect");
  const release = issueByRole(plan, "Release");

  assert.equal(architect.state, "Todo");
  assert.deepEqual(architect.blocked_by, []);
  assert.deepEqual(architect.blocks, ["campaign-coder"]);
  assert.equal(architect.labels.includes("automation-ready"), true);

  for (const issue of plan.issues.filter((candidate) => candidate.role !== "Architect")) {
    assert.equal(issue.state, "Backlog");
    assert.equal(issue.labels.includes("automation-ready"), false);
    assert.equal(issue.blocked_by.length, 1);
  }
  assert.deepEqual(release.blocks, []);

  for (const issue of plan.issues) {
    assert.equal(countPrefixedLabels(issue, "role:"), 1, `${issue.role} role label count`);
    assert.equal(countPrefixedLabels(issue, "type:"), 1, `${issue.role} type label count`);
    assert.equal(countPrefixedLabels(issue, "risk:"), 1, `${issue.role} risk label count`);
    assert.equal(countPrefixedLabels(issue, "validation:"), 1, `${issue.role} validation label count`);
  }
});

test("generated role descriptions carry required campaign metadata and PR headings", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "fixture" });
  const coder = issueByRole(plan, "Coder");
  const tester = issueByRole(plan, "Tester");
  const sharedRequiredText = [
    "Linear project mode: main-project",
    `Active Linear project: ${defaultActiveProject}`,
    `Milestone: ${defaultMilestone}`,
    `Active GitHub repo: ${defaultActiveRepo}`,
    "review_cadence: paired-review",
    "model_hint: frontier",
    "No visible UI changes.",
    "no auto-merge",
    "do not touch src/game/movement.js",
  ];
  const prHeadings = [
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
    "## Screenshots/Video",
  ];

  for (const expected of sharedRequiredText) {
    assert.equal(coder.description.includes(expected), true, expected);
  }
  for (const command of requiredValidationCommands) {
    assert.equal(coder.validation.includes(command), true, command);
  }
  for (const heading of prHeadings) {
    assert.equal(coder.description.includes(`- \`${heading}\``), true, heading);
    assert.equal(tester.description.includes(`- \`${heading}\``), true, heading);
  }
});

test("docs-only final-audit ideas use a conservative docs sequence", () => {
  const plan = planCampaignIdea(safeHarnessIdea({
    campaign: "Planner Docs - runbook update",
    goal: "Document the campaign planner fixture workflow.",
    ideaType: "docs",
    requestedSequence: undefined,
    reviewCadenceHint: "final-audit",
    riskHint: "low",
    scope: ["Docs-only runbook update."],
    validationHint: "docs",
  }), { mode: "dry-run" });

  assert.equal(plan.status, "planned");
  assert.equal(plan.campaign.review_cadence, "final-audit");
  assert.equal(plan.campaign.validation_profile, "validation:docs");
  assert.equal(plan.campaign.risk, "risk:low");
  assert.deepEqual(plan.issues.map((issue) => issue.role), ["Architect", "Coder", "Reviewer", "Release"]);
  assert.equal(plan.issues.some((issue) => issue.role === "Tester"), false);
  assert.equal(issueByRole(plan, "Coder").labels.includes("type:docs"), true);
});

test("unsafe scopes reject before any runnable campaign output", () => {
  const cases = [
    ["premature-live-campaign-creation", { goal: "Create live Linear campaign issues now." }],
    ["premature-live-campaign-creation", { liveCreationRequested: true }],
    ["auto-merge-request", { goal: "Enable auto-merge on generated PRs." }],
    ["github-label-mutation", { goal: "Apply GitHub labels to the pull request." }],
    ["stop-label-removal", { goal: "Remove stop labels after planning." }],
    ["workflow-change", { scope: [".github/workflows/ci.yml should be edited."] }],
    ["dependency-change", { goal: "Add dependency for planning output." }],
    ["repo-settings-change", { goal: "Modify repo settings and branch protection." }],
    ["validation-weakening", { goal: "Disable tests for generated PRs." }],
    ["gameplay-scope", { goal: "Implement gameplay changes from a harness idea." }],
    ["movement-scope", { scope: ["Touch src/game/movement.js for planner output."] }],
    ["secret-handling-request", { goal: `Print Authorization: Bearer ${fakeToken}` }],
  ];

  for (const [expectedFinding, overrides] of cases) {
    const plan = planCampaignIdea(safeHarnessIdea(overrides), {
      env: { GH_TOKEN: fakeToken },
      mode: "fixture",
    });

    assert.equal(plan.status, "rejected", expectedFinding);
    assert.deepEqual(plan.issues, [], expectedFinding);
    assert.deepEqual(plan.dependency_graph, [], expectedFinding);
    assert.equal(plan.first_runnable_issue, null, expectedFinding);
    assert.equal(plan.live_creation.allowed, false, expectedFinding);
    assert.ok(plan.unsafe_findings.some((finding) => finding.id === expectedFinding), expectedFinding);
    assert.equal(JSON.stringify(plan).includes(fakeToken), false, expectedFinding);
  }
});

test("missing required input fails closed with redacted diagnostics", () => {
  const plan = planCampaignIdea({
    campaign: "Incomplete fixture",
    goal: `Plan with ${fakeToken}`,
  }, {
    env: { LINEAR_API_TOKEN: fakeToken },
    mode: "fixture",
  });

  assert.equal(plan.status, "rejected");
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.first_runnable_issue, null);
  assert.ok(plan.unsafe_findings.some((finding) => finding.id === "missing-required-input"));
  assert.equal(JSON.stringify(plan).includes(fakeToken), false);
});

test("redaction covers env values, token-like text, markdown, errors, and generated plans", () => {
  const env = {
    GH_TOKEN: fakeToken,
    LINEAR_API_TOKEN: fakeToken,
    NODE_AUTH_TOKEN: fakeToken,
  };
  const plan = planCampaignIdea(safeHarnessIdea({
    goal: `Generate a safe dry-run plan using fixture marker ${fakeToken}.`,
    scope: [`stdout contained ${fakeToken}`, `stderr contained Bearer ${fakeToken}`],
  }), { env, mode: "fixture" });
  const markdown = formatCampaignPlan(plan);
  const direct = redactCampaignFactoryText([
    `Authorization: Bearer ${fakeToken}`,
    `NODE_AUTH_TOKEN=${fakeToken}`,
    `https://user:${fakeToken}@github.com/urkrass/Tanchiki`,
    `token ${fakeToken}`,
  ].join("\n"), { env });
  const error = sanitizeCampaignFactoryError(new Error(`failed with ${fakeToken}`), { env });

  assert.equal(JSON.stringify(plan).includes(fakeToken), false);
  assert.equal(markdown.includes(fakeToken), false);
  assert.equal(direct.includes(fakeToken), false);
  assert.equal(error.includes(fakeToken), false);
});

test("fixture mode remains local and does not call mutation clients", async () => {
  let calls = 0;
  const plan = await runCampaignFactory({
    env: { GITHUB_TOKEN: fakeToken },
    fixture: safeHarnessIdea(),
    linearClient: {
      createIssue() {
        calls += 1;
      },
    },
    githubClient: {
      mutateLabel() {
        calls += 1;
      },
    },
  });

  assert.equal(plan.status, "planned");
  assert.equal(plan.mode, "fixture");
  assert.equal(calls, 0);
});

test("dry-run preview exposes live gate hash and confirmation without allowing mutation", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const markdown = formatCampaignPlan(plan);

  assert.equal(plan.status, "planned");
  assert.equal(plan.live_creation.allowed, false);
  assert.equal(plan.live_creation.preview_hash, hashCampaignPlan(plan));
  assert.equal(
    plan.live_creation.confirmation_phrase,
    `CREATE LIVE CAMPAIGN: ${plan.campaign.name} IN ${defaultActiveProject}`,
  );
  assert.equal(plan.live_creation.required_flags.includes("--live"), true);
  assert.equal(markdown.includes(plan.live_creation.preview_hash), true);
});

test("live creation stops before mutation without explicit operator confirmation", async () => {
  let calls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await runCampaignFactory({
    env: { LINEAR_API_TOKEN: fakeToken },
    fixture: safeHarnessIdea(),
    linearClient: mutationCountingClient(() => {
      calls += 1;
    }),
    options: {
      live: true,
      previewHash: plan.live_creation.preview_hash,
    },
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(calls, 0);
  assert.ok(result.unsafe_findings.some((finding) => finding.id === "operator-confirmation-required"));
});

test("live creation stops before mutation when Linear auth is missing", async () => {
  let calls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await runCampaignFactory({
    env: {},
    fixture: safeHarnessIdea(),
    linearClient: mutationCountingClient(() => {
      calls += 1;
    }),
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(calls, 0);
  assert.ok(result.unsafe_findings.some((finding) => finding.id === "missing-linear-auth"));
  assert.equal(JSON.stringify(result).includes(fakeToken), false);
});

test("live creation fails closed for wrong project before mutation", async () => {
  let calls = 0;
  const fixture = safeHarnessIdea({ activeProject: "Wrong Project" });
  const plan = planCampaignIdea(fixture, { mode: "dry-run" });
  const result = await runCampaignFactory({
    env: { LINEAR_API_TOKEN: fakeToken },
    fixture,
    linearClient: mutationCountingClient(() => {
      calls += 1;
    }),
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(calls, 0);
  assert.ok(result.unsafe_findings.some((finding) => finding.id === "wrong-active-project"));
});

test("live creation preflight revalidates labels, state, dependencies, and unsafe findings", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const badPlan = structuredClone(plan);
  badPlan.issues[1].labels.push("role:extra");
  badPlan.issues[2].state = "Todo";
  badPlan.issues[3].blocked_by = ["missing-issue"];
  badPlan.unsafe_findings.push({ id: "unsafe", message: "unsafe", evidence: "unsafe" });
  const findings = getLiveCampaignPreflightFindings(badPlan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    options: liveOptionsFor(badPlan),
  });

  assert.ok(findings.some((finding) => finding.id === "label-cardinality"));
  assert.ok(findings.some((finding) => finding.id === "invalid-downstream-state"));
  assert.ok(findings.some((finding) => finding.id === "unknown-blocker"));
  assert.ok(findings.some((finding) => finding.id === "unsafe-findings-present"));
});

test("live creation preflight binds mutation to the reviewed Linear team", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const findings = getLiveCampaignPreflightFindings(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    options: { ...liveOptionsFor(plan), team: "Different Team" },
  });

  assert.ok(findings.some((finding) => finding.id === "linear-team-mismatch"));
});

test("confirmed live creation uses only the injected Linear mutation client", async () => {
  const calls = [];
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async createIssue(issue, context) {
        calls.push({ context, issue, type: "createIssue" });
        return {
          id: `live-${issue.temporary_id}`,
          url: `https://linear.app/marsel/issue/live-${issue.temporary_id}`,
        };
      },
      async createRelation(relation) {
        calls.push({ relation, type: "createRelation" });
        return { id: `${relation.blockingIssueId}->${relation.blockedIssueId}` };
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "live-created");
  assert.equal(result.mode, "live");
  assert.equal(result.live_creation.allowed, true);
  assert.equal(result.live_creation.created_issues.length, 5);
  assert.equal(result.live_creation.relation_count, 4);
  assert.equal(calls.filter((call) => call.type === "createIssue").length, 5);
  assert.equal(calls.filter((call) => call.type === "createRelation").length, 4);
  assert.equal(JSON.stringify(result).includes(fakeToken), false);
  assert.equal(result.live_creation.dogfood_evidence.forbidden_side_effects.github_label_mutation, false);
  assert.equal(result.live_creation.dogfood_evidence.forbidden_side_effects.movement_file_touched, false);
});

test("partial live failures report created issues without cleanup or continuation", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  let issueCalls = 0;
  let relationCalls = 0;
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async createIssue(issue) {
        issueCalls += 1;
        if (issueCalls === 3) {
          throw new Error(`Linear API failed with ${fakeToken}`);
        }
        return { id: `live-${issue.temporary_id}` };
      },
      async createRelation() {
        relationCalls += 1;
        return { id: "relation" };
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "partial-failure");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(result.live_creation.created_issues.length, 2);
  assert.equal(relationCalls, 0);
  assert.equal(JSON.stringify(result).includes(fakeToken), false);
});

function issueByRole(plan, role) {
  const issue = plan.issues.find((candidate) => candidate.role === role);
  assert.ok(issue, `${role} issue missing`);
  return issue;
}

function countPrefixedLabels(issue, prefix) {
  return issue.labels.filter((label) => label.startsWith(prefix)).length;
}

function liveOptionsFor(plan) {
  return {
    confirmCreateLiveCampaign: true,
    confirmationPhrase: plan.live_creation.confirmation_phrase,
    live: true,
    previewHash: plan.live_creation.preview_hash,
  };
}

function mutationCountingClient(onMutation) {
  return {
    async createIssue() {
      onMutation();
      return { id: "unexpected" };
    },
    async createRelation() {
      onMutation();
      return { id: "unexpected" };
    },
  };
}
