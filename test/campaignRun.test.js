import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatCampaignRunResult,
  main,
  parseArgs,
  runCampaignStateMachine,
} from "../scripts/campaign-run.js";

const activeProject = "Tanchiki - Playable Tank RPG Prototype";
const campaign = "Campaign Autopilot v1 - run campaign until complete or hard safety gate";

function issue(role, overrides = {}) {
  const ids = {
    architect: "MAR-361",
    coder: "MAR-362",
    test: "MAR-363",
    reviewer: "MAR-364",
    release: "MAR-365",
  };
  const type = role === "architect" ? "architecture" : role === "test" ? "test" : role === "release" ? "docs" : "harness";
  const risk = role === "release" ? "low" : "medium";
  const validation = role === "release" ? "docs" : "harness";

  return {
    id: ids[role],
    title: `${role} issue`,
    description: [
      "## Campaign",
      "",
      campaign,
      "",
      "review_cadence: paired-review",
      "Shape A with Tester. Tester is required and must not be skipped.",
    ].join("\n"),
    labels: [`role:${role}`, `type:${type}`, `risk:${risk}`, `validation:${validation}`],
    project: activeProject,
    status: "Backlog",
    stateIds: {
      Done: `${ids[role]}-done`,
      "In Review": `${ids[role]}-review`,
      Todo: `${ids[role]}-todo`,
    },
    ...overrides,
  };
}

function shapeAIssues(overrides = {}) {
  return [
    issue("architect", { status: "Done" }),
    issue("coder", overrides.coder || {}),
    issue("test", overrides.test || {}),
    issue("reviewer", overrides.reviewer || {}),
    issue("release", overrides.release || {}),
  ];
}

function state(overrides = {}) {
  return {
    activeProject,
    automationReadyLabelId: "label-auto",
    issues: shapeAIssues(overrides),
    prs: [],
    ...overrides,
  };
}

function prBody(issueId = "MAR-362", metadata = {}) {
  const role = metadata.role || "coder";
  const type = metadata.type || "harness";
  const risk = metadata.risk || "medium";
  const validation = metadata.validation || "harness";
  return [
    "## Linked Linear Issue",
    "",
    `Closes: ${issueId}`,
    "",
    `Active Linear project: ${activeProject}`,
    "",
    "## Role / Type / Risk / Validation",
    "",
    `- Role: ${role}`,
    `- Type: ${type}`,
    `- Risk: ${risk}`,
    `- Validation profile: ${validation}`,
    "",
    "## Summary",
    "",
    "- Adds campaign runner.",
    "",
    "## Files Changed",
    "",
    "- scripts/campaign-run.js",
    "",
    "## Tests Run",
    "",
    "- node --test test/campaignRun.test.js",
    "",
    "## Manual QA",
    "",
    "- Dry-run output inspected.",
    "",
    "## Broad Scan Reason",
    "",
    "- Trust-boundary harness orchestration.",
    "",
    "## Conflict Risk",
    "",
    "- Medium: package.json and harness scripts.",
    "",
    "## Acceptance Labels",
    "",
    "- Merge label: none",
    "- Reviewer label: none",
    "- Human gate: human merge required",
    "",
    "## PR Readiness",
    "",
    "- Draft allowed reason, if Draft: n/a",
    "- Paired-review candidate: yes",
    "- Auto-merge candidate: no",
    "",
    "## Visible UI Expectation",
    "",
    "- No visible UI changes.",
    "",
    "## Known Limitations",
    "",
    "- Auto-merge remains out of scope.",
  ].join("\n");
}

function readyPr(overrides = {}) {
  return {
    baseRefName: "main",
    body: prBody(),
    checks: "passing",
    draft: false,
    headRefName: "codex/mar-362-campaign-runner",
    headSha: "abc123",
    labels: [],
    merged: false,
    number: 201,
    reviews: [],
    state: "open",
    title: "MAR-362 campaign runner",
    url: "https://github.com/urkrass/Tanchiki/pull/201",
    ...overrides,
  };
}

function botReview(overrides = {}) {
  return {
    authorLogin: "tanchiki-reviewer[bot]",
    body: "APPROVED FOR MERGE",
    commitId: "abc123",
    htmlUrl: "https://github.com/urkrass/Tanchiki/pull/201#pullrequestreview-1",
    id: "review-1",
    state: "APPROVED",
    ...overrides,
  };
}

test("parser supports dry-run and max steps and refuses auto-merge flags", () => {
  assert.deepEqual(parseArgs(["--active-project", activeProject, "--dry-run", "--max-steps", "7"]), {
    activeProject,
    dryRun: true,
    fixture: "",
    json: "",
    maxSteps: 7,
    repo: "urkrass/Tanchiki",
  });
  assert.throws(() => parseArgs(["--max-steps", "0"]), /--max-steps/);
  assert.throws(() => parseArgs(["--auto-merge"]), /Auto-merge is out of scope/);
});

