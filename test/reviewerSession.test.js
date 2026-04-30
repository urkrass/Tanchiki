import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function readRepoFile(...pathParts) {
  return readFileSync(join(root, ...pathParts), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const sessionHelper = readRepoFile("scripts", "reviewer-session.js");
const tokenHelper = readRepoFile("scripts", "reviewer-app-token.js");
const withTokenHelper = readRepoFile("scripts", "reviewer-with-token.js");
const reviewerPrompt = readRepoFile("prompts", "short", "reviewer-app-dispatcher.md");
const readme = readRepoFile("README.md");
const routineSurface = [sessionHelper, tokenHelper, withTokenHelper, reviewerPrompt, readme].join("\n");

test("reviewer session helper preserves required environment and private key guards", () => {
  for (const expected of [
    "GITHUB_REVIEWER_APP_ID",
    "GITHUB_REVIEWER_INSTALLATION_ID",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH exists and points to a file.",
    "Private key contents will not be printed.",
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH resolves inside this repository checkout.",
    "Reviewer App .pem files and env files must stay outside the repo.",
    "Reviewer App tokens are short-lived and are not written to disk.",
  ]) {
    assert.match(routineSurface, new RegExp(escapeRegExp(expected)));
  }

  for (const forbiddenWrite of [
    "writeFileSync",
    "appendFileSync",
    "createWriteStream",
    "writeFile(",
    "appendFile(",
  ]) {
    assert.equal(
      `${sessionHelper}\n${tokenHelper}\n${withTokenHelper}`.includes(forbiddenWrite),
      false,
      `reviewer helpers must not write tokens or keys with ${forbiddenWrite}`,
    );
  }
});

test("reviewer session routine keeps manual dispatcher handoff verification and cleanup", () => {
  for (const expected of [
    "npm run reviewer:session",
    "node scripts/reviewer-session.js",
    "npm run reviewer:with-token -- <command>",
    "node scripts/reviewer-with-token.js",
    "token-scoped command examples",
    "1. Verify required reviewer environment variables",
    "2. Verify private key path",
    "3. Check existing GH_TOKEN",
    "4. Use the token-scoped Reviewer App command runner",
    "5. Run safe verification commands through the runner",
    "6. Paste the Reviewer App Dispatcher prompt manually",
    "8. Leave the parent shell clean",
    "The existing value will not be printed, cleared, persisted, or written to disk.",
    "GH_TOKEN is set only inside the child process.",
    "It does not generate or print a token, export `GH_TOKEN`, call",
    "Reviewer App Dispatcher short prompt:",
    "Do not run Dispatcher automatically.",
    "Paste the prompt into a separate Reviewer App review session.",
    "npm run reviewer:with-token -- gh api installation/repositories --jq '.repositories[].full_name'",
    "npm run reviewer:with-token -- gh api repos/urkrass/Tanchiki --jq '.full_name'",
    "npm run reviewer:with-token -- gh pr view <PR_NUMBER> --repo urkrass/Tanchiki --json number,title,state,isDraft,baseRefName,headRefName",
    "Do not use `gh api user` as proof of Reviewer App identity.",
    "Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue",
    "Then verify the normal identity before coding or human label work:",
    "gh auth status",
  ]) {
    assert.match(routineSurface, new RegExp(escapeRegExp(expected)));
  }
});

test("reviewer session routine preserves Reviewer App authority boundaries", () => {
  for (const expected of [
    "Use Reviewer App identity only for PR inspection, review comments, and review submission.",
    "7. Respect Reviewer App authority boundaries",
    "Reviewer App cannot:",
    "merge PRs",
    "apply merge:auto-eligible",
    "remove stop labels",
    "push commits or update PR branches",
    "run Coder work",
    "run Test work",
    "Do not push commits.",
    "Do not merge.",
    "Do not apply GitHub labels.",
    "Do not apply `merge:auto-eligible`.",
    "Do not remove stop labels.",
    "Do not run Coder work.",
    "Do not run Test work.",
    "Do not enable auto-merge.",
    "Do not change repository settings, branch protection, workflows, secrets, or Reviewer App permissions.",
    "It cannot remove stop labels; only a human operator may do that under the repo",
  ]) {
    assert.match(routineSurface, new RegExp(escapeRegExp(expected)));
  }

  assert.match(
    routineSurface,
    /The Reviewer App\s+must not push code,\s+merge PRs,\s+apply `merge:auto-eligible`,\s+remove stop labels/,
  );
});

test("reviewer session helper does not automate review dispatch merge or label actions", () => {
  assert.equal(
    /node:child_process/.test(sessionHelper),
    false,
    "session helper must not shell out to Dispatcher or gh commands",
  );
  assert.equal(/fetch\s*\(/.test(sessionHelper), false, "session helper must not call GitHub APIs directly");
  assert.equal(
    sessionHelper.includes("$env:GH_TOKEN ="),
    false,
    "session helper must not print parent-shell GH_TOKEN assignments",
  );

  for (const forbiddenPattern of [
    /gh\s+pr\s+merge/i,
    /gh\s+pr\s+edit\b.*--add-label/i,
    /gh\s+api\b.*\/merge\b/i,
    /gh\s+api\b.*\/labels\b/i,
    /\/issues\/[^"']+\/labels/i,
    /\/pulls\/[^"']+\/merge/i,
    /enablePullRequestAutoMerge/i,
  ]) {
    assert.equal(
      forbiddenPattern.test(`${sessionHelper}\n${tokenHelper}`),
      false,
      `reviewer helpers must not contain dangerous API/CLI action: ${forbiddenPattern}`,
    );
  }
});

test("reviewer session tests use static fixtures and contain no committed secret material", () => {
  for (const secretPattern of [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bghp_[A-Za-z0-9_]{20,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bghs_[A-Za-z0-9_]{20,}\b/,
    /\bghu_[A-Za-z0-9_]{20,}\b/,
  ]) {
    assert.equal(
      secretPattern.test(routineSurface),
      false,
      `reviewer routine surface must not contain secret pattern ${secretPattern}`,
    );
  }

  assert.equal(
    routineSurface.includes("https://api.github.com/app/installations/"),
    true,
    "only the low-level token helper should document the installation token exchange endpoint",
  );
  assert.equal(
    routineSurface.includes("/access_tokens"),
    true,
    "token helper should only exchange for short-lived installation tokens",
  );
});
