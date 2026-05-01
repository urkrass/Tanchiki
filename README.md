# Tank RPG Game - Codex Handoff Pack

This pack is meant to be copied into the root of the local game repository before opening it with Codex.

## Public Demo

Tanchiki is a playable browser prototype. The first public demo target is:

```text
https://urkrass.github.io/Tanchiki/
```

Deployment is configured through GitHub Pages, but the Pages site must be enabled for GitHub Actions in the repository settings before the URL is live. Until then, run the demo locally:

```powershell
npm run dev
```

Then open `http://localhost:5173`.

### How To Play

- Move with WASD or Arrow keys.
- Fire with Space.
- Destroy the enemy base, survive the maze, choose one upgrade, then continue to the next level with `N` or Enter.
- Restart the current run with `R`.

The demo includes three campaign levels, enemy sentries, patrol enemies, pursuit enemies, pickups, mission summaries, XP rewards, and an in-memory upgrade flow.

See `docs/PUBLIC_DEMO_NOTES.md` for screenshots, release operator checks, and known limitations.

### Public Demo Validation

Before sharing a build, run:

```powershell
npm test
npm run build
npm run lint
```

For release checks, also open the local or deployed demo and confirm the objective, controls, canvas, mission status, and upgrade flow are visible and usable.

Agents can collect repeatable local browser smoke evidence with:

```powershell
npm run qa:browser-smoke
```

The smoke runner starts or reuses the local demo at `http://127.0.0.1:5173`, launches a local Chrome/Edge browser through DevTools, and checks desktop and narrow viewports for a loaded app, no console errors, a visible nonblank canvas, visible objective/controls/status text, and a usable narrow layout. Set `QA_BROWSER_URL` to target another approved URL, or `QA_BROWSER_PATH` if Chrome/Edge is installed outside the default paths.

### Known Limitations

- No save or persistence; progress resets when the page reloads.
- No final sprite atlas; the included sprite sheet is still reference art only.
- No audio, pause menu, settings menu, or mobile touch controls.
- No broad AI, movement, collision, or progression rewrites are part of the public-demo release.
- GitHub Pages may require manual repository settings before the public URL works.

It contains:

- `CODEX_HANDOFF.md` - project brief and constraints.
- `HARNESS_MISSION.md` - short statement of the harness training purpose.
- `ARCHITECTURE.md` - current module ownership and extension points.
- `TASK_PROTOCOL.md` - Linear, branch, PR, CI, review, merge, and Done rules.
- `VALIDATION_MATRIX.md` - role/type/risk/validation requirements.
- `SAFETY_BOUNDARIES.md` - protected files, human gates, and repository safety rules.
- `ops/context-manifest.md` - repo-owned context-loading contract for short prompts and role context.
- `ops/policies/context-economy.md` - campaign and issue context-pack policy.
- `ops/policies/model-routing.md` - `model_hint` values and model-routing safety rules.
- `ops/checklists/context-pack-checklist.md` - context-pack safety checklist.
- `ops/checklists/model-routing-checklist.md` - model-routing safety checklist.
- `prompts/CODEX_START_PROMPT.md` - first prompt to paste into Codex.
- `docs/ASSET_PIPELINE.md` - recommended sprite/tileset pipeline.
- `assets/style_reference_sprite_sheet.png` - visual style reference only, not yet a clean production sprite sheet.
- `assets/sprite_manifest.template.json` - target manifest format for usable sprite sheets.
- `index.html` - browser entry point for the playable prototype.
- `src/main.js` - requestAnimationFrame loop and fixed-step update driver.
- `src/game.js` - game state wiring for level, player, and movement.
- `src/render.js` - Canvas renderer.
- `src/input.js` - keyboard input handling.
- `src/game/level.js` - small test level and blocked-cell checks.
- `src/game/movement.js` - minimal grid movement state module.
- `src/game/projectiles.js` - shell spawning, cooldown, travel, range, and wall collisions.
- `src/game/sentries.js` - stationary enemy line-of-sight firing and player damage constants.
- `src/game/spawnValidation.js` - mission-start safety checks.
- `src/game/targets.js` - stationary dummy targets and damage rules.
- `test/movement.test.js` - movement behavior tests.
- `test/projectiles.test.js` - projectile and shooting behavior tests.
- `test/sentries.test.js` - enemy sentry and line-of-sight behavior tests.
- `test/spawnValidation.test.js` - safe mission-start validation tests.
- `test/targets.test.js` - dummy target hit/damage behavior tests.

Important: the included PNG is a style board/reference. It contains labels, grey background, and irregular layout. Codex should not treat it as a finished transparent sprite atlas unless it first builds a clean slicing/extraction workflow or replaces it with clean generated assets.

## Commands

Requires Node.js 20+.

```powershell
npm test
npm run build
npm run lint
npm run dev
npm run codex:next
```

Run `npm run dev`, then open `http://localhost:5173`.

If port `5173` is already occupied, do not treat that alone as a prototype failure. Check whether the existing server is usable at `http://localhost:5173`; if it is stale, stop that process and rerun `npm run dev`.

Use Arrow keys or WASD to move. Press Space to fire a shell in the tank's current facing direction. Enemy sentries fire when they have clear row/column line of sight. Press `R` to restart.