test("active campaign detection stops on exactly one active Coder candidate", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { labels: [...issue("coder").labels, "automation-ready"], status: "Todo" },
    }),
  });

  assert.equal(result.reason, "coder-operator-required");
  assert.match(result.nextPrompt, /Run Dispatcher for MAR-362 as coder/);
  assert.equal(result.roleIssueIds.coder, "MAR-362");
  assert.match(formatCampaignRunResult(result), /Detected PR: none/);
});

test("completed historical automation-ready labels are ignored for active selection", async () => {
  const oldCampaign = {
    ...issue("coder", {
      description: "## Campaign\n\nOld completed campaign",
      id: "MAR-300",
      labels: [...issue("coder").labels, "automation-ready"],
      status: "Done",
      statusType: "completed",
    }),
  };
  const result = await runCampaignStateMachine({
    dryRun: true,
    state: {
      ...state({
        coder: { labels: [...issue("coder").labels, "automation-ready"], status: "Todo" },
      }),
      issues: [...shapeAIssues({
        coder: { labels: [...issue("coder").labels, "automation-ready"], status: "Todo" },
      }), oldCampaign],
    },
  });

  assert.equal(result.campaignName, campaign);
  assert.equal(result.reason, "coder-operator-required");
});

test("ambiguous active campaigns stop before mutation", async () => {
  const other = issue("coder", {
    description: "## Campaign\n\nSecond active campaign",
    id: "MAR-400",
    labels: [...issue("coder").labels, "automation-ready"],
    status: "Todo",
  });
  const result = await runCampaignStateMachine({
    dryRun: false,
    state: {
      ...state({
        coder: { labels: [...issue("coder").labels, "automation-ready"], status: "Todo" },
      }),
      issues: [...shapeAIssues({
        coder: { labels: [...issue("coder").labels, "automation-ready"], status: "Todo" },
      }), other],
    },
  });

  assert.equal(result.reason, "ambiguous-active-campaign");
  assert.equal(result.mutationApplied, false);
});

test("dry-run promotes Coder after Architect Done then stops at Coder prompt", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 3,
    state: state(),
  });

  assert.equal(result.steps[0].action, "promote");
  assert.equal(result.steps[0].issue, "MAR-362");
  assert.equal(result.steps[0].mutationApplied, false);
  assert.equal(result.reason, "coder-operator-required");
});

test("Clean Autopilot Run v1 promotes only the proof Coder after Architect evidence is Done", async () => {
  const cleanCampaign = "Clean Autopilot Run v1 — caveat-free foreground campaign proof";
  const description = [
    "## Campaign",
    "",
    cleanCampaign,
    "",
    "review_cadence: paired-review",
    "Shape A with Tester. Tester is required and must not be skipped.",
  ].join("\n");
  const cleanIssue = ({ id, labels, status = "Backlog", title }) => ({
    id,
    title,
    description,
    labels,
    project: activeProject,
    status,
  });

  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 3,
    state: {
      activeProject,
      automationReadyLabelId: "label-auto",
      issues: [
        cleanIssue({
          id: "MAR-398",
          labels: ["role:architect", "type:architecture", "risk:medium", "validation:harness", "automation-ready"],
          status: "Done",
          title: "Clean Autopilot Run v1: architect evidence contract and clean-run scope",
        }),
        cleanIssue({
          id: "MAR-399",
          labels: ["role:coder", "type:harness", "risk:medium", "validation:harness"],
          title: "Clean Autopilot Run v1: implement tiny proof change through campaign runner",
        }),
        cleanIssue({
          id: "MAR-400",
          labels: ["role:test", "type:test", "risk:medium", "validation:harness"],
          title: "Clean Autopilot Run v1: verify proof PR and campaign-run evidence",
        }),
        cleanIssue({
          id: "MAR-401",
          labels: ["role:reviewer", "type:harness", "risk:medium", "validation:harness"],
          title: "Reviewer: paired-review PR for Clean Autopilot Run v1",
        }),
        cleanIssue({
          id: "MAR-402",
          labels: ["role:release", "type:docs", "risk:low", "validation:docs"],
          title: "Clean Autopilot Run v1: release clean-run summary and next gate",
        }),
      ],
      prs: [],
    },
  });

  assert.equal(result.campaignName, cleanCampaign);
  assert.deepEqual(result.steps.map(({ action, issue: issueId }) => `${action}:${issueId}`), ["promote:MAR-399"]);
  assert.equal(result.reason, "coder-operator-required");
  assert.equal(result.roleIssueIds.test, "MAR-400");
});

