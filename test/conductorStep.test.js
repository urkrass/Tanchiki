import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  decideCandidateReport,
  decideConductorStep,
  formatCandidateReport,
  formatDecision,
  main,
  parseArgs,
} from "../scripts/conductor-step.js";

const root = process.cwd();
const activeProject = "Tanchiki - Playable Tank RPG Prototype";

function makeState(overrides = {}) {
  return {
    activeProject,
    reviewCadence: "paired-review",
    issues: [],
    prs: [],
    ...overrides,
  };
}

function producer(overrides = {}) {
  return {
    id: "MAR-328",
    labels: ["role:coder", "type:harness", "risk:medium", "validation:harness"],
    status: "In Review",
    title: "Conductor implementation",
    ...overrides,
  };
}

function reviewer(overrides = {}) {
  return {
    blockedBy: ["MAR-328"],
    id: "MAR-329",
    labels: ["role:reviewer", "type:harness", "risk:medium", "validation:harness"],
    producerId: "MAR-328",
    status: "Backlog",
    title: "Reviewer: paired-review PR for Conductor v1",
    ...overrides,
  };
}

function release(overrides = {}) {
  return {
    id: "MAR-330",
    labels: ["role:release", "type:docs", "risk:low", "validation:docs"],
    status: "Backlog",
    title: "Conductor release summary",
    ...overrides,
  };
}

function reportCandidate(overrides = {}) {
  return {
    id: "MAR-340",
    labels: ["automation-ready", "role:coder", "type:harness", "risk:medium", "validation:harness"],
    project: activeProject,
    status: "Todo",
    statusType: "unstarted",
    title: "Conductor v4 report candidates",
    ...overrides,
  };
}

function readyPr(overrides = {}) {
  return {
    baseRefName: "main",
    checks: "passing",
    draft: false,
    headSha: "abc123",
    labels: [],
    linkedIssueIds: ["MAR-328"],
    merged: false,
    metadata: "passing",
    number: 144,
    reviews: [],
    state: "open",
    url: "https://github.com/urkrass/Tanchiki/pull/144",
    ...overrides,
  };
}

function botReview(overrides = {}) {
  return {
    authorLogin: "tanchiki-reviewer[bot]",
    body: "APPROVED FOR MERGE",
    commitId: "abc123",
    htmlUrl: "https://github.com/urkrass/Tanchiki/pull/144#pullrequestreview-1",
    id: "review-1",
    state: "APPROVED",
    ...overrides,
  };
}

test("conductor step stops when no eligible issue exists", () => {
  const decision = decideConductorStep(makeState());

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "no-eligible-issue");
  assert.match(formatDecision(decision), /Active project:/);
  assert.match(formatDecision(decision), /No eligible Conductor transition/);
});

test("conductor step promotes one paired reviewer after producer PR is ready", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr()],
  }));

  assert.equal(decision.decision, "promote");
  assert.equal(decision.transition, "producer-pr-ready");
  assert.equal(decision.targetIssue.id, "MAR-329");
  assert.deepEqual(decision.proposedMutation, {
    addLabels: ["automation-ready"],
    comment: "Promoted as paired-review Reviewer for open PR #144.",
    issueId: "MAR-329",
    state: "Todo",
  });
  assert.match(formatDecision(decision), /PR is open, non-draft, unmerged/);
});

test("conductor step stops when multiple reviewer promotions are eligible", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer(),
      producer({ id: "MAR-331", title: "Second producer" }),
      reviewer({ blockedBy: ["MAR-331"], id: "MAR-332", producerId: "MAR-331" }),
    ],
    prs: [
      readyPr(),
      readyPr({ linkedIssueIds: ["MAR-331"], number: 145 }),
    ],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "multiple-eligible-transitions");
  assert.match(formatDecision(decision), /MAR-329/);
  assert.match(formatDecision(decision), /MAR-332/);
});