`npm run codex:next` prints the default Level 5 Dispatcher prompt from `prompts/codex-next.md`. Paste that prompt into Codex to route the next eligible Linear issue to the correct role automatically.

### Executable Campaign Conductor Step

`npm run conductor:step` is the first local entry point for the Campaign
Conductor state machine. The command is deliberately boring and deterministic:
it never calls OpenAI, never runs Dispatcher, Coder, Reviewer, Release, or Merge
work, never submits GitHub reviews, never merges, never changes GitHub labels,
and never changes repository settings, workflows, branch protection,
deployment, or secrets.

Without an explicit active project, the command stops. In live mode it also
requires process-scoped Linear and GitHub auth plus explicit repo, PR, producer,
and paired Reviewer issue inputs so it cannot guess campaign state. Missing
auth is reported without printing tokens:

```powershell
npm run conductor:step -- --active-project "<exact Linear project name>"
```

Use report-only candidate discovery before exposing broader automation queues:

```powershell
npm run conductor:step -- --active-project "<exact Linear project name>" --report-candidates
```

Report mode reads only Linear issues in the active project with
`automation-ready`, lists status/status type and Level 5 metadata, ignores
completed or canceled historical issues, and prints the exact next safe action.
It does not mutate Linear, call GitHub, run roles, remove labels, merge, or call
OpenAI/Codex.

The live path is explicit-input only. Conductor v2 can sync a valid
current-head `tanchiki-reviewer[bot]` paired-review decision by moving the
paired Reviewer Linear issue to `In Review` and adding one audit comment.
Conductor v3 adds the next post-merge Linear transitions: after a human merge
and recorded paired-review outcome, it may mark the producer issue Done, mark
the paired Reviewer issue Done on a later run, or promote one explicit Release
issue to `Todo` + `automation-ready` after upstream issues are Done.

```powershell
npm run conductor:step -- --active-project "<exact Linear project name>" --repo owner/name --pr 123 --producer MAR-331 --reviewer MAR-332
npm run conductor:step -- --active-project "<exact Linear project name>" --repo owner/name --pr 123 --producer MAR-336 --reviewer MAR-337 --release MAR-338
```

Use `--dry-run` with the same live arguments to read state and print the single
proposed sync without applying Linear mutation.

Each run applies at most one logical Linear transition, then exits. It does not
merge, change GitHub labels, remove stop labels, run a reviewer, run Release,
or continue through the campaign queue.

Use fixture mode to exercise the deterministic transition core:

```powershell
npm run conductor:step -- --fixture .\path\to\campaign-state.json
```

The output always includes the active project, decision, evidence, proposed
mutation when one is safe, and the next human or agent action. A wrapper agent
or future integration can apply the proposed single mutation after performing
the same Linear/GitHub safety checks.

## Git Discipline

This repository uses a versioned pre-commit hook in `.githooks/pre-commit`.

The repo-local Git config should point hooks at that directory:

```powershell
git config core.hooksPath .githooks
```

Before every commit, the hook runs:

```powershell
npm test
npm run build
npm run lint
```

If any command fails, the commit is blocked. Do not push automatically.

## Local Reviewer App Session Helper

Reviewer-agent sessions can use the local Tanchiki Reviewer GitHub App identity
for PR review work instead of the normal GitHub user identity. This is local
harness tooling only; it must not change gameplay, deployment, CI workflows,
branch protection, or auto-merge behavior.

The local Reviewer App environment and private key stay outside the repository:

```text
C:\Users\Legion\.config\tanchiki-reviewer-app\
```

### One-Command Reviewer Agent Path

`reviewer:agent` uses two separate GitHub auth paths:

1. Normal GitHub auth for read-only PR evidence collection. Set `GH_TOKEN` or
   `GITHUB_TOKEN` from the normal GitHub identity before running the command:

```powershell
$env:GH_TOKEN = gh auth token
```

2. Reviewer App auth for live GitHub review submission. The live command creates
   this short-lived Reviewer App token internally only after local preflight,
   OpenAI output validation, and review-body validation pass. Do not export a
   Reviewer App token into the operator shell for evidence collection.

Recommended paired-review burn-in flow is a stable dry-run artifact followed by
artifact submission. Dry-run mode collects evidence, calls OpenAI, validates the
strict JSON decision and review body, writes the sanitized validated artifact,
and must not request a Reviewer App token or submit a GitHub review:

```powershell
npm run reviewer:agent -- --pr <PR_NUMBER> --issue <MAR-ID> --dry-run --output "$env:TEMP\reviewer-agent-<PR_NUMBER>.json"
```

Submit the exact validated artifact without another OpenAI call:

```powershell
npm run reviewer:agent -- --submit-from "$env:TEMP\reviewer-agent-<PR_NUMBER>.json"
```

`--submit-from` rechecks that the PR is still open, non-draft, unmerged, on the
same head SHA, passing checks, complete metadata/scope gates, and free of stop
labels before creating the short-lived Reviewer App token. If the head SHA or a
gate changed, rerun the dry-run artifact step.

Direct live mode remains available for compatibility, but it performs a fresh
OpenAI call at submission time. Use it only when a fresh generated decision is
acceptable:

```powershell
npm run reviewer:agent -- --pr <PR_NUMBER> --issue <MAR-ID>
```

