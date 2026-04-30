import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

test("default dispatcher prompt prints Level 5 metadata and gate refusal requirements", () => {
  const prompt = execFileSync(process.execPath, ["scripts/print-codex-next.js"], {
    cwd: root,
    encoding: "utf8",
  });

  for (const expected of [
    "Follow the repo harness protocols, including Level 5 risk-gated validation.",
    "exactly one `role:*`",
    "exactly one `type:*`",
    "exactly one `risk:*`",
    "exactly one `validation:*`",
    "remove `blocked`, `needs-human-approval`, `human-only`, and `risk:human-only` before automation",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("role router policy defines concise refusal copy for metadata and gate failures", () => {
  const policy = readRepoFile("ops", "policies", "role-router.md");

  for (const expected of [
    "Dispatcher stopped: this issue is not eligible for automation yet.",
    "role labels: expected exactly one `role:*`, found <value>",
    "type labels: expected exactly one `type:*`, found <value>",
    "risk labels: expected exactly one `risk:*`, found <value>",
    "validation labels: expected exactly one `validation:*`, found <value>",
    "gate labels: remove any of `blocked`, `needs-human-approval`, `human-only`, or `risk:human-only` before adding `automation-ready`",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("risk-gated validation policy keeps human-only movement issues non-automatable", () => {
  const policy = readRepoFile("ops", "policies", "risk-gated-validation.md");

  assert.match(policy, /does not have `risk:human-only`/);
  assert.match(policy, /Issues with `type:movement` should normally receive `risk:human-only`/);
  assert.match(policy, /human approval required by default/);
});

test("campaign request template keeps intake gated from implementation", () => {
  const template = readRepoFile(".github", "ISSUE_TEMPLATE", "campaign-request.yml");

  for (const expected of [
    "Submit a structured campaign brief for Planner + Auto-Groomer intake.",
    "does not authorize Coder work",
    "dependencies, human gates, and only the first safe Architect issue marked automation-ready",
    "Primary request category",
    "Movement, collision, spawning, or control feel",
    "Persistence, credentials, destructive repo work, or broad architecture",
    "Human approval gates",
    "Do not make Coder issues automation-ready until Architect and human gates are complete.",
  ]) {
    assert.match(template, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign request planner prompt exposes only the first safe Architect issue", () => {
  const prompt = readRepoFile("prompts", "codex-plan-campaign-request.md");

  for (const expected of [
    "Treat the request as intake for planning and grooming only.",
    "Do not let a request directly trigger Coder work.",
    "If required request fields are missing, create or report a human-gated clarification issue instead of guessing.",
    "Do not apply `automation-ready` to Coder, Test, Reviewer, Release, unresolved dependency, human-only, or needs-human-approval issues during intake.",
    "Make only the first safe Architect issue `Todo` + `automation-ready`.",
    "Keep all Coder/Test/Reviewer/Release issues Backlog with blocked-by relations until Architect and human gates are complete.",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign factory policy documents unsafe-category gates and metadata", () => {
  const policy = readRepoFile("ops", "policies", "campaign-factory.md");

  for (const expected of [
    "The campaign factory is an intake, planning, and grooming workflow.",
    "It does not authorize implementation, source edits, dependency additions, pull requests, merges, or Done-state changes.",
    "`needs-human-approval`: gameplay behavior, progression, level tuning, dependency additions",
    "`human-only`: movement, collision, spawning, control feel, persistence, credentials, destructive repository operations",
    "`automation-ready` only for the single issue the dispatcher may run next",
    "Campaign requests must never directly promote Coder work to `automation-ready`.",
    "no unresolved dependency, gated, human-only, parent, umbrella, or `risk:human-only` issue has `automation-ready`",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign factory checklist guards queue grooming invariants", () => {
  const checklist = readRepoFile("ops", "checklists", "campaign-factory-checklist.md");

  for (const expected of [
    "If required fields are missing, create or report a human-gated clarification item instead of guessing.",
    "Classify the request as `safe planning request`, `needs-human-approval`, or `human-only`.",
    "Apply exactly one `role:*` label to every issue where applicable.",
    "Apply exactly one `type:*` label to every issue where applicable.",
    "Apply exactly one `risk:*` label to every issue where applicable.",
    "Apply exactly one `validation:*` label to every issue where applicable.",
    "Confirm no Coder issue became automation-ready directly from request intake.",
    "Confirm no `risk:human-only` issue has `automation-ready`.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance policy preserves required labels and forbidden auto-merge categories", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");

  for (const expected of [
    "`merge:auto-eligible` - PR may enter the auto-merge path if every other gate passes.",
    "`merge:agent-approved` - independent reviewer-agent accepted the PR under this policy; not sufficient alone for auto-merge.",
    "`merge:human-required` - human approval is required before merge or before auto-merge eligibility.",
    "`merge:do-not-merge` - hard stop; overrides all positive labels.",
    "`reviewer:approved` - independent reviewer or human approval signal.",
    "`reviewer:changes-requested` - blocking review findings exist; incompatible with auto-merge.",
    "movement, collision, spawning, interpolation, or control-feel changes",
    "`risk:high`",
    "`risk:human-only`",
    "deployment workflow changes, including GitHub Pages",
    "dependency changes, package manager changes, or lockfile changes",
    "CI workflow changes",
    "broad gameplay changes",
    "save or persistence behavior",
    "security-sensitive changes, secrets, credentials, permissions, tokens, or repository settings",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance policy protects do-not-merge override and reviewer independence", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");

  for (const expected of [
    "Stop labels are hard vetoes.",
    "`merge:do-not-merge` is the highest-priority stop signal.",
    "`merge:do-not-merge` and `reviewer:changes-requested` must be removed before any positive acceptance label can be acted on.",
    "Coder and Test agents must not approve, label as accepted, or merge their own PRs.",
    "Reviewer approval must come from a separate reviewer-agent pass or a human.",
    "If actor independence cannot be proven mechanically, auto-merge must remain unavailable",
    "Must not be added by the PR author.",
    "Must not be added by the Coder or Test author of the PR.",
    "New commits after approval require approval to be rechecked or refreshed.",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance policy keeps stop-label removal human controlled", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");

  for (const expected of [
    "`merge:do-not-merge`",
    "`merge:human-required`",
    "`needs-human-approval`",
    "`blocked`",
    "`human-only`",
    "`risk:human-only`",
    "Coder agents must not remove stop labels.",
    "Test agents must not remove stop labels.",
    "Reviewer agents must not remove stop labels.",
    "Release agents must not remove stop labels.",
    "Planner and Groomer agents must not remove stop labels from active PRs.",
    "Agents may recommend stop-label removal in a PR comment or Linear comment.",
    "A human operator must remove stop labels manually.",
    "The only exception is a future explicitly approved automation whose sole",
    "That automation does not exist yet and must be",
    "separately approved before use.",
    "A PR may not enter an auto-merge lane if any stop label is present, regardless",
    "of passing CI, passing PR metadata checks, reviewer-agent approval, low-risk",
    "issue metadata, `merge:auto-eligible`, or `merge:agent-approved`.",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance policy defines reviewer language and safe low-risk lane", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");

  for (const expected of [
    "`APPROVED FOR MERGE`",
    "`APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`",
    "`CHANGES REQUESTED`",
    "`HUMAN REVIEW REQUIRED`",
    "`BLOCKED`",
    "Reviewer agents must not say or imply that they removed stop labels",
    "`type:docs` + `risk:low` + `validation:docs`",
    "`type:harness` + `risk:low` + `validation:harness`",
    "`type:test` + `risk:low` + `validation:test`",
    "Even in these low-risk categories, stop labels remain hard vetoes.",
    "Human merge or human review remains required for:",
    "`type:ui`",
    "`type:gameplay`",
    "`type:progression`",
    "`type:movement`",
    "anything touching `src/game.js`, `src/render.js`, `src/game/movement.js`, or broad architecture files",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance policy keeps draft PRs as auto-merge hard vetoes", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");
  const checklist = readRepoFile("ops", "checklists", "pr-acceptance-checklist.md");
  const reviewerPrompt = readRepoFile("ops", "prompts", "reviewer-agent.md");

  for (const expected of [
    "Draft PRs are a hard veto for auto-merge approval and paired-review approval.",
    "PR is not draft; Draft PRs are hard vetoes for auto-merge approval.",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /ordinary non-paired-review, validation-not-passed,\s+or human-gated work/);
  assert.match(policy, /paired-review producer PR with passing validation must be marked ready for\s+review before the Coder or Test session stops/);

  for (const expected of [
    "Draft PRs are hard vetoes for auto-merge approval.",
    "Draft PRs are hard vetoes for paired-review approval.",
    "Paired-review producer PRs with passing validation were marked ready for review before the Coder or Test session stopped.",
    "Draft PRs remain allowed for incomplete work, exploratory work, ordinary non-paired-review work, validation-not-passed work, and work explicitly awaiting author completion.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Draft PRs block paired-review approval and are hard vetoes for auto-merge approval",
    "Reviewer agents must reject Draft PRs for paired-review with `HUMAN REVIEW REQUIRED` or `BLOCKED`.",
    "the PR is Draft",
  ]) {
    assert.match(reviewerPrompt, new RegExp(escapeRegExp(expected)));
  }
});

test("coder prompt requires ready-for-review PRs for low-risk auto-merge lanes", () => {
  const prompt = readRepoFile("ops", "prompts", "coder-agent.md");

  for (const expected of [
    "Draft PRs remain allowed for incomplete work",
    "Draft PRs are hard",
    "auto-merge candidate or burn-in PR",
    "Open the PR against `main`.",
    "Ensure the PR is not Draft and is ready for review.",
    "Fill the PR metadata",
    "Run the required validation profile.",
    "Move the Linear issue to `In Review`.",
    "Stop without reviewing, labeling, or merging the PR.",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("coder and test prompts require ready paired-review PRs after validation passes", () => {
  const coderPrompt = readRepoFile("ops", "prompts", "coder-agent.md");
  const testPrompt = readRepoFile("ops", "prompts", "test-agent.md");
  const roleBoundaries = readRepoFile("ops", "policies", "role-boundaries.md");
  const combined = `${coderPrompt}\n${testPrompt}\n${roleBoundaries}`;
  const normalizedCombined = combined.replaceAll("\r\n", "\n");

  for (const expected of [
    "Identify campaign review cadence from campaign notes, issue descriptions, grooming notes, and Architect comments",
    "If `review_cadence: paired-review` and validation passed, ensure the PR is not Draft and is ready for review before stopping.",
    "Draft PRs remain allowed for incomplete work, exploratory work, ordinary\nnon-paired-review work, work where validation has not passed, and work\nexplicitly awaiting author completion.",
    "If validation failed or work is incomplete, leave the PR Draft if one exists, do not expose the paired Reviewer issue, and comment with the blocker.",
    "Report the PR number.",
    "Stop without reviewing, labeling, or merging the PR.",
    "Do not review the PR, do not apply labels, do not merge, and do not\nmark the issue `Done`.",
  ]) {
    assert.match(normalizedCombined, new RegExp(escapeRegExp(expected)));
  }
  assert.match(
    normalizedCombined,
    /Paired-review PRs must be open,\s+non-draft, unmerged, and passing required checks before the paired Reviewer\s+issue may run\./,
  );
});

test("repo task docs require ready burn-in PRs before Linear review handoff", () => {
  const readme = readRepoFile("README.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");

  for (const expected of [
    "Low-risk auto-merge candidate PRs, auto-merge burn-in PRs, and paired-review producer PRs with passing validation are different",
    "those PRs must be marked ready for review before the Coder or Test session stops",
    "ensure the PR is not Draft",
    "move the Linear issue to `In Review`",
    "stop without reviewing, labeling, or merging",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of ["auto-merge burn-in PR"]) {
    assert.match(protocol, new RegExp(escapeRegExp(expected)));
  }
  assert.match(protocol, /mark it\s+ready for review/);
  assert.match(
    protocol,
    /Paired-review PRs must\s+be open, non-draft, unmerged, and passing required checks before the paired\s+Reviewer issue may run\./,
  );
});

test("campaign conductor docs require single-step promotion and no campaign loop", () => {
  const prompt = readRepoFile("prompts", "codex-conduct-campaign.md");
  const opsPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");

  for (const expected of [
    "Promote exactly one next safe issue if eligible.",
    "Do not run Dispatcher.",
    "Do not merge.",
    "Report the promoted issue or the blocker.",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "may promote at most one next issue",
    "loop through multiple issues",
    "run Dispatcher itself",
    "create a looping autonomous campaign runner",
    "Promote at most one issue.",
    "Do not create a looping campaign runner.",
  ]) {
    assert.match(`${policy}\n${checklist}`, new RegExp(escapeRegExp(expected)));
  }

  assert.match(opsPrompt, /single-step campaign queue\s+promotion role only/);
});

test("campaign conductor inspects explicit review cadence before promotion", () => {
  const prompt = readRepoFile("prompts", "codex-conduct-campaign.md");
  const opsPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${prompt}\n${opsPrompt}\n${policy}\n${checklist}\n${protocol}\n${validation}`;

  for (const expected of [
    "before any promotion",
    "campaign notes, issue descriptions, grooming notes, and Architect comments",
    "`review_cadence: final-audit`",
    "`review_cadence: paired-review`",
    "`review_cadence: let-architect-decide`",
    "If review cadence is missing or ambiguous",
    "asking for cadence triage",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign conductor metadata repair is explicit issue-body only", () => {
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");

  for (const expected of [
    "## Risk label",
    "risk:low",
    "must not guess metadata from title alone",
    "Repair a missing Level 5 label only when the exact label appears in the issue body.",
    "Record the exact issue-body line used for any metadata repair in the promotion comment.",
    "must stop for absent or ambiguous metadata",
  ]) {
    assert.match(`${policy}\n${checklist}\n${validation}`, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /may add missing Level 5 labels only when the exact value is\s+explicitly stated in the issue body/);
  assert.match(policy, /must not infer labels\s+from campaign neighbors/);
});

test("campaign conductor reviewer and burn-in gates remain conservative", () => {
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const safety = readRepoFile("SAFETY_BOUNDARIES.md");
  const readme = readRepoFile("README.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");

  for (const expected of [
    "PR is open",
    "PR is not Draft",
    "Draft PRs block Reviewer promotion.",
    "If the PR is Draft, do not promote",
    "The Conductor must not apply `merge:auto-eligible`.",
    "Human must apply `merge:auto-eligible` using normal GitHub identity.",
    "If a prior burn-in result was inconclusive but the campaign continues",
    "cite the explicit operator continuation record in the promotion comment",
    "remove human gate labels or PR stop labels",
  ]) {
    assert.match(`${policy}\n${checklist}\n${protocol}\n${safety}\n${readme}\n${validation}`, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /The Conductor may promote Reviewer issues only when the linked PR is open,\s+non-draft, and checks are passing\./);
});

test("campaign conductor let-architect-decide blocks downstream promotion", () => {
  const prompt = readRepoFile("prompts", "codex-conduct-campaign.md");
  const opsPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${prompt}\n${opsPrompt}\n${policy}\n${checklist}\n${validation}`;

  for (const expected of [
    "promote only the Architect cadence-decision issue",
    "must not promote implementation, test, reviewer, or release issues until",
    "Architect already recorded `review_cadence: final-audit` or `review_cadence: paired-review`",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
  assert.match(combined, /use\s+that recorded decision/);
});

test("architect deferred cadence decision must materialize paired-review requirements", () => {
  const architectPrompt = readRepoFile("ops", "prompts", "architect-agent.md");
  const architectChecklist = readRepoFile("ops", "checklists", "architect-review-checklist.md");
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${architectPrompt}\n${architectChecklist}\n${factory}\n${validation}`;

  for (const expected of [
    "review_cadence: final-audit",
    "review_cadence: paired-review",
    "exactly one final cadence",
    "every PR-producing Coder/Test issue that needs a paired Reviewer issue",
    "paired Reviewer issue title",
    "which Coder/Test issue it reviews",
    "expected role/type/risk/validation",
    "whether Reviewer App identity is required",
    "whether the issue already exists or must be created",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("planner and groomer support placeholder or repair materialization paths", () => {
  const requestPrompt = readRepoFile("prompts", "codex-plan-campaign-request.md");
  const planAndGroom = readRepoFile("prompts", "codex-plan-and-groom-campaign.md");
  const planner = readRepoFile("ops", "prompts", "planner-agent.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const plannerChecklist = readRepoFile("ops", "checklists", "planner-output-checklist.md");
  const groomingChecklist = readRepoFile("ops", "checklists", "campaign-grooming-checklist.md");
  const factoryChecklist = readRepoFile("ops", "checklists", "campaign-factory-checklist.md");
  const repairPrompt = readRepoFile("prompts", "codex-repair-paired-review-queue.md");
  const combined = [
    requestPrompt,
    planAndGroom,
    planner,
    groomer,
    factory,
    execution,
    plannerChecklist,
    groomingChecklist,
    factoryChecklist,
    repairPrompt,
  ].join("\n");

  for (const expected of [
    "Option A - create placeholder paired Reviewer issues during initial planning.",
    "Keep them non-automation-ready until Architect confirms paired-review.",
    "Option B - require queue expansion after Architect decision.",
    "A Planner/Groomer repair pass must create the missing paired Reviewer issues before implementation proceeds.",
    "Prefer Option A when feasible",
    "prompts/codex-repair-paired-review-queue.md",
    "Do not edit repo files.",
    "Do not open PRs.",
    "Do not add `automation-ready` to new Reviewer issues.",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("paired-review materialization blocks implementation promotion when missing", () => {
  const conductPrompt = readRepoFile("prompts", "codex-conduct-campaign.md");
  const conductorPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const conductorPolicy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const conductorChecklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${conductPrompt}\n${conductorPrompt}\n${conductorPolicy}\n${conductorChecklist}\n${protocol}\n${validation}`;

  for (const expected of [
    "verify paired-review materialization before promoting any Coder/Test issue",
    "paired Reviewer issue before implementation promotion",
    "Paired-review cadence is selected, but the paired Reviewer issue for <issue> does not exist or is not linked. Run a Planner/Groomer queue repair before promotion.",
    "Do not create missing paired Reviewer issues; request Planner/Groomer queue repair.",
    "paired Reviewer issue to exist or be explicitly linked",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }

  assert.match(
    combined,
    /must not proceed to implementation until the\s+paired-review queue is structurally complete/i,
  );
});

test("paired-review repair defines reviewer issue requirements and dependency chain", () => {
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const repairPrompt = readRepoFile("prompts", "codex-repair-paired-review-queue.md");
  const readme = readRepoFile("README.md");
  const combined = `${factory}\n${execution}\n${repairPrompt}\n${readme}`;

  for (const expected of [
    "Producer issue\n-> paired Reviewer issue\n-> next implementation issue",
    "Producer Coder/Test issue -> paired Reviewer issue -> next Producer Coder/Test issue",
    "expected PR state: open, non-draft, unmerged, checks passing",
    "`APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`",
    "`APPROVED FOR MERGE`",
    "`CHANGES REQUESTED`",
    "`HUMAN REVIEW REQUIRED`",
    "`BLOCKED`",
    "role/type/risk/validation labels",
    "`model_hint`",
    "Reviewer App identity requirement if applicable",
    "must not be unblocked merely because issue A opened a PR",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign dependencies use blocked-by relations with legacy blocked label cleanup", () => {
  const planner = readRepoFile("prompts", "codex-plan-and-groom-campaign.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const conductor = readRepoFile("ops", "policies", "campaign-conductor.md");
  const conductorPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const groomingChecklist = readRepoFile("ops", "checklists", "campaign-grooming-checklist.md");
  const conductorChecklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const readme = readRepoFile("README.md");

  for (const expected of [
    "Use Linear blocked-by / blocks relations for ordinary campaign dependency sequencing.",
    "Do not use the `blocked` label for normal downstream campaign dependencies.",
    "Ensure ordinary dependency work uses Linear blocked-by / blocks relations, not the `blocked` label.",
    "ensure dependency-blocked issues use Linear blocked-by / blocks relations",
    "Confirm ordinary dependency sequencing uses Linear blocked-by / blocks relationships.",
    "Ordinary campaign sequencing uses Linear blocked-by / blocks relations.",
    "Ordinary campaign dependencies use Linear blocked-by / blocks",
  ]) {
    assert.match(
      `${planner}\n${groomer}\n${execution}\n${groomingChecklist}\n${conductor}\n${protocol}\n${readme}`,
      new RegExp(escapeRegExp(expected)),
    );
  }

  for (const expected of [
    "The `blocked` label is deprecated for ordinary campaign dependencies.",
    "all blocked-by issues are `Done` or explicitly satisfied;",
    "no `needs-human-approval` label is present;",
    "no `human-only` label is present;",
    "no `risk:human-only` label is present;",
    "exactly one `role:*` label exists;",
    "exactly one `type:*` label exists;",
    "exactly one `risk:*` label exists;",
    "exactly one `validation:*` label exists;",
    "promoting the issue would expose only one next issue.",
    "comment explaining why the label was removed",
    "Do not remove `needs-human-approval`, `human-only`, `risk:human-only`, or PR stop labels.",
    "allow removing `needs-human-approval`, `human-only`, `risk:human-only`, or any",
    "Promote at most one issue.",
  ]) {
    assert.match(
      `${conductor}\n${conductorPrompt}\n${conductorChecklist}\n${protocol}\n${validation}`,
      new RegExp(escapeRegExp(expected)),
    );
  }
});

test("campaign conductor keeps human gates and open implementation issues from auto-closing", () => {
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");

  for (const expected of [
    "Human gate issues must not be auto-promoted as `automation-ready`.",
    "For human gate work, do not promote; report the required human action.",
    "Coder and Test issues should remain `In Review` while their PR is open.",
    "Coder/Test issues `In Review` while their PR is open.",
  ]) {
    assert.match(`${policy}\n${checklist}\n${protocol}\n${validation}`, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /may be marked `Done` only after the linked PR is merged\s+or explicitly abandoned with a recorded outcome/);
  assert.match(policy, /Human gate issues are `Done` only after the human decision or action is\s+recorded\./);
});

test("PR acceptance policy requires independent reviewer and active shakedown sequence", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");
  const checklist = readRepoFile("ops", "checklists", "pr-acceptance-checklist.md");
  const prompt = readRepoFile("ops", "prompts", "reviewer-agent.md");

  for (const expected of [
    "A Reviewer agent must not approve a PR authored by the same Codex session or run",
    "must not approve its own prior work",
    "the authoring run cannot be distinguished from the review run",
    "the PR was already merged before review",
    "Reviewer comments for acceptance or auto-merge shakedown review must state the",
    "independence basis: authoring session or source if known, reviewer session or",
    "If independence is unknown, the Reviewer must return `HUMAN REVIEW REQUIRED`.",
    "PR remains open, ready for review, and unmerged.",
    "Independent Reviewer-agent approves.",
    "Human operator manually applies `merge:auto-eligible`.",
    "GitHub auto-merge performs the merge.",
    "valid as a normal human merge but invalid",
    "or inconclusive as an auto-merge shakedown.",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "The Reviewer agent is not from the same Codex session or run as the PR authoring agent.",
    "The Reviewer agent did not author the PR or review its own prior work.",
    "The Reviewer comment states the independence basis: authoring session/source if known, reviewer session/source, whether they are independent, and whether independence is unknown.",
    "If authoring and review runs cannot be distinguished, Reviewer returns `HUMAN REVIEW REQUIRED`.",
    "PR state at review time: open, draft, merged, or closed.",
    "Whether `merge:auto-eligible` was applied by a human.",
    "Whether GitHub auto-merge, not manual merge, performed the merge.",
    "a human merges before Reviewer approval or before applying",
    "auto-merge shakedown is invalid or inconclusive.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Establish reviewer independence before any approval:",
    "return `HUMAN REVIEW REQUIRED` if you authored the PR",
    "For auto-merge shakedowns, verify the PR is open until the full sequence completes",
    "Do not approve a PR authored by the same Codex session/run.",
    "Do not apply `merge:auto-eligible`; that label is human-controlled during shakedowns.",
    "whether GitHub auto-merge",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("burn-in summaries require explicit auto-merge event evidence", () => {
  const policy = readRepoFile("ops", "policies", "pr-acceptance.md");
  const prChecklist = readRepoFile("ops", "checklists", "pr-acceptance-checklist.md");
  const releaseChecklist = readRepoFile("ops", "checklists", "release-summary-checklist.md");

  for (const expected of [
    "Successful auto-merge proof requires one of:",
    "GitHub timeline evidence such as `AutoMergeEnabledEvent`",
    "GitHub CLI/API evidence showing `autoMergeRequest` was set before merge.",
    "Successful auto-merge proof includes GitHub timeline evidence such as",
    "Acceptable auto-merge completion proof is either GitHub timeline evidence",
    "count a PR as successful auto-merge only",
    "when GitHub evidence shows auto-merge was enabled and performed.",
  ]) {
    assert.match(`${policy}\n${prChecklist}\n${releaseChecklist}`, new RegExp(escapeRegExp(expected)));
  }
  const normalized = `${policy}\n${prChecklist}\n${releaseChecklist}`.replace(/\s+/g, " ");
  assert.match(normalized, /Reviewer approval \+ human merge succeeded; auto-merge completion inconclusive\./);
});

test("PR acceptance checklist and template guard auto-merge gates without live GitHub mutation", () => {
  const checklist = readRepoFile("ops", "checklists", "pr-acceptance-checklist.md");
  const template = readRepoFile(".github", "PULL_REQUEST_TEMPLATE.md");

  for (const expected of [
    "PR is not draft before any paired-review approval or auto-merge path is considered.",
    "PR metadata check is passing.",
    "CI is passing.",
    "Branch protection requirements are satisfied and not bypassed.",
    "Linked issue has exactly one `role:*` label.",
    "Linked issue has exactly one `type:*` label.",
    "Linked issue has exactly one `risk:*` label.",
    "Linked issue has exactly one `validation:*` label.",
    "No stop labels are present: `merge:do-not-merge`, `merge:human-required`, `needs-human-approval`, `blocked`, `human-only`, or `risk:human-only`.",
    "Stop labels were not removed by a Coder, Test, Reviewer, Release, Planner, or Groomer agent.",
    "If a stop label was previously present, the PR body records which human operator approved gate removal.",
    "`merge:auto-eligible` is present before auto-merge eligibility.",
    "`merge:do-not-merge` is absent.",
    "`reviewer:approved` or an approved human approval label is present.",
    "The approval actor is not the Coder or Test author of the PR.",
    "Agents only recommended stop-label removal in PR or Linear comments; they did not remove stop labels.",
    "The PR still satisfies role/type/risk/validation metadata after all changes.",
    "QA evidence is present when the validation profile or risk level requires it.",
    "If actor independence cannot be proven, auto-merge remains unavailable.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "## Acceptance Labels",
    "- Merge label:",
    "- Reviewer label:",
    "- Human gate:",
  ]) {
    assert.match(template, new RegExp(escapeRegExp(expected)));
  }
});

test("PR template is canonical source for exact body headings", () => {
  const template = readRepoFile(".github", "PULL_REQUEST_TEMPLATE.md");

  for (const expected of [
    "Canonical PR body heading source of truth.",
    "Preserve the exact heading spelling and capitalization in this template.",
  ]) {
    assert.match(template, new RegExp(escapeRegExp(expected)));
  }
  assert.match(
    template,
    /Do\s+not rename headings,\s+shorten headings,\s+or replace them with older variants\./,
  );

  for (const heading of [
    "Linked Linear Issue",
    "Role / Type / Risk / Validation",
    "Summary",
    "Files Changed",
    "Tests Run",
    "Manual QA",
    "Broad Scan Reason",
    "Conflict Risk",
    "Visible UI Expectation",
    "Known Limitations",
    "Acceptance Labels",
    "PR Readiness",
  ]) {
    assert.match(template, new RegExp(`^## ${escapeRegExp(heading)}$`, "m"));
  }

  for (const oldHeading of [
    "Linear",
    "Files changed",
    "Validation",
    "Broad scans",
  ]) {
    assert.doesNotMatch(template, new RegExp(`^## ${escapeRegExp(oldHeading)}$`, "m"));
  }
});

test("short dispatcher and PR-producing role context preserve exact PR headings", () => {
  const shortDispatcher = readRepoFile("prompts", "short", "dispatcher.md");
  const defaultDispatcher = readRepoFile("prompts", "codex-next.md");
  const manifest = readRepoFile("ops", "context-manifest.md");
  const coderPrompt = readRepoFile("ops", "prompts", "coder-agent.md");
  const testPrompt = readRepoFile("ops", "prompts", "test-agent.md");
  const combinedRolePrompts = `${coderPrompt}\n${testPrompt}`.replaceAll("\r\n", "\n");

  for (const prompt of [shortDispatcher, defaultDispatcher]) {
    assert.match(prompt, /\.github\/PULL_REQUEST_TEMPLATE\.md/);
    assert.match(prompt, /required section source of truth/);
    assert.match(
      prompt,
      /Do not rename headings,\s+shorten\s+headings,\s+or\s+replace them with older variants\./,
    );
  }

  for (const expected of [
    "For PR-producing roles, load `.github/PULL_REQUEST_TEMPLATE.md` as the exact",
    "PR body heading source of truth. Agents must preserve exact heading spelling",
    "Load the selected issue body",
    "campaign context pack when present",
    "`VALIDATION_MATRIX.md`",
    "`.github/PULL_REQUEST_TEMPLATE.md`",
    "`ops/checklists/pr-acceptance-checklist.md`",
    "and relevant files.",
  ]) {
    assert.match(manifest, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Use `.github/PULL_REQUEST_TEMPLATE.md` as the required section source of truth.",
    "Do not rename headings, shorten headings, or replace them with older variants.",
    "Do not collapse `## Tests Run` into `## Validation`.",
    "Do not use\n`## Files changed` when the template says `## Files Changed`.",
    "Include\n`## Broad Scan Reason`, even when the answer is \"No broad scan was used.\"",
  ]) {
    assert.match(combinedRolePrompts, new RegExp(escapeRegExp(expected)));
  }
});

test("Reviewer App token helper documents local-only temporary GitHub App identity", () => {
  const script = readRepoFile("scripts", "reviewer-app-token.js");
  const readme = readRepoFile("README.md");
  const safety = readRepoFile("SAFETY_BOUNDARIES.md");
  const gitignore = readRepoFile(".gitignore");

  for (const expected of [
    "GITHUB_REVIEWER_APP_ID",
    "GITHUB_REVIEWER_INSTALLATION_ID",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH must point to a file.",
    "Private key path exists; private key contents will not be printed.",
    "Existing GH_TOKEN detected.",
    "Confirm this shell is a Reviewer session before overwriting GH_TOKEN with the app token.",
    "https://api.github.com/app/installations/",
    "access_tokens",
    "$env:GH_TOKEN =",
    "gh api installation/repositories --jq '.repositories[].full_name'",
    "Expected repository access includes: urkrass/Tanchiki",
    "Record the verified Reviewer App identity/access in review notes.",
    "GitHub App installation token, not a normal user token",
    "Reviewer-agent PR inspection, comments, and reviews",
    "Do not use this Reviewer App GH_TOKEN in Coder sessions or human merge-label sessions.",
    "Coder sessions and human merge-label sessions must use the normal GitHub identity after GH_TOKEN is cleared.",
    "pushing code or updating PR branches",
    "merging PRs",
    "applying merge:auto-eligible",
    "removing stop labels",
    "enabling auto-merge",
    "changing workflows, repo settings, branch protection, or secrets",
    "Remove-Item Env:\\\\GH_TOKEN -ErrorAction SilentlyContinue",
    "Then verify the normal identity before coding or human label work:",
    "gh auth status",
    "This token is short-lived and was not written to disk.",
  ]) {
    assert.match(script, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "C:\\Users\\Legion\\.config\\tanchiki-reviewer-app\\",
    "private key stay outside the repository",
    "tokens expire after one hour",
    "`GH_TOKEN` is temporary for the current shell",
    "not the normal `urkrass` user",
    "must not push code",
    "merge PRs",
    "apply `merge:auto-eligible`",
    "remove stop labels",
    "## Daily Identity Ritual",
    "Coder session:",
    "normal GitHub identity",
    "Do not load the Reviewer",
    "Reviewer session:",
    "only for Reviewer-agent PR inspection, comments, and reviews",
    "Cleanup after review:",
    "Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue",
    "Human merge-label session:",
    "return to the normal GitHub identity",
    "Secrets, `.pem` files, local env files, and generated installation tokens stay",
    "Reviewer App remains review/comment only",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "must remain outside the repo",
    "generated installation tokens must stay temporary in the current shell through",
    "`GH_TOKEN`",
    "pushing code",
    "merging PRs",
    "applying",
    "`merge:auto-eligible`",
    "removing stop labels",
  ]) {
    assert.match(safety, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of ["*.pem", "reviewer-env.ps1", ".env", ".env.*"]) {
    assert.match(gitignore, new RegExp(`^${escapeRegExp(expected)}$`, "m"));
  }
});

test("Reviewer App session helper prints safe wrapper routine and dispatcher handoff", () => {
  const sessionScript = readRepoFile("scripts", "reviewer-session.js");
  const tokenScript = readRepoFile("scripts", "reviewer-app-token.js");
  const packageJson = JSON.parse(readRepoFile("package.json"));

  assert.equal(
    packageJson.scripts["reviewer:session"],
    "node scripts/reviewer-session.js",
  );
  assert.match(
    packageJson.scripts.build,
    /node --check scripts\/reviewer-session\.js/,
  );
  assert.match(
    packageJson.scripts.lint,
    /node --check scripts\/reviewer-session\.js/,
  );

  for (const expected of [
    "Reviewer App session helper",
    "GITHUB_REVIEWER_APP_ID",
    "GITHUB_REVIEWER_INSTALLATION_ID",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
    "Private key contents will not be printed.",
    "Existing GH_TOKEN detected.",
    "$env:GH_TOKEN =",
    "gh api installation/repositories --jq '.repositories[].full_name'",
    "gh api repos/urkrass/Tanchiki --jq '.full_name'",
    "gh pr view <PR_NUMBER> --repo",
    "prompts",
    "reviewer-app-dispatcher.md",
    "Tanchiki — Playable Tank RPG Prototype",
    "Do not run Dispatcher automatically.",
    "pushing code or updating PR branches",
    "running Coder work",
    "running Test work",
    "merging PRs",
    "applying merge:auto-eligible",
    "removing stop labels",
    "applying GitHub labels",
    "changing workflows, repo settings, branch protection, secrets, or Reviewer App permissions",
    "Remove-Item Env:\\\\GH_TOKEN -ErrorAction SilentlyContinue",
    "This token is short-lived and was not written to disk.",
  ]) {
    assert.match(sessionScript, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "export async function createReviewerAppInstallationToken",
    "export function readReviewerAppEnvironment",
    "export function validatePrivateKeyPath",
    "export function formatPowerShellString",
    "isDirectRun(import.meta.url)",
  ]) {
    assert.match(tokenScript, new RegExp(escapeRegExp(expected)));
  }
});

test("daily identity ritual keeps coder reviewer and human merge identities separate", () => {
  const readme = readRepoFile("README.md");

  for (const expected of [
    "Before starting, decide which role this shell is serving.",
    "A shell should be a",
    "human merge-label shell, not a mix of those",
    "Coder session:",
    "use the normal GitHub identity",
    "Do not load the Reviewer",
    "do not use a Reviewer App `GH_TOKEN` while coding",
    "pushing branches",
    "opening PRs",
    "If `GH_TOKEN` is set",
    "from a prior review, clear it first:",
    "Reviewer session:",
    "only for Reviewer-agent PR inspection, comments, and reviews",
    "Verify access",
    "`gh api installation/repositories` before review",
    "Cleanup after review:",
    "Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue",
    "Human merge-label session:",
    "return to the normal GitHub identity before",
    "applying `merge:auto-eligible`",
    "merging",
    "Reviewer App credentials must not perform those actions.",
    "verify the normal",
    "identity before any label or merge action.",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(expected)));
  }
});

test("reviewer app routine statically guards forbidden merge and secret handling actions", () => {
  const script = readRepoFile("scripts", "reviewer-app-token.js");
  const readme = readRepoFile("README.md");
  const safety = readRepoFile("SAFETY_BOUNDARIES.md");
  const gitignore = readRepoFile(".gitignore");
  const combinedRoutineText = `${script}\n${readme}\n${safety}`;

  for (const expected of [
    "Forbidden with this Reviewer App token:",
    "Existing GH_TOKEN detected.",
    "merging PRs",
    "applying merge:auto-eligible",
    "removing stop labels",
    "enabling auto-merge",
    "changing workflows, repo settings, branch protection, or secrets",
    "Do not use this Reviewer App GH_TOKEN in Coder sessions or human merge-label sessions.",
    "Coder sessions and human merge-label sessions must use the normal GitHub identity after GH_TOKEN is cleared.",
    "Then verify the normal identity before coding or human label work:",
    "must not push code",
    "merge PRs",
    "apply `merge:auto-eligible`",
    "remove stop labels",
    "Secrets, `.pem` files, local env files, and generated installation tokens stay",
    "private key stay outside the repository",
    "private key contents will not be printed",
    "never writes the token or private key to disk",
    "generated installation tokens must stay temporary in the current shell through",
    "`GH_TOKEN`",
  ]) {
    assert.match(combinedRoutineText, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of ["*.pem", "reviewer-env.ps1", ".env", ".env.*"]) {
    assert.match(gitignore, new RegExp(`^${escapeRegExp(expected)}$`, "m"));
  }
});

test("campaign request template exposes review cadence choices", () => {
  const template = readRepoFile(".github", "ISSUE_TEMPLATE", "campaign-request.yml");

  for (const expected of [
    "Review cadence",
    "final-audit",
    "paired-review",
    "let-architect-decide",
    "default: 2",
    "Default is let-architect-decide.",
    "Choose paired-review for trust-boundary or high-risk work",
    "choose final-audit for low-risk documentation/test/harness campaigns",
    "choose let-architect-decide if unsure",
  ]) {
    assert.match(template, new RegExp(escapeRegExp(expected)));
  }
});

test("campaign review cadence modes define final-audit and paired-review semantics", () => {
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const readme = readRepoFile("README.md");
  const reviewerPrompt = readRepoFile("ops", "prompts", "reviewer-agent.md");
  const combined = `${factory}\n${execution}\n${readme}\n${reviewerPrompt}`;

  for (const expected of [
    "`final-audit`:",
    "Expected inputs are merged or explicitly abandoned campaign PRs.",
    "Merged PRs are normal and not a blocker.",
    "The Reviewer does not approve merge retroactively",
    "`paired-review`:",
    "The Reviewer inspects an open PR before merge.",
    "The PR must be open, non-draft, unmerged",
    "`let-architect-decide`:",
    "Architect must choose `final-audit` or `paired-review`",
    "record the decision in Linear",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("planner and groomer require cadence recommendation and dependency shaping", () => {
  const requestPrompt = readRepoFile("prompts", "codex-plan-campaign-request.md");
  const planAndGroom = readRepoFile("prompts", "codex-plan-and-groom-campaign.md");
  const planner = readRepoFile("ops", "prompts", "planner-agent.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const plannerChecklist = readRepoFile("ops", "checklists", "planner-output-checklist.md");
  const groomingChecklist = readRepoFile("ops", "checklists", "campaign-grooming-checklist.md");
  const combined = `${requestPrompt}\n${planAndGroom}\n${planner}\n${groomer}\n${plannerChecklist}\n${groomingChecklist}`;

  for (const expected of [
    "Planner must recommend a review cadence for every campaign.",
    "Include review cadence in the campaign summary",
    "Reviewer: paired-review PR for <issue id/title>",
    "Reviewer: final audit for <campaign name>",
    "If review cadence is `let-architect-decide`, an Architect issue must choose `final-audit` or `paired-review` before implementation issues are promoted.",
    "For `paired-review`, each PR-producing Coder/Test issue blocks its paired Reviewer issue",
    "For `final-audit`, a single final-audit Reviewer runs after implementation/test PRs are merged or explicitly abandoned.",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("paired-review is recommended for trust-boundary work while final-audit remains low-risk", () => {
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const prAcceptance = readRepoFile("ops", "policies", "pr-acceptance.md");
  const readme = readRepoFile("README.md");
  const combined = `${factory}\n${execution}\n${prAcceptance}\n${readme}`;

  for (const expected of [
    "security-sensitive or trust-boundary work",
    "Reviewer App / identity / token workflow",
    "GitHub permissions",
    "secrets or credentials handling",
    "CI/workflows",
    "deployment",
    "dependencies",
    "`risk:medium` or higher unless Architect justifies `final-audit`",
    "`src/game.js`",
    "`src/render.js`",
    "`src/game/movement.js`",
    "low-risk docs campaigns",
    "low-risk harness docs/checklist campaigns",
    "low-risk test-only campaigns",
    "routine release notes",
    "retrospective campaign summaries",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("conductor separates paired-review open PR rules from final-audit inputs", () => {
  const conductorPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const conductorPolicy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const conductorChecklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${conductorPrompt}\n${conductorPolicy}\n${conductorChecklist}\n${protocol}\n${validation}`;

  for (const expected of [
    "If review cadence is missing or ambiguous, stop",
    "paired-review",
    "linked PR exists, is open, non-draft, unmerged",
    "Promoted as paired-review Reviewer for open PR #X.",
    "final-audit",
    "do not require open PRs",
    "Treat merged PRs as expected audit inputs",
    "Promoted as final-audit Reviewer. Merged PRs are expected audit inputs.",
    "upstream PR-producing issues are Done or explicitly abandoned",
    "campaign implementation/test PRs are available for audit",
    "implementation/test PRs are merged or explicitly abandoned",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }

  assert.match(
    combined,
    /do not promote the next Coder\/Test issue until the previous\s+PR-producing issue is Done, its paired Reviewer issue is Done, and the PR was\s+merged or explicitly abandoned with a recorded outcome/i,
  );
  assert.match(combined, /Do not apply paired-review\s+open-PR\s+rules to final-audit issues/);
});

test("reviewer decision vocabulary differs by review cadence", () => {
  const reviewerPrompt = readRepoFile("ops", "prompts", "reviewer-agent.md");
  const prAcceptance = readRepoFile("ops", "policies", "pr-acceptance.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${reviewerPrompt}\n${prAcceptance}\n${validation}`;

  for (const expected of [
    "Allowed pre-merge paired-review decisions:",
    "`APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`",
    "`APPROVED FOR MERGE`",
    "`CHANGES REQUESTED`",
    "`HUMAN REVIEW REQUIRED`",
    "`BLOCKED`",
    "Allowed final-audit decisions:",
    "`AUDIT PASSED`",
    "`AUDIT PASSED WITH NOTES`",
    "`HUMAN FOLLOW-UP REQUIRED`",
    "`BLOCKING FINDING`",
    "Do not use paired-review open-PR requirements to block a final-audit Reviewer issue.",
    "Do not use final-audit language to approve an open PR before merge.",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("context economy docs protect context packs and safety context", () => {
  const policy = readRepoFile("ops", "policies", "context-economy.md");
  const checklist = readRepoFile("ops", "checklists", "context-pack-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const combined = `${policy}\n${checklist}\n${protocol}`;

  for (const expected of [
    "A campaign context pack is a compact, durable summary for one multi-issue",
    "An issue context pack is the smallest safe slice needed to run one role.",
    "Role-Specific Context Budgets",
    "Safety-critical docs cannot be skipped. Token saving never overrides",
    "Token saving is not used to skip `TASK_PROTOCOL.md`.",
    "Token saving is not used to skip `VALIDATION_MATRIX.md`.",
    "Token saving is not used to skip `SAFETY_BOUNDARIES.md`.",
    "Broad repo scans require a recorded reason",
    "The reason for any broad repo scan is recorded in Linear, the PR body",
    "templates, role-specific context budgets, context refresh rules, and advisory",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("context economy role prompts start from bounded role inputs", () => {
  const contextPolicy = readRepoFile("ops", "policies", "context-economy.md");
  const contextChecklist = readRepoFile("ops", "checklists", "context-pack-checklist.md");
  const coderPrompt = readRepoFile("ops", "prompts", "coder-agent.md");
  const testPrompt = readRepoFile("ops", "prompts", "test-agent.md");
  const reviewerPrompt = readRepoFile("ops", "prompts", "reviewer-agent.md");
  const releasePrompt = readRepoFile("ops", "prompts", "release-agent.md");
  const combined = [
    contextPolicy,
    contextChecklist,
    coderPrompt,
    testPrompt,
    reviewerPrompt,
    releasePrompt,
  ].join("\n");

  for (const expected of [
    "Start from the issue context pack, listed files, required safety docs, and",
    "Read the relevant issue, issue context pack, campaign context pack, PR diff",
    "Start from PR diff, linked issue, context pack, validation evidence, and PR",
    "Start from merged PR summaries, Linear comments, campaign context pack, and",
    "Token saving must never reduce diff scrutiny.",
    "Reviewer starts from PR diff, linked issue, context pack, validation",
    "Coder starts from issue context pack, listed files, required safety docs",
    "Release starts from merged PR summaries, Linear comments, campaign",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("context economy planning and routing prompts preserve pack boundaries", () => {
  const planner = readRepoFile("ops", "prompts", "planner-agent.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const plannerRequest = readRepoFile("prompts", "codex-plan-campaign-request.md");
  const dispatcher = readRepoFile("prompts", "codex-next.md");
  const conductor = readRepoFile("prompts", "codex-conduct-campaign.md");
  const combined = `${planner}\n${groomer}\n${plannerRequest}\n${dispatcher}\n${conductor}`;

  for (const expected of [
    "Create a campaign context pack",
    "Keep issue context packs concise. Reference the campaign context pack instead of repeating broad repo process text.",
    "Ensure the campaign has a campaign context pack attached or clearly referenced",
    "Each issue context pack should be minimal and role-specific.",
    "Use the issue context pack and campaign context pack when present.",
    "Use the campaign context pack and issue context packs when present, but do not use them to skip campaign order, blockers, PR readiness, safety docs, or Level 5 metadata checks.",
    "Record a reason before broad repo scans.",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("context manifest defines required loading and stop rules", () => {
  const manifestPath = join(root, "ops", "context-manifest.md");
  assert.equal(existsSync(manifestPath), true);

  const manifest = readRepoFile("ops", "context-manifest.md");

  for (const expected of [
    "## Always-Load Context",
    "## Role-Specific Context",
    "Token saving must never skip safety-critical docs",
    "Broad-Scan Justification Rule",
    "Record the reason for any broad repo scan in Linear, the PR body, the review",
    "Missing-Context Stop Rule",
    "Stop and ask for human or operator triage when required context is missing",
    "Stop when the issue lacks exactly one role/type/risk/validation label",
  ]) {
    assert.match(manifest, new RegExp(escapeRegExp(expected)));
  }
});

test("short prompts require active project and context manifest", () => {
  const promptPaths = [
    ["prompts", "short", "planner.md"],
    ["prompts", "short", "conductor.md"],
    ["prompts", "short", "dispatcher.md"],
    ["prompts", "short", "reviewer-app-dispatcher.md"],
    ["prompts", "short", "release.md"],
  ];

  for (const pathParts of promptPaths) {
    const prompt = readRepoFile(...pathParts);
    assert.match(prompt, /Active Linear project:/);
    assert.match(prompt, /ops\/context-manifest\.md/);
  }
});

test("short role prompts preserve conductor dispatcher and reviewer app boundaries", () => {
  const conductor = readRepoFile("prompts", "short", "conductor.md");
  const dispatcher = readRepoFile("prompts", "short", "dispatcher.md");
  const reviewerApp = readRepoFile("prompts", "short", "reviewer-app-dispatcher.md");

  for (const expected of [
    "Do not run Dispatcher.",
    "Do not implement code.",
    "Do not review PRs.",
    "Do not merge.",
  ]) {
    assert.match(conductor, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Work one issue only.",
    "Stop if the issue lacks exactly one `role:*`, `type:*`, `risk:*`, or `validation:*` label.",
    "Do not merge.",
    "Do not mark Done.",
  ]) {
    assert.match(dispatcher, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Reviewer App identity",
    "Use Reviewer App identity only for PR inspection, review comments, and review submission.",
    "Do not merge.",
    "Do not apply GitHub labels.",
    "Do not apply `merge:auto-eligible`.",
    "Do not remove stop labels.",
  ]) {
    assert.match(reviewerApp, new RegExp(escapeRegExp(expected)));
  }
});

test("model routing policy defines allowed hints and downgrade stop rules", () => {
  const modelRouting = readRepoFile("ops", "policies", "model-routing.md");
  const contextEconomy = readRepoFile("ops", "policies", "context-economy.md");
  const checklist = readRepoFile("ops", "checklists", "model-routing-checklist.md");
  const contextChecklist = readRepoFile("ops", "checklists", "context-pack-checklist.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const combined = `${modelRouting}\n${contextEconomy}\n${checklist}\n${contextChecklist}\n${protocol}\n${validation}`;

  for (const expected of [
    "`model_hint: frontier`",
    "`model_hint: cheap`",
    "`model_hint: local-ok`",
    "`model_hint: human-only`",
    "If the current model is below the required `model_hint`, stop unless a human",
    "Agents must stop if the current model is below the required `model_hint` unless a human explicitly",
    "`model_hint: human-only` stops automation",
    "Local/cheap models may only be used for bounded low-risk work",
    "Validation requirements, PR metadata, Reviewer",
    "gates, human gates, and safety docs do not change",
    "`model_hint` does not override risk gates.",
    "`model_hint` does not override validation profiles or validation",
    "`model_hint` does not override PR metadata requirements.",
    "`model_hint` does not override safety docs, human gates, stop labels",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("model routing docs map hints to role type and risk lanes", () => {
  const modelRouting = readRepoFile("ops", "policies", "model-routing.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");
  const readme = readRepoFile("README.md");
  const combined = `${modelRouting}\n${validation}\n${readme}`;

  for (const expected of [
    "Planner: usually `model_hint: frontier`.",
    "Architect: usually `model_hint: frontier`.",
    "Coder, low-risk docs/test/harness: `model_hint: cheap` or",
    "Coder, gameplay/progression/rendering/movement: `model_hint: frontier`",
    "Reviewer, low-risk docs/test: `model_hint: cheap` or `model_hint: frontier`",
    "Reviewer, trust-boundary, auto-merge, GitHub App, safety policy",
    "Release: `model_hint: cheap` or `model_hint: local-ok`",
    "Movement, collision, security, secrets, deployment, dependencies, CI",
    "Allowed `model_hint` values are `model_hint: frontier`, `model_hint: cheap`",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("planner groomer dispatcher and conductor enforce model routing rules", () => {
  const planner = readRepoFile("ops", "prompts", "planner-agent.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const dispatcher = readRepoFile("prompts", "codex-next.md");
  const conductor = readRepoFile("prompts", "codex-conduct-campaign.md");
  const combined = `${planner}\n${groomer}\n${dispatcher}\n${conductor}`;

  for (const expected of [
    "`ops/policies/model-routing.md`",
    "`ops/checklists/model-routing-checklist.md`",
    "advisory `model_hint` recommendations using `model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, or `model_hint: human-only`",
    "Ensure `model_hint` uses one allowed value: `model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, or `model_hint: human-only`.",
    "Stop if the current model is below the required `model_hint` and no human",
    "downgrade approval is recorded.",
    "Stop if the current model is below the required `model_hint` and no human downgrade approval is recorded.",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

test("linear campaign project policy requires active project scoping", () => {
  const factory = readRepoFile("ops", "policies", "campaign-factory.md");
  const execution = readRepoFile("ops", "policies", "campaign-execution.md");
  const conductorPolicy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const factoryChecklist = readRepoFile("ops", "checklists", "campaign-factory-checklist.md");
  const groomingChecklist = readRepoFile("ops", "checklists", "campaign-grooming-checklist.md");
  const conductorChecklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const roleRouter = readRepoFile("ops", "policies", "role-router.md");
  const roleChecklist = readRepoFile("ops", "checklists", "role-routing-checklist.md");
  const planner = readRepoFile("ops", "prompts", "planner-agent.md");
  const groomer = readRepoFile("ops", "prompts", "campaign-groomer.md");
  const conductorPrompt = readRepoFile("ops", "prompts", "campaign-conductor.md");
  const releasePrompt = readRepoFile("ops", "prompts", "release-agent.md");
  const requestPrompt = readRepoFile("prompts", "codex-plan-campaign-request.md");
  const planAndGroom = readRepoFile("prompts", "codex-plan-and-groom-campaign.md");
  const conduct = readRepoFile("prompts", "codex-conduct-campaign.md");
  const dispatcher = readRepoFile("prompts", "codex-next.md");
  const readme = readRepoFile("README.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");
  const agents = readRepoFile("AGENTS.md");
  const requestTemplate = readRepoFile(".github", "ISSUE_TEMPLATE", "campaign-request.yml");
  const prTemplate = readRepoFile(".github", "PULL_REQUEST_TEMPLATE.md");
  const combined = [
    factory,
    execution,
    conductorPolicy,
    roleRouter,
    factoryChecklist,
    groomingChecklist,
    conductorChecklist,
    roleChecklist,
    planner,
    groomer,
    conductorPrompt,
    releasePrompt,
    requestPrompt,
    planAndGroom,
    conduct,
    dispatcher,
    readme,
    protocol,
    agents,
    requestTemplate,
    prTemplate,
  ].join("\n");

  for (const expected of [
    "`main-project`: use `Tanchiki — Playable Tank RPG Prototype`",
    "`campaign-project`: use a dedicated",
    "`Tanchiki / Harness — <Campaign Name>`",
    "`Tanchiki / Game — <Campaign Name>`",
    "`Tanchiki / Release — <Campaign Name>`",
    "`Tanchiki / Research — <Campaign Name>`",
    "Planner output must include:",
    "Active Linear project: exact project name",
    "whether any automation-ready issues exist outside the active project",
    "Auto-Groomer must verify all campaign issues are in the same active project",
    "If campaign issues are split across projects",
    "Do not move issues across projects without explicit approval.",
    "The Campaign Conductor requires an active Linear project.",
    "Inspect only the declared active project.",
    "Run the Tanchiki dispatcher for the next eligible issue in the declared active project.",
    "multiple eligible issues exist",
    "across Tanchiki projects, stop.",
    "Release summaries must record active Linear project",
    "Active Linear project:",
  ]) {
    assert.match(combined, new RegExp(escapeRegExp(expected)));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