for (const scenario of [
  {
    name: "draft PR",
    pr: readyPr({ draft: true }),
    expected: /still Draft/,
  },
  {
    name: "failing checks",
    pr: readyPr({ checks: "failing" }),
    expected: /checks are not passing/,
  },
  {
    name: "PR stop label",
    pr: readyPr({ labels: ["merge:do-not-merge"] }),
    expected: /stop labels/,
  },
]) {
  test(`conductor step stops for ${scenario.name}`, () => {
    const decision = decideConductorStep(makeState({
      issues: [producer(), reviewer()],
      prs: [scenario.pr],
    }));

    assert.equal(decision.decision, "stop");
    assert.equal(decision.reason, "blocked-transition");
    assert.match(formatDecision(decision), scenario.expected);
  });
}

test("conductor step syncs producer Done after merged PR and recorded review", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "APPROVED FOR MERGE", status: "In Review" }),
    ],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "sync");
  assert.equal(decision.reason, "producer-merged-pr-done-sync");
  assert.equal(decision.transition, "producer-done-sync");
  assert.equal(decision.targetIssue.id, "MAR-328");
  assert.equal(decision.proposedMutation.state, "Done");
  assert.match(decision.proposedMutation.comment, /Conductor Done Sync/);
  assert.match(decision.proposedMutation.comment, /Conductor done sync target: producer/);
  assert.match(formatDecision(decision), /PR #144 is merged/);
});

test("conductor step syncs paired reviewer Done after producer is Done", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer({ status: "Done" }),
      reviewer({ reviewResult: "APPROVED_FOR_MERGE", status: "In Review" }),
    ],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "sync");
  assert.equal(decision.reason, "reviewer-merged-pr-done-sync");
  assert.equal(decision.transition, "reviewer-done-sync");
  assert.equal(decision.targetIssue.id, "MAR-329");
  assert.equal(decision.proposedMutation.state, "Done");
  assert.match(decision.proposedMutation.comment, /Conductor done sync target: reviewer/);
});

test("conductor step treats synced reviewer comment as recorded review outcome", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ comments: [syncedReviewComment()], status: "In Review" }),
    ],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "sync");
  assert.equal(decision.transition, "producer-done-sync");
  assert.match(formatDecision(decision), /APPROVED_FOR_MERGE/);
});

test("conductor step promotes release when upstream outcomes are terminal", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer({ status: "Done" }),
      reviewer({ reviewResult: "APPROVED FOR MERGE", status: "Done" }),
      release(),
    ],
  }));

  assert.equal(decision.decision, "promote");
  assert.equal(decision.transition, "release-ready");
  assert.equal(decision.targetIssue.id, "MAR-330");
  assert.deepEqual(decision.proposedMutation.addLabels, ["automation-ready"]);
});

test("conductor step stops instead of duplicating producer Done sync", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer({ comments: [doneSyncComment("producer")] }),
      reviewer({ reviewResult: "APPROVED_FOR_MERGE", status: "In Review" }),
    ],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /already has a producer Done sync comment/);
});

test("conductor step stops when PR closed without merge", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "APPROVED_FOR_MERGE", status: "In Review" }),
    ],
    prs: [readyPr({ merged: false, state: "closed" })],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /closed without merge/);
});

test("conductor step stops when merged PR has no recorded review outcome", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer({ status: "In Review" })],
    prs: [readyPr({ merged: true, state: "closed" })],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /no recorded paired-review outcome/);
});

test("conductor step stops when multiple post-merge Done syncs are eligible", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "APPROVED_FOR_MERGE", status: "In Review" }),
      producer({ id: "MAR-331", title: "Second producer" }),
      reviewer({
        blockedBy: ["MAR-331"],
        id: "MAR-332",
        producerId: "MAR-331",
        reviewResult: "APPROVED_FOR_MERGE",
        status: "In Review",
      }),
    ],
    prs: [
      readyPr({ merged: true, state: "closed" }),
      readyPr({ linkedIssueIds: ["MAR-331"], merged: true, number: 145, state: "closed" }),
    ],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "multiple-eligible-transitions");
  assert.match(formatDecision(decision), /producer-done-sync: MAR-328/);
  assert.match(formatDecision(decision), /producer-done-sync: MAR-331/);
});

