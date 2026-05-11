import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignFactorySchemaVersion,
  buildRepairConfirmationPhrase,
  createLiveCampaignFromPlan,
  createLinearCampaignClient,
  defaultActiveProject,
  defaultActiveRepo,
  defaultLinearTeamName,
  defaultMilestone,
  defaultReviewCadence,
  detectDuplicateCampaign,
  formatCampaignPlan,
  getLiveCampaignPreflightFindings,
  hashCampaignPlan,
  planCampaignIdea,
  redactCampaignFactoryText,
  requiredValidationCommands,
  runCampaignFactory,
  sanitizeCampaignFactoryError,
  verifyGeneratedCampaignSchema,
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
    "campaign-coder -> campaign-reviewer",
    "campaign-tester -> campaign-reviewer",
    "campaign-coder -> campaign-release",
    "campaign-tester -> campaign-release",
    "campaign-reviewer -> campaign-release",
  ]);
  assert.deepEqual(plan.live_schema.expected_relation_graph, plan.dependency_graph);
});

test("only Architect is Todo and automation-ready; downstream issues are blocked", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "fixture" });
  const architect = issueByRole(plan, "Architect");
  const coder = issueByRole(plan, "Coder");
  const tester = issueByRole(plan, "Tester");
  const reviewer = issueByRole(plan, "Reviewer");
  const release = issueByRole(plan, "Release");

  assert.equal(architect.state, "Todo");
  assert.deepEqual(architect.blocked_by, []);
  assert.deepEqual(architect.blocks, ["campaign-coder"]);
  assert.equal(architect.labels.includes("automation-ready"), true);
  assert.deepEqual(coder.blocked_by, ["campaign-architect"]);
  assert.deepEqual(coder.blocks, ["campaign-tester", "campaign-reviewer", "campaign-release"]);
  assert.deepEqual(tester.blocked_by, ["campaign-coder"]);
  assert.deepEqual(tester.blocks, ["campaign-reviewer", "campaign-release"]);
  assert.deepEqual(reviewer.blocked_by, ["campaign-coder", "campaign-tester"]);
  assert.deepEqual(reviewer.blocks, ["campaign-release"]);
  assert.deepEqual(release.blocked_by, ["campaign-coder", "campaign-tester", "campaign-reviewer"]);

  for (const issue of plan.issues.filter((candidate) => candidate.role !== "Architect")) {
    assert.equal(issue.state, "Backlog");
    assert.equal(issue.labels.includes("automation-ready"), false);
    assert.ok(issue.blocked_by.length >= 1);
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
    "Campaign Factory idempotency key: cfv2:",
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

test("generated campaign schema audit requires machine relation graph correctness", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  assert.deepEqual(verifyGeneratedCampaignSchema(plan), []);

  const missingRelation = structuredClone(plan);
  missingRelation.issues.find((issue) => issue.role === "Release").blocked_by = ["campaign-reviewer"];
  missingRelation.dependency_graph = missingRelation.dependency_graph.filter((edge) => edge !== "campaign-coder -> campaign-release");
  const missingFindings = verifyGeneratedCampaignSchema(missingRelation);
  assert.ok(missingFindings.some((finding) => finding.id === "required-relation-missing"));
  assert.ok(missingFindings.some((finding) => finding.id === "dependency-graph-extra-edge"));

  const descriptionOnlyGraph = structuredClone(plan);
  descriptionOnlyGraph.dependency_graph.push("campaign-architect -> campaign-release");
  const descriptionFindings = verifyGeneratedCampaignSchema(descriptionOnlyGraph);
  assert.ok(descriptionFindings.some((finding) => finding.id === "dependency-graph-extra-edge"));
});

test("live creation preflight recomputes hash instead of trusting embedded preview hash", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const tamperedPlan = structuredClone(plan);
  tamperedPlan.campaign.goal = "Tampered after dry-run preview was reviewed.";
  tamperedPlan.live_creation.preview_hash = plan.live_creation.preview_hash;
  const findings = getLiveCampaignPreflightFindings(tamperedPlan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    options: liveOptionsFor(tamperedPlan),
  });

  assert.ok(findings.some((finding) => finding.id === "preview-hash-mismatch"));
});