When editing PR bodies manually in PowerShell, prefer a single-quoted here-string
so Markdown backticks stay literal:

```powershell
$body = @'
## Linked Linear Issue

Closes: MAR-000

Inline code like `reviewer:agent` stays intact.
'@

gh pr edit <PR_NUMBER> --body $body
```

Load the local environment, then run each Reviewer App GitHub command through
the token-scoped runner:

```powershell
. "$env:USERPROFILE\.config\tanchiki-reviewer-app\reviewer-env.ps1"
npm run reviewer:with-token -- gh api installation/repositories --jq ".repositories[].full_name"
```

Equivalent direct command:

```powershell
node scripts/reviewer-with-token.js gh api installation/repositories --jq ".repositories[].full_name"
```

The runner verifies
`GITHUB_REVIEWER_APP_ID`, `GITHUB_REVIEWER_INSTALLATION_ID`, and
`GITHUB_REVIEWER_PRIVATE_KEY_PATH`, confirms the private key path exists,
generates a short-lived installation token, and spawns the requested `gh`
command with `GH_TOKEN` set only in that child process. It does not export
`GH_TOKEN` into the parent shell, print the token, print the private key, or
write the token to disk.

For paired-review PR work, prefer the higher-level review executor after the
human gate has approved the Reviewer App v4 boundary:

```powershell
npm run reviewer:review-pr -- --pr <PR_NUMBER> --issue <MAR-ID> --decision comment --body "HUMAN REVIEW REQUIRED: ..."
npm run reviewer:review-pr -- --pr <PR_NUMBER> --issue <MAR-ID> --decision approve --body-file .\review-body.txt
npm run reviewer:review-pr -- --pr <PR_NUMBER> --issue <MAR-ID> --decision request-changes --body-file .\review-body.txt
```

The executor accepts only explicit `comment`, `approve`, and
`request-changes` decisions. It inspects the target PR, refuses Draft or merged
PRs, checks the linked issue, PR metadata, changed files, stop labels, and check
status, and submits only a GitHub PR review. Approval requires passing gates and
a body containing `APPROVED FOR MERGE` plus reviewer independence basis. It does
not merge, label, edit issues, push commits, run Dispatcher or Conductor,
change workflows/settings/branch protection, print tokens, or write credentials
to disk.

Target command shape:

```powershell
npm run reviewer:with-token -- <command>
```

Allowed examples:

```powershell
npm run reviewer:with-token -- gh auth status
npm run reviewer:with-token -- gh api installation/repositories --jq ".repositories[].full_name"
npm run reviewer:with-token -- gh pr view <PR_NUMBER> --repo urkrass/Tanchiki
npm run reviewer:with-token -- gh pr diff <PR_NUMBER> --repo urkrass/Tanchiki
npm run reviewer:with-token -- gh pr checks <PR_NUMBER> --repo urkrass/Tanchiki
npm run reviewer:with-token -- gh pr review <PR_NUMBER> --comment --body "Reviewer App smoke test"
```

`gh pr review <PR_NUMBER> --approve ...` is allowed only when the Reviewer
policy allows approval. The runner refuses obvious forbidden command patterns,
including `gh pr merge`, `gh pr edit`, `gh issue edit`, `gh label`, `git push`,
`git commit`, `git tag`, `git reset`, and commands containing
`merge:auto-eligible`. It also refuses non-`gh` commands and write-shaped
`gh api` invocations so it does not become a general automation bypass.

Manual smoke test before Reviewer-agent GitHub operations:

```powershell
npm run reviewer:with-token -- gh api installation/repositories --jq ".repositories[].full_name"
```

`gh api user` may fail or report no user identity because an installation token
represents the GitHub App installation, not the normal `urkrass` user account.
Use `gh auth status` as a diagnostic or after-cleanup check, not as the primary
proof of Reviewer App installation access.

The session helper remains available as a prompt/checklist helper:

```powershell
npm run reviewer:session
```

Equivalent direct prompt helper:

```powershell
node scripts/reviewer-session.js
```

It prints the token-scoped command examples, safe verification commands,
Reviewer App Dispatcher short prompt, forbidden authority boundaries, and
cleanup guidance. It does not generate or print a token, export `GH_TOKEN`, call
Dispatcher automatically, run `gh`, push, label, or merge.

The lower-level token helper remains available for diagnostics:

```powershell
node scripts/reviewer-app-token.js
```

It can verify the token exchange, but it does not print the token or a
PowerShell assignment.

Real acceptance test:

1. Create or use a tiny open PR.
2. Load `reviewer-env.ps1`.
3. Run the manual smoke test through `npm run reviewer:with-token --`.
4. Submit a paired-review PR review through `npm run reviewer:review-pr -- ...`
   when the v4 executor gates allow it, or use
   `npm run reviewer:with-token -- gh pr review ...` only for lower-level
   manual review commands.
5. Confirm GitHub shows the review or comment as the Tanchiki Reviewer GitHub
   App identity, not the normal `urkrass` user.

The Reviewer App may read PRs, inspect changed files, submit PR reviews,
comment on PRs, and comment on Linear if routed separately. The Reviewer App
must not push code, merge PRs, apply `merge:auto-eligible`, remove stop labels,
run Coder work, run Test work, enable auto-merge, change workflows, change repo
settings, change branch protection, modify secrets, or change Reviewer App
permissions.
It cannot remove stop labels; only a human operator may do that under the repo
acceptance policy.

