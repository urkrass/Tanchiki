import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReviewerAppInstallationToken,
  formatPowerShellString,
  readReviewerAppEnvironment,
  validatePrivateKeyPath,
} from "./reviewer-app-token.js";

const activeProject = "Tanchiki — Playable Tank RPG Prototype";
const repositoryVerificationCommand = "gh api repos/urkrass/Tanchiki --jq '.full_name'";
const prVerificationCommand =
  "gh pr view <PR_NUMBER> --repo urkrass/Tanchiki --json number,title,state,isDraft,baseRefName,headRefName";
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
  console.log("");

  const context = readReviewerAppEnvironment(process.env);
  validatePrivateKeyPath(context.privateKeyPath);

  console.log("Environment and private key path:");
  console.log("- GITHUB_REVIEWER_APP_ID is set.");
  console.log("- GITHUB_REVIEWER_INSTALLATION_ID is set.");
  console.log("- GITHUB_REVIEWER_PRIVATE_KEY_PATH exists and points to a file.");
  console.log("- Private key contents will not be printed.");
  assertPrivateKeyIsOutsideRepo(context.privateKeyPath);
  warnIfGhTokenExists(context.currentGhToken);
  console.log("");

  const token = await createReviewerAppInstallationToken(context);

  console.log("Tanchiki Reviewer GitHub App installation token created.");
  if (token.expires_at) {
    console.log(`Expires at: ${token.expires_at}`);
  }
  console.log("");
  console.log("Set GH_TOKEN in this PowerShell session:");
  console.log(`$env:GH_TOKEN = ${formatPowerShellString(token.token)}`);
  console.log("");

  printVerificationCommands();
  printReviewerDispatcherPrompt();
  printForbiddenActions();
  printCleanupCommands();
}

function warnIfGhTokenExists(currentGhToken) {
  if (!currentGhToken) {
    return;
  }

  console.log("");
  console.log(
    "Existing GH_TOKEN detected. It will not be read, replaced on disk, or cleared automatically.",
  );
  console.log(
    "Confirm this shell is a Reviewer App session before overwriting GH_TOKEN with the app token.",
  );
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
  console.log("Safe verification commands to run manually:");
  console.log("gh api installation/repositories --jq '.repositories[].full_name'");
  console.log(repositoryVerificationCommand);
  console.log(prVerificationCommand);
  console.log("");
}

function printReviewerDispatcherPrompt() {
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
  console.log("Forbidden with this Reviewer App token:");
  console.log("- pushing code or updating PR branches");
  console.log("- running Coder work");
  console.log("- running Test work");
  console.log("- merging PRs");
  console.log("- applying merge:auto-eligible");
  console.log("- removing stop labels");
  console.log("- enabling auto-merge");
  console.log("- applying GitHub labels");
  console.log("- changing workflows, repo settings, branch protection, secrets, or Reviewer App permissions");
  console.log("");
}

function printCleanupCommands() {
  console.log("Clear GH_TOKEN after Reviewer App review work:");
  console.log("Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue");
  console.log("Then verify the normal identity before coding or human label work:");
  console.log("gh auth status");
  console.log("");
  console.log("This token is short-lived and was not written to disk.");
}

function isPathInside(childPath, parentPath) {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
}