test("live creation preflight binds mutation to the reviewed Linear team", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const findings = getLiveCampaignPreflightFindings(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    options: { ...liveOptionsFor(plan), team: "Different Team" },
  });

  assert.ok(findings.some((finding) => finding.id === "linear-team-mismatch"));
});

test("Linear live client fails closed when requested team is missing", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const linear = linearFetchFixture(plan, {
    projectTeamName: "Fallback Team",
    teamName: "Different Team",
  });
  const client = createLinearCampaignClient({
    fetchImpl: linear.fetchImpl,
    token: fakeToken,
  });

  await assert.rejects(
    () => client.createIssue(issueByRole(plan, "Architect"), {
      activeProject: defaultActiveProject,
      milestone: defaultMilestone,
      team: defaultLinearTeamName,
    }),
    (error) => error.reason === "linear-team-not-found",
  );
  assert.equal(linear.issueCreateCount(), 0);
});

test("duplicate detection identifies full and partial generated campaigns", () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const existingIssuesOnly = existingCampaignIssues(plan);
  const existingWithRelations = withMachineRelations(plan, existingIssuesOnly);

  assert.equal(detectDuplicateCampaign(plan, []).status, "none");
  assert.equal(detectDuplicateCampaign(plan, existingIssuesOnly).status, "issues_only");
  assert.equal(detectDuplicateCampaign(plan, existingWithRelations).status, "already_exists");
  assert.equal(detectDuplicateCampaign(plan, existingIssuesOnly.slice(0, 2)).status, "partial_exists");
  assert.equal(
    detectDuplicateCampaign(plan, existingIssuesOnly.map((issue) => ({
      ...issue,
      projectMilestone: { name: "Other milestone" },
    }))).status,
    "none",
  );
  const relationCheck = detectDuplicateCampaign(plan, existingWithRelations).relation_check;
  assert.equal(relationCheck.actual_relation_count, 7);
  assert.deepEqual(relationCheck.missing_relation_edges, []);
});

test("confirmed live creation returns already_exists without mutation for duplicate campaigns", async () => {
  let issueCalls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return withMachineRelations(plan, existingCampaignIssues(plan, "MAR-E", "existing"));
      },
      async createIssue() {
        issueCalls += 1;
        return { id: "unexpected" };
      },
      async createRelation() {
        throw new Error("relations should not be created for duplicate campaigns");
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "already_exists");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(result.live_creation.duplicate_check.status, "already_exists");
  assert.equal(result.live_creation.duplicate_check.relation_check.actual_relation_count, 7);
  assert.equal(result.live_creation.created_issues.length, 0);
  assert.equal(result.live_creation.created_relations.length, 0);
  assert.equal(issueCalls, 0);
});

test("partial existing campaigns fail closed before live mutation", async () => {
  let issueCalls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return [{
          description: issueByRole(plan, "Architect").description,
          id: "existing-architect",
          identifier: "MAR-P1",
          projectMilestone: { name: defaultMilestone },
          state: { name: "Todo", type: "unstarted" },
          title: issueByRole(plan, "Architect").title,
        }];
      },
      async createIssue() {
        issueCalls += 1;
        return { id: "unexpected" };
      },
      async createRelation() {
        throw new Error("relations should not be created for partial campaigns");
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "partial_exists");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(result.live_creation.duplicate_check.status, "partial_exists");
  assert.equal(result.live_creation.created_issues.length, 0);
  assert.equal(issueCalls, 0);
});