test("conductor step stops when issue is in the wrong project", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer({ project: "Other project" }), reviewer()],
    prs: [readyPr()],
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "wrong-active-project");
  assert.match(formatDecision(decision), /Other project/);
});

test("conductor step records reviewer result without merging", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({ reviewResult: "CHANGES REQUESTED", status: "In Review" }),
    ],
    prs: [readyPr()],
  }));

  assert.equal(decision.decision, "comment");
  assert.equal(decision.transition, "reviewer-completed");
  assert.equal(decision.proposedMutation.state, "");
  assert.match(formatDecision(decision), /does not merge/);
});

test("conductor step syncs one valid reviewer bot review", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer({ status: "Todo" })],
    prs: [readyPr({ reviews: [botReview()] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "sync");
  assert.equal(decision.transition, "reviewer-review-sync");
  assert.equal(decision.targetIssue.id, "MAR-329");
  assert.equal(decision.proposedMutation.state, "In Review");
  assert.equal(decision.proposedMutation.addLabels.length, 0);
  assert.match(decision.proposedMutation.comment, /Conductor live sync review id: review-1/);
  assert.match(formatDecision(decision), /Valid Reviewer App review/);
});

test("conductor step parses spaced APPROVED FOR MERGE reviewer decision", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({ reviews: [botReview({ body: "APPROVED FOR MERGE" })] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "sync");
  assert.match(decision.proposedMutation.comment, /Decision: APPROVED_FOR_MERGE/);
});

test("conductor step parses enum APPROVED_FOR_MERGE reviewer decision", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({ reviews: [botReview({ body: "APPROVED_FOR_MERGE" })] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "sync");
  assert.match(decision.proposedMutation.comment, /Decision: APPROVED_FOR_MERGE/);
});

test("conductor step treats same decision aliases as one logical decision", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({
      reviews: [
        botReview({
          body: "CHANGES REQUESTED\nCHANGES_REQUESTED",
          state: "CHANGES_REQUESTED",
        }),
      ],
    })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "sync");
  assert.match(decision.proposedMutation.comment, /Decision: CHANGES_REQUESTED/);
});

test("conductor step stops on conflicting paired-review decisions", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({
      reviews: [
        botReview({
          body: "APPROVED FOR MERGE\nCHANGES_REQUESTED",
          state: "COMMENTED",
        }),
      ],
    })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /exactly one paired-review decision; found 2/);
});

test("conductor step stops when review actor is not the reviewer bot", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({ reviews: [botReview({ authorLogin: "octocat" })] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /no review by tanchiki-reviewer\[bot\]/);
});

test("conductor step stops when reviewer bot review is stale", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer()],
    prs: [readyPr({ reviews: [botReview({ commitId: "old-sha" })] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /is stale/);
});

test("conductor step stops when reviewer bot review was already synced", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer({
        comments: ["Conductor live sync review id: review-1"],
      }),
    ],
    prs: [readyPr({ reviews: [botReview()] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /already synced/);
});

test("conductor step stops when multiple live reviewer syncs are eligible", () => {
  const decision = decideConductorStep(makeState({
    issues: [
      producer(),
      reviewer(),
      producer({ id: "MAR-331", title: "Second producer" }),
      reviewer({ blockedBy: ["MAR-331"], id: "MAR-332", producerId: "MAR-331" }),
    ],
    prs: [
      readyPr({ reviews: [botReview()] }),
      readyPr({
        headSha: "def456",
        linkedIssueIds: ["MAR-331"],
        number: 145,
        reviews: [botReview({ commitId: "def456", id: "review-2" })],
      }),
    ],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "multiple-eligible-transitions");
  assert.match(formatDecision(decision), /MAR-329/);
  assert.match(formatDecision(decision), /MAR-332/);
});

test("conductor step stops when live reviewer sync metadata is missing", () => {
  const decision = decideConductorStep(makeState({
    issues: [producer(), reviewer({ labels: ["role:reviewer", "type:harness", "validation:harness"] })],
    prs: [readyPr({ reviews: [botReview()] })],
    syncOnly: true,
  }));

  assert.equal(decision.decision, "stop");
  assert.equal(decision.reason, "blocked-transition");
  assert.match(formatDecision(decision), /risk metadata/);
});

test("conductor candidate report ignores completed automation-ready issues", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({
        id: "MAR-336",
        status: "Done",
        statusType: "completed",
        title: "Completed producer",
      }),
    ],
  });

  assert.equal(report.reason, "no-active-candidate");
  assert.equal(report.candidates[0].classification, "completed");
  assert.match(formatCandidateReport(report), /historical and ignored/);
});