### Daily Identity Ritual

Use a clean identity boundary for each session:

Before starting, decide which role this shell is serving. A shell should be a
Coder shell, a Reviewer shell, or a human merge-label shell, not a mix of those
roles.

1. **Coder session:** use the normal GitHub identity. Do not load the Reviewer
   App environment file and do not use a Reviewer App `GH_TOKEN` while coding,
   pushing branches, opening PRs, or updating PR metadata. If `GH_TOKEN` is set
   from a prior review, clear it first:

```powershell
Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue
gh auth status
```

2. **Reviewer session:** load `reviewer-env.ps1`, run
   `npm run reviewer:session` if you need the prompt checklist, then run
   Reviewer App GitHub operations through `npm run reviewer:with-token --`.
   Use it only for Reviewer-agent PR inspection, comments, and reviews.
   Verify access with the safe commands printed by the helper before review
   work. At minimum, run
   `npm run reviewer:with-token -- gh api installation/repositories --jq ".repositories[].full_name"`
   before review work, then use the printed Reviewer App Dispatcher short prompt for
   one linked paired-review PR.
3. **Cleanup after review:** the token-scoped runner does not set `GH_TOKEN` in
   the parent shell. If `GH_TOKEN` was set manually or by an older helper flow,
   clear it before any Coder or human merge-label work:

```powershell
Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue
gh auth status
```

4. **Human merge-label session:** return to the normal GitHub identity before
   applying `merge:auto-eligible`, enabling auto-merge, removing stop labels, or
   merging. Reviewer App credentials must not perform those actions. If the last
   shell work was a Reviewer session, clear `GH_TOKEN` and verify the normal
   identity before any label or merge action.

Secrets, `.pem` files, local env files, and generated installation tokens stay
outside the repo. The Reviewer App remains review/comment only.

## Level 1-6 Workflow Ladder

Tanchiki uses the repository itself as the operating manual for agentic development.

- Level 1: one small PR per issue, CI required, no direct `main` pushes.
- Level 2: Codex selects the next eligible Linear issue instead of being handed one manually.
- Level 3: Planner turns a campaign brief into small Linear issues and runs Auto-Groomer.
- Level 4: role-separated agents handle Architect, Coder, Test, Reviewer, and Release work.
- Level 5: every automated issue must declare one role, one type, one risk, and one validation profile.
- Level 6: root docs, GitHub templates, workflows, ops policies, and checklists make the repo the orchestration system.

Level 6 source-of-truth docs:

- `ARCHITECTURE.md`
- `TASK_PROTOCOL.md`
- `VALIDATION_MATRIX.md`
- `SAFETY_BOUNDARIES.md`
- `ops/policies/`
- `ops/checklists/`

Context economy source-of-truth docs:

- `ops/context-manifest.md`
- `ops/policies/context-economy.md`
- `ops/policies/model-routing.md`
- `ops/checklists/context-pack-checklist.md`
- `ops/checklists/model-routing-checklist.md`

Short operator prompts should start from `ops/context-manifest.md`, then load
the role-specific docs and Linear/GitHub state required for the issue.
Context packs may summarize campaign and issue context so agents avoid repeated
rediscovery. They are not a substitute for the manifest or safety-critical
docs. Token saving must not skip Level 5 metadata, validation, PR metadata,
review cadence, changed-file scrutiny, stop labels, or human gates. Broad repo
scans require a recorded reason, and missing or contradictory required context
is a stop condition. Allowed values are
`model_hint: frontier`, `model_hint: cheap`, `model_hint: local-ok`, and
`model_hint: human-only`. Agents must stop if the current model is below the
required `model_hint` unless a human explicitly approves a downgrade.
`model_hint` cannot override role/type/risk/validation labels, validation
commands, Reviewer gates, safety docs, or human gates.

Normal dispatcher prompt:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki dispatcher for the next eligible issue in the declared active project.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.
```

Planner + Auto-Groomer prompt:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run prompts/codex-plan-and-groom-campaign.md for this Tanchiki campaign brief.
Create 5-7 issues, groom the campaign queue, expose only the first runnable issue, and report the final queue.
Do not implement gameplay.
Do not merge.
```