test("issues-only existing campaigns fail closed without explicit repair mode", async () => {
  let mutationCalls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return existingCampaignIssues(plan, "MAR-I", "issues-only");
      },
      async createIssue() {
        mutationCalls += 1;
        return { id: "unexpected" };
      },
      async createRelation() {
        mutationCalls += 1;
        return { id: "unexpected" };
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "issues_only");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(result.live_creation.duplicate_check.status, "issues_only");
  assert.equal(result.live_creation.duplicate_check.relation_check.missing_relation_edges.length, 7);
  assert.equal(mutationCalls, 0);
});

test("confirmed live creation passes with exact reviewed Linear team", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const linear = linearFetchFixture(plan);
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    fetchImpl: linear.fetchImpl,
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "live-created");
  assert.equal(result.live_creation.created_issues.length, 5);
  assert.equal(result.live_creation.relation_count, 7);
  assert.equal(result.live_creation.dogfood_evidence.duplicate_check.status, "none");
  assert.equal(result.live_creation.dogfood_evidence.post_mutation_duplicate_check.status, "already_exists");
  assert.deepEqual(result.live_creation.relation_verification.missing_relation_edges, []);
  assert.equal(linear.contextTeamName(), defaultLinearTeamName);
  assert.equal(linear.issueCreateCount(), 5);
  assert.equal(linear.relationCreateCount(), 7);
  assert.equal(linear.relationInputs().every((input) => input.type === "blocks"), true);
});

test("confirmed live creation uses only the injected Linear mutation client", async () => {
  const calls = [];
  const createdIssues = [];
  const relationEdges = [];
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        calls.push({ type: "findExistingCampaignIssues" });
        return withMachineRelations(plan, createdIssues, relationEdges);
      },
      async createIssue(issue, context) {
        calls.push({ context, issue, type: "createIssue" });
        const created = {
          description: issue.description,
          id: `live-${issue.temporary_id}`,
          identifier: `MAR-${createdIssues.length + 1}`,
          projectMilestone: { name: defaultMilestone },
          state: { name: issue.state, type: "unstarted" },
          title: issue.title,
          url: `https://linear.app/marsel/issue/live-${issue.temporary_id}`,
        };
        createdIssues.push(created);
        return created;
      },
      async createRelation(relation) {
        calls.push({ relation, type: "createRelation" });
        relationEdges.push({
          blockedIssueId: relation.blockedIssueId,
          blockingIssueId: relation.blockingIssueId,
        });
        return { id: `${relation.blockingIssueId}->${relation.blockedIssueId}` };
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "live-created");
  assert.equal(result.mode, "live");
  assert.equal(result.live_creation.allowed, true);
  assert.equal(result.live_creation.created_issues.length, 5);
  assert.equal(result.live_creation.relation_count, 7);
  assert.equal(calls.filter((call) => call.type === "findExistingCampaignIssues").length, 2);
  assert.equal(calls.filter((call) => call.type === "createIssue").length, 5);
  assert.equal(calls.filter((call) => call.type === "createRelation").length, 7);
  assert.equal(JSON.stringify(result).includes(fakeToken), false);
  assert.equal(result.live_creation.dogfood_evidence.forbidden_side_effects.github_label_mutation, false);
  assert.equal(result.live_creation.dogfood_evidence.forbidden_side_effects.movement_file_touched, false);
});

test("live creation is blocked when relation read-back cannot prove the graph", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const createdIssues = [];
  let relationCalls = 0;
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return createdIssues;
      },
      async createIssue(issue) {
        const created = {
          description: issue.description,
          id: `live-${issue.temporary_id}`,
          identifier: `MAR-R${createdIssues.length + 1}`,
          projectMilestone: { name: defaultMilestone },
          state: { name: issue.state, type: "unstarted" },
          title: issue.title,
        };
        createdIssues.push(created);
        return created;
      },
      async createRelation() {
        relationCalls += 1;
        return { id: `relation-${relationCalls}` };
      },
    },
    options: liveOptionsFor(plan),
  });

  assert.equal(result.status, "partial-failure");
  assert.equal(result.live_creation.allowed, false);
  assert.equal(result.live_creation.created_issues.length, 5);
  assert.equal(result.live_creation.created_relations.length, 7);
  assert.equal(result.live_creation.relation_verification.missing_relation_edges.length, 7);
});