test("conductor candidate report exposes one active automation-ready issue", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({ id: "MAR-340" }),
      reportCandidate({ id: "MAR-336", status: "Done", statusType: "completed" }),
    ],
  });

  assert.equal(report.reason, "one-active-candidate");
  assert.equal(report.candidates.find((candidate) => candidate.id === "MAR-340").classification, "active");
  assert.match(report.nextAction, /Run Dispatcher for MAR-340 \(coder\)/);
  assert.match(formatCandidateReport(report), /Read-only: no Linear or GitHub mutation was applied/);
});

test("conductor candidate report marks unresolved blocked issues as blocked", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({
        blockedBy: [{ id: "MAR-339", status: "Todo", statusType: "unstarted" }],
      }),
    ],
  });

  assert.equal(report.reason, "no-active-candidate");
  assert.equal(report.candidates[0].classification, "blocked");
  assert.match(report.candidates[0].reason, /MAR-339/);
});

test("conductor candidate report fails closed on missing metadata", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({
        labels: ["automation-ready", "role:coder", "type:harness", "validation:harness"],
      }),
    ],
  });

  assert.equal(report.reason, "no-active-candidate");
  assert.equal(report.candidates[0].classification, "unsafe");
  assert.match(report.candidates[0].reason, /risk metadata/);
});

test("conductor candidate report respects stop labels", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({
        labels: ["automation-ready", "role:coder", "type:harness", "risk:medium", "validation:harness", "needs-human-approval"],
      }),
    ],
  });

  assert.equal(report.reason, "no-active-candidate");
  assert.equal(report.candidates[0].classification, "unsafe");
  assert.match(report.candidates[0].reason, /needs-human-approval/);
});

test("conductor candidate report stops on multiple active candidates", () => {
  const report = decideCandidateReport({
    activeProject,
    issues: [
      reportCandidate({ id: "MAR-340" }),
      reportCandidate({ id: "MAR-343" }),
    ],
  });

  assert.equal(report.reason, "multiple-active-candidates");
  assert.match(report.nextAction, /exactly one issue is exposed/);
});

