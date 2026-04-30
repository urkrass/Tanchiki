import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  readReviewerAppEnvironment,
  validatePrivateKeyPath,
} from "./reviewer-app-token.js";

const activeProject = "Tanchiki — Playable Tank RPG Prototype";
const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const dispatcherPromptPath = resolve(
  repoRoot,
  "prompts",
  "short",
  "reviewer-app-dispatcher.md",
);

main().catch((error) => {
  console.error(`Reviewer App session helper failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  console.log("Reviewer App session helper");
  console.log("Prepares Reviewer App review commands and prompts only.");
  console.log("It does not call Dispatcher, run gh verification, push, label, or merge.");
  console.log("It does not print tokens or export GH_TOKEN into this shell.");
  console.log("");

  printStep("1. Verify required reviewer environment variables");
  const context = readReviewerAppEnvironment(process.env);
  console.log("- GITHUB_REVIEWER_APP_ID is set.");
  console.log("- GITHUB_REVIEWER_INSTALLATION_ID is set.");
  console.log("- GITHUB_REVIEWER_PRIVATE_KEY_PATH is set.");
  console.log("");

  printStep("2. Verify private key path");
  validatePrivateKeyPath(context.privateKeyPath);
  console.log("- GITHUB_REVIEWER_PRIVATE_KEY_PATH exists and points to a file.");
  console.log("- Private key contents will not be printed.");
  assertPrivateKeyIsOutsideRepo(context.privateKeyPath);
  console.log("- Private key path resolves outside this repository checkout.");
  console.log("");

  printGhTokenStatus(context.currentGhToken);
  console.log("");

  printTokenScopedRunnerCommands();
  printVerificationCommands();
  printReviewerDispatcherPrompt();
  printForbiddenActions();
  printCleanupCommands();
}

function printStep(title) {
  console.log(title);
}

function printGhTokenStatus(currentGhToken) {
  printStep("3. Check existing GH_TOKEN");
  if (!currentGhToken) {
    console.log("- GH_TOKEN is not currently set in this shell.");
    console.log("- The token-scoped runner will not persist tokens or change shell state automatically.");
    return;
  }

  console.log("- Existing GH_TOKEN detected.");
  console.log("- The existing value will not be printed, cleared, persisted, or written to disk.");
  console.log("- The token-scoped runner will override it only inside the child process.");
  console.log("- Clear the parent-shell GH_TOKEN before coding or human merge-label work.");
}

function printTokenScopedRunnerCommands() {
  printStep("4. Use the token-scoped Reviewer App command runner");
  console.log("Run Reviewer App gh commands through:");
  console.log("npm run reviewer:with-token -- <command>");
  console.log("");
  console.log("Examples:");
  console.log("npm run reviewer:with-token -- gh auth status");
  console.log(
    "npm run reviewer:with-token -- gh api installation/repositories --jq '.repositories[].full_name'",
  );
  console.log("npm run reviewer:with-token -- gh pr view <PR_NUMBER> --repo urkrass/Tanchiki");
  console.log(
    "npm run reviewer:review-pr -- --pr <PR_NUMBER> --issue <MAR-ID> --decision comment --body 'HUMAN REVIEW REQUIRED: ...'",
  );
  console.log("");
  console.log("The runner generates a short-lived Reviewer App installation token per child command.");
  console.log("The review executor generates its own short-lived token for one constructed PR review.");
  console.log("GH_TOKEN is set only inside the child process.");
  console.log("The token is not printed, exported to this shell, or written to disk.");
  console.log("Use it only for Reviewer-agent PR inspection, review comments, and review submission.");
  console.log("");
}

function assertPrivateKeyIsOutsideRepo(privateKeyPath) {
  const resolvedPrivateKeyPath = resolve(privateKeyPath);
  if (!isPathInside(resolvedPrivateKeyPath, repoRoot)) {
    return;
  }

  throw new Error(
    "GITHUB_REVIEWER_PRIVATE_KEY_PATH resolves inside this repository checkout. Reviewer App .pem files and env files must stay outside the repo.",
  );
}

function printVerificationCommands() {
  printStep("5. Run safe verification commands through the runner");
  console.log("Run these before Reviewer-agent GitHub operations:");
  console.log(
    "npm run reviewer:with-token -- gh api installation/repositories --jq '.repositories[].full_name'",
  );
  console.log("npm run reviewer:with-token -- gh api repos/urkrass/Tanchiki --jq '.full_name'");
  console.log(
    "npm run reviewer:with-token -- gh pr view <PR_NUMBER> --repo urkrass/Tanchiki --json number,title,state,isDraft,baseRefName,headRefName",
  );
  console.log("");
  console.log("Do not use `gh api user` as proof of Reviewer App identity.");
  console.log("");
}

function printReviewerDispatcherPrompt() {
  printStep("6. Paste the Reviewer App Dispatcher prompt manually");
  console.log("Reviewer App Dispatcher short prompt:");
  console.log("");
  console.log(readReviewerDispatcherPrompt());
  console.log("");
  console.log("Do not run Dispatcher automatically.");
  console.log("Paste the prompt into a separate Reviewer App review session.");
  console.log("");
}

function readReviewerDispatcherPrompt() {
  const prompt = readFileSync(dispatcherPromptPath, "utf8");
  return prompt.replace("<Tanchiki project name>", activeProject).trimEnd();
}

function printForbiddenActions() {
  printStep("7. Respect Reviewer App authority boundaries");
  console.log("Reviewer App cannot:");
  console.log("- merge PRs");
  console.log("- apply merge:auto-eligible");
  console.log("- remove stop labels");
  console.log("- push commits or update PR branches");
  console.log("- run Coder work");
  console.log("- run Test work");
  console.log("- enable auto-merge");
  console.log("- apply GitHub labels");
  console.log("- change workflows, repo settings, branch protection, secrets, or Reviewer App permissions");
  console.log("");
}

function printCleanupCommands() {
  printStep("8. Leave the parent shell clean");
  console.log("The token-scoped runner does not set GH_TOKEN in this shell.");
  console.log("If GH_TOKEN was set manually or by an older helper flow, clear it:");
  console.log("Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue");
  console.log("Then verify the normal identity before coding or human label work:");
  console.log("gh auth status");
  console.log("");
  console.log("Reviewer App tokens are short-lived and are not written to disk.");
}

function isPathInside(childPath, parentPath) {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
}
