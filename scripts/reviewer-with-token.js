import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReviewerAppInstallationToken,
  readReviewerAppEnvironment,
  validatePrivateKeyPath,
} from "./reviewer-app-token.js";

const reviewerAppEnvNames = [
  "GITHUB_REVIEWER_APP_ID",
  "GITHUB_REVIEWER_INSTALLATION_ID",
  "GITHUB_REVIEWER_PRIVATE_KEY",
  "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
];

if (isDirectRun(import.meta.url)) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(`Reviewer App token-scoped runner failed: ${error.message}`);
      process.exitCode = 1;
    },
  );
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  spawnImpl = spawn,
  stdout = console.log,
} = {}) {
  const refusal = getCommandRefusalReason(argv);
  if (refusal) {
    throw new Error(refusal);
  }

  stdout("Reviewer App token-scoped runner");
  stdout(
    "Allowed use: Reviewer-agent PR inspection, review comments, and review submission only.",
  );
  stdout(
    "GH_TOKEN will be set only in the child process; it will not be exported to this shell.",
  );
  stdout("The token and private key will not be printed or written to disk.");

  const context = readReviewerAppEnvironment(env);
  validatePrivateKeyPath(context.privateKeyPath);
  const token = await createReviewerAppInstallationToken(context, { fetchImpl });

  if (token.expires_at) {
    stdout(`Reviewer App token expires at: ${token.expires_at}`);
  }

  return runChildCommand(argv, {
    env: createChildEnvironment(env, token.token),
    spawnImpl,
  });
}

export function getCommandRefusalReason(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return [
      "No child command provided.",
      "Use: npm run reviewer:with-token -- gh pr view <number>",
    ].join(" ");
  }

  if (argv.some((arg) => String(arg).toLowerCase().includes("merge:auto-eligible"))) {
    return "Refusing command: Reviewer App must not apply or mention merge:auto-eligible.";
  }

  const [command, ...args] = argv.map((arg) => String(arg));
  const normalizedCommand = command.toLowerCase();
  const normalizedArgs = args.map((arg) => arg.toLowerCase());

  if (normalizedCommand === "git") {
    return getForbiddenGitReason(normalizedArgs) || onlyGhReason();
  }

  if (normalizedCommand !== "gh") {
    return onlyGhReason();
  }

  const forbiddenGhReason = getForbiddenGhReason(normalizedArgs);
  if (forbiddenGhReason) {
    return forbiddenGhReason;
  }

  return getAllowedGhRefusalReason(normalizedArgs);
}

export function createChildEnvironment(parentEnv, token) {
  const childEnv = { ...parentEnv };

  for (const name of reviewerAppEnvNames) {
    deleteEnvCaseInsensitive(childEnv, name);
  }

  setEnvCaseInsensitive(childEnv, "GH_TOKEN", token);
  return childEnv;
}

export function runChildCommand(argv, { env, spawnImpl = spawn } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(argv[0], argv.slice(1), {
      env,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code !== null) {
        resolvePromise(code);
        return;
      }

      console.error(`Reviewer App child command ended from signal ${signal}.`);
      resolvePromise(1);
    });
  });
}

function getForbiddenGitReason(normalizedArgs) {
  const subcommand = normalizedArgs[0];
  if (["push", "commit", "tag", "reset"].includes(subcommand)) {
    return `Refusing forbidden command pattern: git ${subcommand}.`;
  }
  return null;
}

function getForbiddenGhReason(normalizedArgs) {
  const [group, subcommand] = normalizedArgs;
  if (group === "pr" && subcommand === "merge") {
    return "Refusing forbidden command pattern: gh pr merge.";
  }
  if (group === "pr" && subcommand === "edit") {
    return "Refusing forbidden command pattern: gh pr edit.";
  }
  if (group === "issue" && subcommand === "edit") {
    return "Refusing forbidden command pattern: gh issue edit.";
  }
  if (group === "label") {
    return "Refusing forbidden command pattern: gh label.";
  }
  return null;
}

function getAllowedGhRefusalReason(normalizedArgs) {
  const [group, subcommand] = normalizedArgs;

  if (group === "auth" && subcommand === "status") {
    return null;
  }

  if (group === "api") {
    return getGhApiRefusalReason(normalizedArgs.slice(1));
  }

  if (group === "pr") {
    if (["checks", "comment", "diff", "list", "review", "status", "view"].includes(subcommand)) {
      return null;
    }
  }

  if (group === "issue") {
    if (["comment", "list", "view"].includes(subcommand)) {
      return null;
    }
  }

  return [
    "Refusing command: this runner is limited to Reviewer App review/comment/inspection gh commands.",
    "Allowed examples include gh auth status, gh api installation/repositories, gh pr view, gh pr diff, gh pr checks, and gh pr review.",
  ].join(" ");
}

function getGhApiRefusalReason(args) {
  if (args.includes("graphql")) {
    return "Refusing gh api graphql through the Reviewer App runner; use narrow REST inspection commands only.";
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--field", "-f", "--raw-field", "-F", "--input"].includes(arg)) {
      return `Refusing gh api ${arg}: field and input flags can create write requests.`;
    }

    if (arg.startsWith("--field=") || arg.startsWith("--raw-field=")) {
      return "Refusing gh api field flags because they can create write requests.";
    }

    if (arg === "--method" || arg === "-x") {
      const method = args[index + 1];
      if (!method || method.toLowerCase() !== "get") {
        return "Refusing gh api non-GET method through the Reviewer App runner.";
      }
    }

    if (arg.startsWith("--method=") && arg.slice("--method=".length).toLowerCase() !== "get") {
      return "Refusing gh api non-GET method through the Reviewer App runner.";
    }

    if (["-xpost", "-xpatch", "-xput", "-xdelete"].includes(arg)) {
      return "Refusing gh api non-GET method through the Reviewer App runner.";
    }
  }

  const joined = args.join(" ");
  for (const forbiddenFragment of ["/merge", "/labels", "auto-merge"]) {
    if (joined.includes(forbiddenFragment)) {
      return `Refusing gh api path or argument containing ${forbiddenFragment}.`;
    }
  }

  return null;
}

function deleteEnvCaseInsensitive(env, name) {
  const normalizedName = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === normalizedName) {
      delete env[key];
    }
  }
}

function setEnvCaseInsensitive(env, name, value) {
  deleteEnvCaseInsensitive(env, name);
  env[name] = value;
}

function onlyGhReason() {
  return "Refusing command: only direct gh commands are allowed by the Reviewer App token-scoped runner.";
}

function isDirectRun(importMetaUrl) {
  return (
    process.argv[1] &&
    resolve(fileURLToPath(importMetaUrl)) === resolve(process.argv[1])
  );
}