Campaign Conductor prompt:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki Campaign Conductor for the active campaign.
Inspect only the declared active project.
Inspect campaign state.
Inspect campaign notes, issue descriptions, grooming notes, and Architect comments for review_cadence before any promotion.
Promote exactly one next safe issue if eligible.
Promote issues only in the declared active project.
Repair only explicit metadata omissions from issue body.
Stop at human gates or ambiguity.
Do not move issues across projects unless explicitly instructed.
Do not edit repo files.
Do not run Dispatcher.
Do not merge.
Do not mark Done unless the protocol explicitly allows it.
Report the active project.
Report the promoted issue or the blocker.
```

The Campaign Conductor is a single-step queue safety layer. It may promote at
most one next campaign issue per run after checking Level 5 labels, dependency
state, role readiness, human gates, and linked PR state. It must not loop, run
Dispatcher, implement code, review PRs, merge PRs, apply
`merge:auto-eligible`, or remove human gate labels or PR stop labels. Missing
Level 5 labels may be repaired only when the exact label is explicitly stated in
the issue body. Ordinary campaign dependencies use Linear blocked-by / blocks
relations, not the `blocked` label. For legacy issues only, the Conductor may
remove a Linear issue `blocked` label under the strict conditions in
`ops/policies/campaign-conductor.md`; it must comment with the blocker evidence.
Promotion depends on review cadence. `paired-review` requires an open,
non-draft, unmerged linked PR with required checks passing when policy requires
them; paired-review PRs must be open, non-draft, unmerged, and passing required
checks before the paired Reviewer issue may run. Draft PRs remain blockers, and
the next Coder/Test issue waits until the previous PR-producing issue and
paired Reviewer are Done and the PR outcome is recorded as merged or explicitly
abandoned. `final-audit` expects merged or
explicitly abandoned campaign PRs and must not require open PRs. Final-audit
Reviewer promotion comments must say: "Promoted as final-audit Reviewer. Merged
PRs are expected audit inputs." Paired-review Reviewer promotion comments must
say: "Promoted as paired-review Reviewer for open PR #X." If review cadence is
missing or ambiguous, the Conductor stops and asks for cadence triage. For
low-risk auto-merge burn-in campaigns, the Conductor must stop at the human
merge-label gate and report: "Human must apply `merge:auto-eligible` using
normal GitHub identity."

Use human review when a task has movement, persistence, destructive repository operations, broad architecture rewrites, broad AI rewrites, or any unclear product decision. Use Level 5 gates for every automated issue. Use Level 6 docs when deciding where logic belongs, which validation profile applies, and whether an issue is safe for automation.

## Level 1 PR Workflow

Every pull request must be tied to one issue and stay small enough to review in one pass.

Required PR checks run in GitHub Actions on every pull request and on pushes to `main`:

```powershell
npm test
npm run build
npm run lint
```

CI uses Node.js 20. It installs dependencies with `npm ci` when `package-lock.json` exists, otherwise it uses `npm install`.

Use `.github/PULL_REQUEST_TEMPLATE.md` for PR descriptions and `ops/policies/level-1-agent-boundaries.md` for agent boundaries. The PR template is the canonical source of required PR body headings; preserve exact heading spelling and capitalization, and do not rename, shorten, or replace headings with older variants. Do not push directly to `main`, force push, start broad refactors, or include unrelated cleanup in a Level 1 PR.

Harness smoke-test PRs should use an `agent/` branch, may be opened as drafts while work is incomplete, and must have the PR template filled out before review. Normal feature PRs may also stay Draft when that is the clearest review posture for incomplete, exploratory, ordinary non-paired-review, validation-not-passed, or explicitly awaiting-author-completion work. Low-risk auto-merge candidate PRs, auto-merge burn-in PRs, and paired-review producer PRs with passing validation are different: Draft PRs are hard vetoes for auto-merge approval and paired-review approval, so those PRs must be marked ready for review before the Coder or Test session stops.

## Linear Label Taxonomy

Use explicit role, type, risk, validation, readiness, and gate labels for automation.

Role labels:

- `role:architect`
- `role:coder`
- `role:test`
- `role:reviewer`
- `role:release`

Readiness label:

- `automation-ready`

Issue type labels:

- `type:docs`
- `type:harness`
- `type:ui`
- `type:test`
- `type:gameplay`
- `type:progression`
- `type:architecture`
- `type:movement`

Risk labels:

- `risk:low`
- `risk:medium`
- `risk:high`
- `risk:human-only`

Validation profile labels:

- `validation:docs`
- `validation:harness`
- `validation:ui`
- `validation:test`
- `validation:gameplay`
- `validation:progression`
- `validation:movement`

Gate labels:

- `needs-human-approval`
- `human-only`
- `risk:human-only`

Dependency source of truth:

- Use Linear blocked-by / blocks relations for ordinary campaign sequencing.
- Keep downstream campaign issues in `Backlog` without `automation-ready` until promoted.
- Do not use the `blocked` label for normal downstream dependencies.

Deprecated ambiguous usage:

- Do not use `agent-ready` for new Level 4 routing.
- Do not use `human-review` to mean reviewer-agent work.
- Do not use `blocked` for ordinary campaign dependency sequencing; treat it as a legacy label only.
- Use `needs-human-approval` for human gates.
- Use `role:reviewer` for reviewer-agent work.

## Campaign Review Cadence

Every campaign must declare one review cadence so Planner, Auto-Groomer,
Conductor, and Reviewer agents know what a Reviewer issue means:

- `final-audit`: a campaign-level Reviewer issue audits the complete campaign
  near the end. Expected inputs are merged or explicitly abandoned campaign PRs.
  Merged PRs are normal and not a blocker. The Reviewer does not approve merge
  retroactively and uses `AUDIT PASSED`, `AUDIT PASSED WITH NOTES`,
  `HUMAN FOLLOW-UP REQUIRED`, or `BLOCKING FINDING`.
- `paired-review`: each PR-producing Coder/Test issue is followed by its own
  Reviewer issue. The Reviewer inspects an open PR before merge. The PR must be
  open, non-draft, unmerged, and have required checks/metadata according to
  policy. The Reviewer uses `APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES
  merge:auto-eligible`, `APPROVED FOR MERGE`, `CHANGES REQUESTED`,
  `HUMAN REVIEW REQUIRED`, or `BLOCKED`.
- `let-architect-decide`: Planner may use this when the campaign request is
  unclear. Architect must choose `final-audit` or `paired-review`, record the
  decision in Linear with the reason, and adjust downstream issues before
  implementation issues are promoted.

Use `paired-review` for PR acceptance / auto-merge policy, Reviewer App /
identity / token workflow, GitHub permissions, secrets or credentials handling,
CI/workflows, deployment, dependencies, security-sensitive or trust-boundary
work, movement/collision, `risk:medium` or higher unless Architect justifies
`final-audit`, anything touching `src/game.js`, `src/render.js`, or
`src/game/movement.js`, and broad architecture changes.

Use `final-audit` for low-risk docs campaigns, low-risk harness docs/checklist
campaigns, low-risk test-only campaigns, routine release notes, campaigns where
individual PRs are manually reviewed and merged normally, and retrospective
campaign summaries.

Planner must recommend a review cadence for every campaign and carry it through
the campaign summary, relevant issue descriptions, dependency order, and
grooming notes. Auto-Groomer shapes dependencies by cadence: `paired-review`
alternates PR-producing work with paired Reviewer issues, while `final-audit`
runs one final-audit Reviewer after implementation/test PRs are merged or
explicitly abandoned. Reviewer issue titles must say `Reviewer: paired-review
PR for <issue id/title>` or `Reviewer: final audit for <campaign name>`.

If a campaign starts with `review_cadence: let-architect-decide` and Architect
later chooses `review_cadence: paired-review`, the paired-review queue must be
materialized before implementation promotion. Planner/Auto-Groomer should
prefer placeholder paired Reviewer issues in Backlog when medium-risk
UI/gameplay/trust-boundary Coder/Test work might need paired review. Otherwise,
after the Architect decision, run `prompts/codex-repair-paired-review-queue.md`
to create missing paired Reviewer issues and wire:

```text
Producer Coder/Test issue -> paired Reviewer issue -> next Producer Coder/Test issue
```

The Conductor stops if paired-review is selected but a PR-producing issue lacks
a linked paired Reviewer issue. It must request Planner/Groomer queue repair
and must not create the missing issue itself.

## Linear Campaign Projects

Tanchiki supports two Linear project modes:

- `main-project`: use `Tanchiki — Playable Tank RPG Prototype` for ordinary
  work, single issues, small fixes, and maintenance.
- `campaign-project`: use a dedicated campaign project for multi-issue harness,
  product, release, or research campaigns, especially when the sequence includes
  human gates, paired reviews, and a Release summary.

Dedicated campaign projects must use a clear Tanchiki prefix:

- `Tanchiki / Harness — <Campaign Name>`
- `Tanchiki / Game — <Campaign Name>`
- `Tanchiki / Release — <Campaign Name>`
- `Tanchiki / Research — <Campaign Name>`

Examples:

- `Tanchiki / Harness — Token Economy`
- `Tanchiki / Harness — Reviewer App Routine`
- `Tanchiki / Game — Visual Identity`
- `Tanchiki / Release — Public Demo`

If a campaign is planned inside the main project, the campaign name must be
clear in every issue body. Operators should include the active project in
Conductor and Dispatcher prompts:

```text
Active Linear project: Tanchiki / Harness — Token Economy
```

Planner must report Linear project mode, active Linear project, campaign name,
created issue IDs, first eligible issue, and whether any automation-ready issues
exist outside the active project. Auto-Groomer, Conductor, Dispatcher, and
Release agents operate only inside the declared active project and must not move
issues across projects without explicit approval.

## Level 2 Command Center Workflow

Level 2 lets Codex select the next unit of work from Linear instead of requiring a manually named issue.

The Linear source of truth is `Tanchiki Level 2 Command Center Protocol` in the Tanchiki project:

https://linear.app/marsel/document/tanchiki-level-2-command-center-protocol-617ef034bf14

Use these Linear states:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

Codex may pick only issues that are all of the following:

- status `Todo`
- labeled `automation-ready`
- exactly one `role:*` label
- exactly one `type:*` label
- exactly one `risk:*` label
- exactly one `validation:*` label
- no legacy `blocked` label
- not blocked by an unresolved Linear blocked-by relation
- not safety-critical
- not labeled `needs-human-approval`
- not labeled `human-only`
- not labeled `risk:human-only`

Older `agent-ready` issues may exist in history, but new automation should use `automation-ready` plus one role, one type, one risk, and one validation profile label.

When Codex starts a Level 2 issue, it must move the issue to `In Progress`, create a branch from `main`, make one scoped change, run `npm test`, `npm run build`, and `npm run lint`, commit, push, and open a PR against `main`. Draft is allowed while work is incomplete, exploratory, ordinary non-paired-review, validation has not passed, or the work explicitly awaits author completion. For an explicitly scoped auto-merge candidate, auto-merge burn-in PR, or paired-review producer PR with passing validation, Codex must ensure the PR is not Draft, fill PR metadata, run required validation, move the Linear issue to `In Review`, report the PR number, and stop without reviewing, labeling, or merging. After the PR is opened and the required draft or ready-for-review posture is set, Codex must move the Linear issue to `In Review`.

Codex must not pick `Backlog` issues and must not move an issue to `Done` until the PR is merged or a human explicitly approves closing it.

Use `prompts/codex-next.md` to start the default dispatcher run.

For a new multi-issue campaign, use `prompts/codex-plan-and-groom-campaign.md`. That prompt creates the campaign issues and immediately runs the Campaign Groomer so only the first runnable issue is exposed to the dispatcher.

Before creating a Level 2 branch, Codex must run:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Campaign chains must expose only one `Todo` + `automation-ready` implementation issue at a time. Parent or epic issues must not have `automation-ready`; issues with unresolved blocked-by relations and `needs-human-approval` issues must not be implemented until they are explicitly made eligible.

Before implementation, Codex should inspect recent merged PRs or git history. If the issue touches files changed by the previous one to three merged PRs, Codex must report conflict risk. Repeated changes to `src/game.js` or `test/game.test.js` should trigger a seam-extraction recommendation.

If a PR conflicts with `main`, resolve conflicts on the PR branch, preserve both behaviors, rerun validation, push the PR branch, and do not merge automatically.

## Level 3 Planner Workflow

Level 3 lets Codex turn a high-level campaign brief into small Linear issues without implementing gameplay.

The Linear source of truth is `Tanchiki Level 3 Planner Protocol` in the Tanchiki project.

https://linear.app/marsel/document/tanchiki-level-3-planner-protocol-ec0d116846fd

Planner agents may:

- read the brief and repository documentation
- create Linear issues
- suggest labels, risk levels, and dependencies
- immediately groom the created campaign queue

Planner agents must not:

- edit source code
- implement gameplay
- apply `automation-ready` broadly
- move issues into implementation states

Planner agents must avoid applying `automation-ready` to parent, epic, unresolved dependency, `needs-human-approval`, or `human-only` issues. The required grooming pass may apply `automation-ready` only to the single first runnable issue. If architecture review is required first, that issue should be the first Architect issue, not a Coder issue.

Every planned issue must be classified as one of:

- `automation-ready candidate`
- `needs-human-approval`
- `human-only`
- `dependency via blocked-by relation`

Every planned issue must also include dependency order, blocked-by relationships, whether visible UI change is expected, central-file conflict risk, suggested role/type/risk/validation labels, and which issue should become `Todo` + `automation-ready` first.

Use these files for Level 3 planning:

- `ops/prompts/planner-agent.md`
- `ops/prompts/campaign-groomer.md`
- `ops/prompts/campaign-conductor.md`
- `ops/policies/planner-boundaries.md`
- `ops/policies/campaign-execution.md`
- `ops/policies/campaign-conductor.md`
- `ops/checklists/planner-output-checklist.md`
- `ops/checklists/campaign-grooming-checklist.md`
- `ops/checklists/campaign-conductor-checklist.md`
- `prompts/codex-plan-campaign.md`
- `prompts/codex-plan-and-groom-campaign.md`
- `prompts/codex-conduct-campaign.md`

### New Campaign Workflow

For a new campaign:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run prompts/codex-plan-and-groom-campaign.md for this Tanchiki campaign brief.
Create 5-7 issues, groom the campaign queue, expose only the first runnable issue, and report the final queue.
Do not implement gameplay.
Do not merge.
```