test("Shape A promotes Tester from a ready Coder PR and does not skip Tester", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 2,
    state: state({
      coder: { status: "In Review" },
      prs: [readyPr()],
    }),
  });

  assert.equal(result.steps[0].action, "promote");
  assert.equal(result.steps[0].issue, "MAR-363");
  assert.equal(result.reason, "test-operator-required");
});

test("Shape B promotes Reviewer when Architect explicitly omits Tester", async () => {
  const shapeBDescription = [
    "## Campaign",
    "",
    campaign,
    "",
    "review_cadence: paired-review",
    "Shape B without Tester.",
  ].join("\n");
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 2,
    state: {
      activeProject,
      issues: [
        issue("architect", { description: shapeBDescription, status: "Done" }),
        issue("coder", { description: shapeBDescription, status: "In Review" }),
        issue("reviewer", { description: shapeBDescription }),
        issue("release", { description: shapeBDescription }),
      ],
      prs: [readyPr()],
    },
  });

  assert.equal(result.steps[0].action, "promote");
  assert.equal(result.steps[0].issue, "MAR-364");
});

test("PR inference supports Linear attachments and PR body links", async () => {
  const attached = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state({
      coder: {
        attachments: [{ url: "https://github.com/urkrass/Tanchiki/pull/201" }],
        status: "In Review",
      },
      prs: [readyPr({ body: prBody() })],
    }),
  });
  assert.equal(attached.detectedPrNumber, 201);

  const bodyLinked = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state({
      coder: { status: "In Review" },
      prs: [readyPr({ body: prBody("MAR-362") })],
    }),
  });
  assert.equal(bodyLinked.detectedPrNumber, 201);
});

test("PR readiness stops for missing multiple draft and failing-check PRs", async () => {
  const missing = await runCampaignStateMachine({
    dryRun: true,
    state: state({ coder: { status: "In Review" } }),
  });
  assert.equal(missing.reason, "missing-pr");

  const multiple = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { status: "In Review" },
      prs: [readyPr(), readyPr({ number: 202 })],
    }),
  });
  assert.match(multiple.stopReason, /Multiple PR bodies link MAR-362/);

  for (const [name, pr, expected] of [
    ["draft", readyPr({ draft: true }), /still Draft/],
    ["failing checks", readyPr({ checks: "failure" }), /checks are not passing/],
  ]) {
    const result = await runCampaignStateMachine({
      dryRun: true,
      state: state({
        coder: { status: "In Review" },
        prs: [pr],
      }),
    });
    assert.equal(result.reason, "pr-not-ready", name);
    assert.match(result.stopReason, expected);
  }
});

test("required role outcome states stop without recorded Linear evidence", async () => {
  const scenarios = [
    {
      issueId: "MAR-362",
      name: "Coder Canceled",
      overrides: { coder: { status: "Canceled" } },
      status: "Canceled",
    },
    {
      issueId: "MAR-362",
      name: "Coder Skipped",
      overrides: { coder: { status: "Skipped" } },
      status: "Skipped",
    },
    {
      issueId: "MAR-363",
      name: "Tester Canceled",
      overrides: {
        coder: { status: "In Review" },
        test: { status: "Canceled" },
        prs: [readyPr()],
      },
      status: "Canceled",
    },
    {
      issueId: "MAR-363",
      name: "Tester Skipped",
      overrides: {
        coder: { status: "In Review" },
        test: { status: "Skipped" },
        prs: [readyPr()],
      },
      status: "Skipped",
    },
    {
      issueId: "MAR-364",
      name: "Reviewer Canceled",
      overrides: {
        coder: { status: "In Review" },
        test: { status: "Done" },
        reviewer: { status: "Canceled" },
        prs: [readyPr()],
      },
      status: "Canceled",
    },
    {
      issueId: "MAR-364",
      name: "Reviewer Skipped",
      overrides: {
        coder: { status: "In Review" },
        test: { status: "Done" },
        reviewer: { status: "Skipped" },
        prs: [readyPr()],
      },
      status: "Skipped",
    },
  ];

  for (const scenario of scenarios) {
    const result = await runCampaignStateMachine({
      dryRun: true,
      maxSteps: 1,
      state: state(scenario.overrides),
    });

    assert.equal(result.reason, "missing-terminal-outcome-evidence", scenario.name);
    assert.equal(result.steps.length, 0, scenario.name);
    assert.match(result.stopReason, new RegExp(`${scenario.issueId} is ${scenario.status}`), scenario.name);
    assert.match(result.stopReason, /recorded abandonment, skip reason, or explicit campaign-stop evidence/, scenario.name);
  }
});