test("explicit relation repair mode repairs only issues-only campaigns", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const existingIssues = existingCampaignIssues(plan, "MAR-F", "repair");
  const relationEdges = [];
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return withMachineRelations(plan, existingIssues, relationEdges);
      },
      async createIssue() {
        throw new Error("repair mode must not create issues");
      },
      async createRelation(relation) {
        relationEdges.push({
          blockedIssueId: relation.blockedIssueId,
          blockingIssueId: relation.blockingIssueId,
        });
        return { id: `${relation.blockingIssueId}->${relation.blockedIssueId}` };
      },
    },
    options: repairOptionsFor(plan),
  });

  assert.equal(result.status, "relations-repaired");
  assert.equal(result.live_creation.allowed, true);
  assert.equal(result.live_creation.created_issues.length, 0);
  assert.equal(result.live_creation.created_relations.length, 7);
  assert.equal(result.live_creation.relation_verification.actual_relation_count, 7);
  assert.deepEqual(result.live_creation.relation_verification.missing_relation_edges, []);
});

test("relation repair mode requires exact repair confirmation", async () => {
  let mutationCalls = 0;
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return existingCampaignIssues(plan, "MAR-G", "repair-missing-confirmation");
      },
      async createIssue() {
        mutationCalls += 1;
        return { id: "unexpected" };
      },
      async createRelation() {
        mutationCalls += 1;
        return { id: "unexpected" };
      },
    },
    options: {
      ...repairOptionsFor(plan),
      confirmationPhrase: plan.live_creation.confirmation_phrase,
    },
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.live_creation.allowed, false);
  assert.ok(result.live_creation.findings.some((finding) => finding.id === "confirmation-phrase-mismatch"));
  assert.equal(mutationCalls, 0);
});