For normal iteration after grooming:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki dispatcher for the next eligible issue in the declared active project.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.
```

For a single safe promotion after blockers, human gates, or PR readiness change:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki Campaign Conductor for the active campaign.
Inspect only the declared active project.
Inspect campaign state.
Inspect campaign notes, issue descriptions, grooming notes, and Architect comments for review_cadence before any promotion.
Promote exactly one next safe issue if eligible.
Promote issues only in the declared active project.
Repair only explicit metadata omissions from issue body.
Stop at human gates or ambiguity.
Do not move issues across projects unless explicitly instructed.
Do not edit repo files.
Do not run Dispatcher.
Do not merge.
Do not mark Done unless the protocol explicitly allows it.
Report the active project.
Report the promoted issue or the blocker.
```

For harness work, use `validation:harness`, run harness-only validation, and do not edit gameplay code.

Validation for implementation PRs follows the issue's `validation:*` profile. Baseline validation:

```powershell
npm test
npm run build
npm run lint
```

## Level 5 Risk-Gated Validation Workflow

Level 5 requires every automated issue to declare:

- exactly one `role:*` label
- exactly one `type:*` label
- exactly one `risk:*` label
- exactly one `validation:*` label

The dispatcher refuses Todo issues with missing or duplicated metadata and comments on the Linear issue asking for triage. It also refuses `risk:human-only` and any issue where `automation-ready` appears with `blocked`, `needs-human-approval`, or `human-only`.