test("conductor step CLI requires explicit active project outside fixture mode", async () => {
  const stdout = [];
  const exitCode = await main({
    argv: [],
    env: {},
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(stdout.join("\n"), /missing-active-project/);
});

test("conductor step CLI fails closed when live auth is missing", async () => {
  const stdout = [];
  const exitCode = await main({
    argv: ["--active-project", activeProject],
    env: {},
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  const output = stdout.join("\n");
  assert.match(output, /missing-auth/);
  assert.match(output, /Missing required auth/);
});

test("conductor candidate live report needs only Linear auth and fails closed when missing", async () => {
  const stdout = [];
  const exitCode = await main({
    argv: ["--active-project", activeProject, "--report-candidates"],
    env: {},
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  const output = stdout.join("\n");
  assert.match(output, /Conductor candidate report/);
  assert.match(output, /missing-linear-auth/);
  assert.doesNotMatch(output, /GitHub token/);
});

test("conductor candidate fixture report is deterministic and read-only", async () => {
  const stdout = [];
  const exitCode = await main({
    argv: [
      "--active-project", activeProject,
      "--json", JSON.stringify({
        issues: [
          reportCandidate({ id: "MAR-342", status: "Done", statusType: "completed" }),
          reportCandidate({ id: "MAR-340" }),
        ],
      }),
      "--report-candidates",
    ],
    env: {},
    fetchImpl: async () => {
      throw new Error("report fixture mode must not use live APIs");
    },
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  const output = stdout.join("\n");
  assert.match(output, /one-active-candidate/);
  assert.match(output, /MAR-340/);
  assert.match(output, /Ignored historical automation-ready issues/);
});

test("conductor candidate live report does not use GitHub or Linear mutation authority", async () => {
  const stdout = [];
  let fetchCalls = 0;
  const fetchImpl = async (url, init = {}) => {
    fetchCalls += 1;
    const requestUrl = String(url);
    assert.equal(requestUrl, "https://api.linear.app/graphql");
    const body = JSON.parse(init.body);
    assert.doesNotMatch(body.query, /mutation/i);
    return jsonResponse({
      data: {
        issues: {
          nodes: [
            {
              id: "linear-340",
              identifier: "MAR-340",
              labels: { nodes: reportCandidate().labels.map((name) => ({ name })) },
              project: { name: activeProject },
              relations: { nodes: [] },
              inverseRelations: { nodes: [] },
              state: { id: "state-Todo", name: "Todo", type: "unstarted" },
              title: "Conductor v4 report candidates",
              url: "https://linear.app/tanchiki/issue/MAR-340",
            },
          ],
        },
      },
    });
  };

  const exitCode = await main({
    argv: ["--active-project", activeProject, "--report-candidates"],
    env: { LINEAR_API_TOKEN: "linear-token" },
    fetchImpl,
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(fetchCalls, 1);
  const output = stdout.join("\n");
  assert.match(output, /one-active-candidate/);
  assert.match(output, /Read-only: no Linear or GitHub mutation was applied/);
});

test("conductor step live dry-run syncs explicit PR to paired reviewer without mutation", async () => {
  const stdout = [];
  let mutationCalls = 0;
  const fetchImpl = async (url, init = {}) => {
    const requestUrl = String(url);
    if (requestUrl === "https://api.linear.app/graphql") {
      const body = JSON.parse(init.body);
      if (body.query.includes("mutation")) {
        mutationCalls += 1;
        return jsonResponse({ data: {} });
      }
      if (body.query.includes("GetIssueComments")) {
        return jsonResponse({
          data: {
            issue: {
              comments: { nodes: [] },
            },
          },
        });
      }
      if (body.variables.id === "MAR-328") {
        return jsonResponse({
          data: {
            issue: liveIssue({
              id: "linear-prod",
              identifier: "MAR-328",
              labels: producer().labels,
              stateName: "In Review",
            }),
          },
        });
      }
      if (body.variables.id === "MAR-329") {
        return jsonResponse({
          data: {
            issue: liveIssue({
              id: "linear-reviewer",
              identifier: "MAR-329",
              labels: reviewer().labels,
              stateName: "Backlog",
            }),
          },
        });
      }
    }

    if (requestUrl.endsWith("/repos/urkrass/Tanchiki/pulls/144")) {
      return jsonResponse({
        base: { ref: "main", repo: { full_name: "urkrass/Tanchiki" } },
        draft: false,
        head: { sha: "abc123" },
        html_url: "https://github.com/urkrass/Tanchiki/pull/144",
        labels: [],
        merged: false,
        number: 144,
        state: "open",
      });
    }
    if (requestUrl.endsWith("/repos/urkrass/Tanchiki/pulls/144/reviews?per_page=100")) {
      return jsonResponse([{
        body: "APPROVED FOR MERGE",
        commit_id: "abc123",
        html_url: "https://github.com/urkrass/Tanchiki/pull/144#pullrequestreview-1",
        id: 1,
        state: "APPROVED",
        user: { login: "tanchiki-reviewer[bot]" },
      }]);
    }
    if (requestUrl.endsWith("/repos/urkrass/Tanchiki/commits/abc123/check-runs?per_page=100")) {
      return jsonResponse({
        check_runs: [
          { conclusion: "success", name: "Required PR body sections", status: "completed" },
          { conclusion: "success", name: "test", status: "completed" },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${requestUrl}`);
  };

  const exitCode = await main({
    argv: [
      "--active-project", activeProject,
      "--repo", "urkrass/Tanchiki",
      "--pr", "144",
      "--producer", "MAR-328",
      "--reviewer", "MAR-329",
      "--dry-run",
    ],
    env: {
      GITHUB_TOKEN: "github-token",
      LINEAR_API_TOKEN: "linear-token",
    },
    fetchImpl,
    stderr: () => {},
    stdout: (line) => stdout.push(line),
  });

  const output = stdout.join("\n");
  assert.equal(exitCode, 0);
  assert.equal(mutationCalls, 0);
  assert.match(output, /Decision: sync/);
  assert.match(output, /valid-reviewer-bot-review/);
  assert.match(output, /Dry run requested/);
  assert.match(output, /- state: In Review/);
});

test("conductor step CLI prints required fields from a fixture", () => {
  const fixturePath = join(tmpdir(), `conductor-step-${Date.now()}.json`);
  writeFileSync(
    fixturePath,
    JSON.stringify(makeState({
      issues: [producer(), reviewer()],
      prs: [readyPr()],
    })),
  );

  const output = execFileSync(process.execPath, ["scripts/conductor-step.js", "--fixture", fixturePath], {
    cwd: root,
    encoding: "utf8",
  });

  for (const expected of [
    "Active project:",
    "Decision:",
    "Reason:",
    "Evidence:",
    "Proposed mutation:",
    "Next action:",
  ]) {
    assert.match(output, new RegExp(escapeRegExp(expected)));
  }
});

test("conductor step parser rejects ambiguous input sources", () => {
  assert.equal(parseArgs(["--report-candidates"]).reportCandidates, true);
  assert.throws(() => parseArgs(["--report-candidates=true"]), /does not accept/);
  assert.throws(
    () => parseArgs(["--fixture", "a.json", "--json", "{}"]),
    /only one/,
  );
  assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/);
});

test("conductor step package and static surface preserve safety boundaries", () => {
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const script = readRepoFile("scripts", "conductor-step.js");

  assert.equal(packageJson.scripts["conductor:step"], "node scripts/conductor-step.js");
  assert.match(packageJson.scripts.build, /node --check scripts\/conductor-step\.js/);
  assert.match(packageJson.scripts.build, /node --check test\/conductorStep\.test\.js/);
  assert.match(packageJson.scripts.lint, /node --check scripts\/conductor-step\.js/);
  assert.match(packageJson.scripts.lint, /node --check test\/conductorStep\.test\.js/);

  for (const forbidden of [
    "reviewer:agent",
    "api.openai.com",
    "submitReview",
    "/merge",
    "/labels",
    "spawnSync",
    "execFile",
    "writeFile",
    "appendFile",
    "createWriteStream",
  ]) {
    assert.equal(script.includes(forbidden), false, `unexpected unsafe surface: ${forbidden}`);
  }
});

test("conductor step direct command succeeds with an honest safe stop", () => {
  const result = spawnSync(process.execPath, ["scripts/conductor-step.js"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Conductor step/);
  assert.match(result.stdout, /missing-active-project/);
});

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  };
}

function syncedReviewComment(decision = "APPROVED_FOR_MERGE") {
  return [
    "## Conductor Live Sync",
    "",
    `Decision: ${decision}`,
    "Conductor live sync review id: review-1",
  ].join("\n");
}

function doneSyncComment(role) {
  return [
    "## Conductor Done Sync",
    "",
    "PR: #144 https://github.com/urkrass/Tanchiki/pull/144",
    `Conductor done sync target: ${role}`,
  ].join("\n");
}

function liveIssue({ id, identifier, labels, stateName }) {
  return {
    description: "review_cadence: paired-review",
    id,
    identifier,
    labels: { nodes: labels.map((name) => ({ name })) },
    project: { name: activeProject },
    state: { id: `state-${stateName}`, name: stateName, type: "started" },
    team: {
      states: {
        nodes: [
          { id: "state-Backlog", name: "Backlog", type: "backlog" },
          { id: "state-In Review", name: "In Review", type: "started" },
        ],
      },
    },
    title: `${identifier} live issue`,
    url: `https://linear.app/tanchiki/issue/${identifier}`,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