test("partial live failures report created issues without cleanup or continuation", async () => {
  const plan = planCampaignIdea(safeHarnessIdea(), { mode: "dry-run" });
  let issueCalls = 0;
  let relationCalls = 0;
  const result = await createLiveCampaignFromPlan(plan, {
    env: { LINEAR_API_TOKEN: fakeToken },
    linearClient: {
      async findExistingCampaignIssues() {
        return [];
      },
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

function repairOptionsFor(plan) {
  return {
    confirmRepairRelations: true,
    confirmationPhrase: buildRepairConfirmationPhrase(plan),
    live: true,
    previewHash: plan.live_creation.preview_hash,
    repairRelations: true,
  };
}

function existingCampaignIssues(plan, identifierPrefix = "MAR-D", idPrefix = "issue") {
  return plan.issues.map((issue, index) => ({
    description: issue.description,
    id: `${idPrefix}-${index}`,
    identifier: `${identifierPrefix}${index}`,
    projectMilestone: { name: defaultMilestone },
    state: { name: issue.state, type: issue.state === "Done" ? "completed" : "unstarted" },
    title: issue.title,
    url: `https://linear.app/marsel/issue/${identifierPrefix}${index}`,
  }));
}

function withMachineRelations(plan, issues, relationEdges = null) {
  const issueByTempId = new Map();
  const clonedIssues = issues.map((issue) => ({
    ...issue,
    inverseRelations: { nodes: [] },
    relations: { nodes: [] },
  }));
  for (const issue of plan.issues) {
    const existingIssue = clonedIssues.find((candidate) => candidate.title === issue.title);
    if (existingIssue) {
      issueByTempId.set(issue.temporary_id, existingIssue);
    }
  }

  const edges = relationEdges || plan.issues.flatMap((issue) => (issue.blocked_by || []).map((blocker) => ({
    blockedIssueId: issueByTempId.get(issue.temporary_id)?.id,
    blockingIssueId: issueByTempId.get(blocker)?.id,
  }))).filter((edge) => edge.blockedIssueId && edge.blockingIssueId);

  for (const edge of edges) {
    const blockingIssue = clonedIssues.find((issue) => issue.id === edge.blockingIssueId);
    const blockedIssue = clonedIssues.find((issue) => issue.id === edge.blockedIssueId);
    if (!blockingIssue || !blockedIssue) {
      continue;
    }
    blockingIssue.relations.nodes.push({
      relatedIssue: minimalLinearIssue(blockedIssue),
      type: "blocks",
    });
    blockedIssue.inverseRelations.nodes.push({
      issue: minimalLinearIssue(blockingIssue),
      type: "blocks",
    });
  }

  return clonedIssues;
}

function minimalLinearIssue(issue) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    state: issue.state,
    title: issue.title,
  };
}

function linearFetchFixture(plan, {
  projectTeamName = defaultLinearTeamName,
  teamName = defaultLinearTeamName,
} = {}) {
  const requests = [];
  let issueCount = 0;
  let relationCount = 0;
  const createdIssues = [];
  const relationEdges = [];
  return {
    contextTeamName() {
      return requests.find((request) => request.query.includes("CampaignFactoryLiveContext"))
        ?.variables?.team;
    },
    async fetchImpl(_url, request) {
      const body = JSON.parse(request.body);
      requests.push(body);
      if (body.query.includes("CampaignFactoryLiveContext")) {
        return jsonResponse({ data: linearContextData(plan, { projectTeamName, teamName }) });
      }
      if (body.query.includes("CampaignFactoryFindDuplicateIssues")) {
        return jsonResponse({ data: { issues: { nodes: withMachineRelations(plan, createdIssues, relationEdges) } } });
      }
      if (body.query.includes("CampaignFactoryCreateIssue")) {
        issueCount += 1;
        const issue = plan.issues.find((candidate) => candidate.title === body.variables.input.title);
        const createdIssue = {
          description: issue?.description || body.variables.input.description,
          id: `linear-issue-${issueCount}`,
          identifier: `MAR-X${issueCount}`,
          projectMilestone: { name: defaultMilestone },
          state: { name: issue?.state || "Backlog", type: "unstarted" },
          title: body.variables.input.title,
          url: `https://linear.app/marsel/issue/MAR-X${issueCount}`,
        };
        createdIssues.push(createdIssue);
        return jsonResponse({
          data: {
            issueCreate: {
              issue: createdIssue,
              success: true,
            },
          },
        });
      }
      if (body.query.includes("CampaignFactoryCreateRelation")) {
        relationCount += 1;
        relationEdges.push({
          blockedIssueId: body.variables.input.relatedIssueId,
          blockingIssueId: body.variables.input.issueId,
          type: body.variables.input.type,
        });
        return jsonResponse({
          data: {
            issueRelationCreate: {
              relation: { id: `linear-relation-${relationCount}` },
              success: true,
            },
          },
        });
      }
      throw new Error("Unexpected Linear fixture query.");
    },
    issueCreateCount() {
      return issueCount;
    },
    relationCreateCount() {
      return relationCount;
    },
    relationInputs() {
      return relationEdges;
    },
  };
}

function linearContextData(plan, { projectTeamName, teamName }) {
  const states = [
    { id: "state-todo", name: "Todo", type: "unstarted" },
    { id: "state-backlog", name: "Backlog", type: "backlog" },
  ];
  const labels = [...new Set(plan.issues.flatMap((issue) => issue.labels))]
    .map((label, index) => ({ id: `label-${index}`, name: label }));
  return {
    issueLabels: { nodes: labels },
    projectMilestones: { nodes: [{ id: "milestone-1", name: defaultMilestone }] },
    projects: {
      nodes: [{
        id: "project-1",
        name: defaultActiveProject,
        teams: {
          nodes: [{ id: "project-team-1", name: projectTeamName, states: { nodes: states } }],
        },
      }],
    },
    teams: {
      nodes: [{ id: "team-1", name: teamName, states: { nodes: states } }],
    },
  };
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
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