Validation profiles are defined in `ops/policies/risk-gated-validation.md`:

- `validation:docs`
- `validation:harness`
- `validation:ui`
- `validation:test`
- `validation:gameplay`
- `validation:progression`
- `validation:movement`

New normal workflow:

- New campaign: run Planner + Auto-Groomer, human reviews the queue, then Dispatcher executes one eligible issue at a time.
- Normal iteration: run the dispatcher; it chooses the role automatically and refuses issues missing Level 5 metadata.
- Harness work: use harness-only validation and do not edit gameplay code.

Level 5 shakedown campaigns:

- Use a small docs, UI-copy, or test-only campaign before larger gameplay campaigns to verify the gates.
- Expected queue: only the first Architect issue is `Todo` + `automation-ready`; follow-up Coder, Test, Reviewer, and Release issues stay Backlog with blocked-by relations until their dependencies or gates are cleared.
- Burn-in reruns should keep each PR to one narrow docs, harness, or static-test surface so any gate failure is easy to trace.
- Low-risk auto-merge shakedowns must stay limited to `risk:low` docs, harness, or test PRs, and any stop label remains a hard veto until a human operator resolves it.
- Draft PRs are hard vetoes for auto-merge approval and paired-review approval. Normal non-auto-merge feature PRs may still use Draft when appropriate, but low-risk auto-merge candidate PRs, auto-merge burn-in PRs, and paired-review producer PRs with passing validation must be marked ready for review before the Coder or Test session stops.
- A separate Reviewer-agent session must approve a low-risk auto-merge shakedown before a human applies `merge:auto-eligible`.
- Auto-merge shakedowns are conclusive only when the PR stays open through independent Reviewer-agent approval, human-applied `merge:auto-eligible`, and GitHub auto-merge.
- Include one intentionally gated movement placeholder with `type:movement`, `validation:movement`, `risk:human-only`, `human-only`, and `needs-human-approval`; it must not have `automation-ready`.
- The dispatcher should select only the exposed issue and refuse the human-only movement placeholder.
- Shakedown work must not edit gameplay source or `src/game/movement.js`.

