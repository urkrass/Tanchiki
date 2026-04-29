import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    "Do not apply `automation-ready` to Coder, Test, Reviewer, Release, blocked, human-only, or needs-human-approval issues during intake.",
    "Make only the first safe Architect issue `Todo` + `automation-ready`.",
    "Keep all Coder/Test/Reviewer/Release issues Backlog or blocked until Architect and human gates are complete.",
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
    "no blocked, gated, human-only, parent, umbrella, or `risk:human-only` issue has `automation-ready`",
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
    "Draft PRs are a hard veto for auto-merge approval.",
    "PR is not draft; Draft PRs are hard vetoes for auto-merge approval.",
  ]) {
    assert.match(policy, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /Normal non-auto-merge\s+feature PRs may still use Draft when appropriate/);
  assert.match(policy, /low-risk auto-merge\s+candidate PRs and burn-in PRs must be ready for review before the Coder stops\./);

  for (const expected of [
    "Draft PRs are hard vetoes for auto-merge approval.",
    "Auto-merge candidate PRs and auto-merge burn-in PRs were marked ready for review before the Coder session stopped.",
    "Normal non-auto-merge feature PRs may still use Draft when appropriate.",
  ]) {
    assert.match(checklist, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "Draft PRs are hard vetoes for auto-merge approval",
    "Reviewer agents must keep rejecting Draft PRs for auto-merge paths.",
    "the PR is Draft for an auto-merge path",
  ]) {
    assert.match(reviewerPrompt, new RegExp(escapeRegExp(expected)));
  }
});

test("coder prompt requires ready-for-review PRs for low-risk auto-merge lanes", () => {
  const prompt = readRepoFile("ops", "prompts", "coder-agent.md");

  for (const expected of [
    "Normal feature PRs may still be Draft when appropriate.",
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

test("repo task docs require ready burn-in PRs before Linear review handoff", () => {
  const readme = readRepoFile("README.md");
  const protocol = readRepoFile("TASK_PROTOCOL.md");

  for (const expected of [
    "Low-risk auto-merge candidate PRs and auto-merge burn-in PRs are different",
    "those PRs must be marked ready for review before the Coder session stops",
    "ensure it is not Draft",
    "move the Linear issue to `In Review`",
    "stop without reviewing, labeling, or merging",
  ]) {
    assert.match(readme, new RegExp(escapeRegExp(expected)));
  }

  for (const expected of [
    "auto-merge burn-in PR",
    "mark it ready for review",
    "Draft PRs are hard vetoes for auto-merge approval",
  ]) {
    assert.match(protocol, new RegExp(escapeRegExp(expected)));
  }
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

test("campaign conductor metadata repair is explicit issue-body only", () => {
  const policy = readRepoFile("ops", "policies", "campaign-conductor.md");
  const checklist = readRepoFile("ops", "checklists", "campaign-conductor-checklist.md");
  const validation = readRepoFile("VALIDATION_MATRIX.md");

  for (const expected of [
    "## Risk label",
    "risk:low",
    "must not guess metadata from title alone",
    "Repair a missing Level 5 label only when the exact label appears in the issue body.",
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
    "Do not remove stop labels.",
  ]) {
    assert.match(`${policy}\n${checklist}\n${protocol}\n${safety}\n${readme}\n${validation}`, new RegExp(escapeRegExp(expected)));
  }
  assert.match(policy, /The Conductor may promote Reviewer issues only when the linked PR is open,\s+non-draft, and checks are passing\./);
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
    "Return `HUMAN REVIEW REQUIRED` if you authored the PR",
    "For auto-merge shakedowns, verify the PR is open until the full sequence completes",
    "Do not approve a PR authored by the same Codex session/run.",
    "Do not apply `merge:auto-eligible`; that label is human-controlled during shakedowns.",
    "whether GitHub auto-merge",
  ]) {
    assert.match(prompt, new RegExp(escapeRegExp(expected)));
  }
});

test("PR acceptance checklist and template guard auto-merge gates without live GitHub mutation", () => {
  const checklist = readRepoFile("ops", "checklists", "pr-acceptance-checklist.md");
  const template = readRepoFile(".github", "PULL_REQUEST_TEMPLATE.md");

  for (const expected of [
    "PR is not draft before any auto-merge path is considered.",
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

test("Reviewer App token helper documents local-only temporary GitHub App identity", () => {
  const script = readRepoFile("scripts", "reviewer-app-token.js");
  const readme = readRepoFile("README.md");
  const safety = readRepoFile("SAFETY_BOUNDARIES.md");
  const gitignore = readRepoFile(".gitignore");

  for (const expected of [
    "GITHUB_REVIEWER_APP_ID",
    "GITHUB_REVIEWER_INSTALLATION_ID",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
    "https://api.github.com/app/installations/",
    "access_tokens",
    "$env:GH_TOKEN =",
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