test("recorded outcome evidence allows a canceled required Tester to count as resolved", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state({
      coder: { status: "In Review" },
      test: {
        comments: [
          "Recorded abandonment: Tester verification was explicitly abandoned because the campaign stopped.",
        ],
        status: "Canceled",
      },
      prs: [readyPr()],
    }),
  });

  assert.equal(result.steps[0].action, "promote");
  assert.equal(result.steps[0].issue, "MAR-364");
  assert.equal(result.reason, "max-steps-reached");
});

test("Reviewer App review sync rejects stale reviews and duplicate bridge sync", async () => {
  const stale = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: { status: "In Review" },
      prs: [readyPr({ reviews: [botReview({ commitId: "old-sha" })] })],
    }),
  });
  assert.equal(stale.reason, "reviewer-app-review-missing");
  assert.match(stale.stopReason, /stale/);

  const duplicate = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: {
        comments: ["## Conductor Live Sync\nConductor live sync review id: review-1"],
        status: "In Review",
      },
      prs: [readyPr({ reviews: [botReview()] })],
    }),
  });
  assert.equal(duplicate.reason, "reviewer-app-review-missing");
  assert.match(duplicate.stopReason, /already synced/);
});

test("bridge sync records a valid Reviewer App review idempotently", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: { status: "In Review" },
      prs: [readyPr({ reviews: [botReview()] })],
    }),
  });

  assert.equal(result.steps[0].action, "sync-review");
  assert.match(result.steps[0].summary, /review-1/);
});

test("approved open PR stops at exact human merge gate", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: {
        comments: ["## Conductor Live Sync\nDecision: APPROVED_FOR_MERGE\nConductor live sync review id: review-1"],
        status: "In Review",
      },
      prs: [readyPr()],
    }),
  });

  assert.equal(result.reason, "human-merge-required");
  assert.equal(result.stopReason, "Hard gate: human merge required.");
});

test("post-merge Done sync runs producer before paired Reviewer", async () => {
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 2,
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: {
        comments: ["## Conductor Live Sync\nDecision: APPROVED_FOR_MERGE\nConductor live sync review id: review-1"],
        status: "In Review",
      },
      prs: [readyPr({ merged: true, state: "closed" })],
    }),
  });

  assert.deepEqual(result.steps.map((step) => `${step.action}:${step.issue}`), [
    "done-sync:MAR-362",
    "done-sync:MAR-364",
  ]);
});

test("Release promotion and campaign completion are detected", async () => {
  const releaseReady = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state({
      coder: { status: "Done" },
      test: { status: "Done" },
      reviewer: { reviewResult: "APPROVED_FOR_MERGE", status: "Done" },
      prs: [readyPr({ merged: true, state: "closed" })],
    }),
  });
  assert.equal(releaseReady.steps[0].action, "promote");
  assert.equal(releaseReady.steps[0].issue, "MAR-365");

  const complete = await runCampaignStateMachine({
    dryRun: true,
    state: state({
      coder: { status: "Done" },
      test: { status: "Done" },
      reviewer: { status: "Done" },
      release: { status: "Done" },
    }),
  });
  assert.equal(complete.completed, true);
  assert.equal(complete.reason, "campaign-complete");
});

test("missing auth stops before mutation and sanitizes errors", async () => {
  const stdout = [];
  const exitCode = await main({
    argv: ["--active-project", activeProject],
    env: {
      GH_TOKEN: "secret-gh-token",
    },
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  const output = stdout.join("\n");
  assert.equal(exitCode, 0);
  assert.match(output, /missing-auth/);
  assert.match(output, /Mutation applied: false/);
  assert.doesNotMatch(output, /secret-gh-token/);
});

test("dry-run performs no mutation or Reviewer submission and max steps stops safely", async () => {
  const reviewerCalls = [];
  const result = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 5,
    reviewerAgentMainImpl: async () => {
      reviewerCalls.push("called");
      return 1;
    },
    state: state({
      coder: { status: "In Review" },
      test: { status: "Done" },
      reviewer: { labels: [...issue("reviewer").labels, "automation-ready"], status: "Todo" },
      prs: [readyPr()],
    }),
  });

  assert.equal(reviewerCalls.length, 0);
  assert.equal(result.steps[0].action, "reviewer-agent");
  assert.equal(result.steps[0].mutationApplied, false);
  assert.equal(result.reason, "reviewer-agent-dry-run-planned");

  const capped = await runCampaignStateMachine({
    dryRun: true,
    maxSteps: 1,
    state: state(),
  });
  assert.equal(capped.reason, "max-steps-reached");
});