## Level 4 Role-Separated Agent Workflow

Level 4 separates Codex runs by responsibility so planning, architecture review, implementation, testing, PR review, and release summary work do not blur together.

Use the Linear source of truth document `Tanchiki Level 4 Role-Separated Agent Protocol` in the Tanchiki project:

https://linear.app/marsel/document/tanchiki-level-4-role-separated-agent-protocol-ab4a77eb76bc

Roles:

- Planner: creates Linear issues only.
- Architect: reviews issue shape, architecture risk, dependency order, and conflict risk only.
- Coder: implements one Level 5 eligible `Todo` + `automation-ready` + `role:coder` issue only.
- Test agent: adds or improves focused tests without changing gameplay behavior unless required to make tests meaningful.
- Reviewer: reviews PR diffs and comments; it must not merge.
- Release agent: summarizes merged PRs and updates release or campaign notes; it must not change gameplay.

Every Level 4 role must start from updated `main`:

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git status --short
```

Every PR must target `main`. No role may bypass CI, push directly to `main`, merge automatically, or close parent campaign issues unless all children are done and a release summary exists.

### Default Level 5 Dispatcher

The default automation entrypoint is the Level 5 Dispatcher. Use it when the user wants Codex to continue the next eligible Tanchiki issue without manually choosing Architect, Coder, Test, Reviewer, or Release.

Default prompt:

```text
Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki dispatcher for the next eligible issue in the declared active project.
Choose the correct role automatically.
Follow the repo harness protocols, including Level 5 risk-gated validation.
Work one issue only.
Do not merge.
Do not mark Done.
```

The dispatcher follows `ops/policies/role-router.md`, `ops/policies/risk-gated-validation.md`, `ops/checklists/role-routing-checklist.md`, and `ops/checklists/risk-gate-checklist.md`. It must scan Todo issues inside the declared active Linear project, skip issues with unresolved blocked-by relations or gates, read the full selected Linear issue, report the active project and selected issue before acting, and choose the role from exactly one `role:*` label. If active project is missing and multiple eligible issues exist across Tanchiki projects, it stops.

Role routing:

- `role:architect` routes to Architect.
- `role:coder` routes to Coder.
- `role:test` routes to Test.
- `role:reviewer` routes to Reviewer.
- `role:release` routes to Release.

The dispatcher must never route architect, test, reviewer, or release work to Coder.

If no eligible issue exists, the dispatcher reports all dependency-blocked or gated candidates and the human action required to make one eligible. If the queue is ungroomed, the dispatcher must stop and ask for Campaign Groomer work. Ungroomed signals include missing or multiple `role:*`, `type:*`, `risk:*`, or `validation:*` labels, more than one campaign issue with `automation-ready`, unresolved blocked-by relations on an automation-ready issue, or `automation-ready` appearing with `blocked`, `needs-human-approval`, or `human-only`.

Use these files for Level 4 work:

- `ops/policies/role-router.md`
- `ops/policies/risk-gated-validation.md`
- `ops/policies/role-boundaries.md`
- `ops/checklists/risk-gate-checklist.md`
- `ops/checklists/role-routing-checklist.md`
- `ops/checklists/campaign-grooming-checklist.md`
- `ops/prompts/architect-agent.md`
- `ops/prompts/coder-agent.md`
- `ops/prompts/test-agent.md`
- `ops/prompts/reviewer-agent.md`
- `ops/prompts/release-agent.md`
- `ops/prompts/campaign-groomer.md`
- `ops/checklists/architect-review-checklist.md`
- `ops/checklists/pr-review-checklist.md`
- `ops/checklists/release-summary-checklist.md`
- `prompts/codex-architect-review.md`
- `prompts/codex-next.md`
- `prompts/codex-role-router.md`
- `prompts/codex-test-pass.md`
- `prompts/codex-review-pr.md`
- `prompts/codex-release-summary.md`
