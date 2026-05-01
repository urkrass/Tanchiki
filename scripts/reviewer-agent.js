import { fileURLToPath } from "node:url";

import {
  EvidenceError,
  collectPrEvidence,
  defaultMaxDiffChars,
  defaultRepo,
  validateMaxDiffChars,
} from "./reviewer-evidence.js";

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const options = parseArgs(argv);
    const evidence = await collectPrEvidence({
      fetchImpl,
      issue: options.issue,
      maxDiffChars: options.maxDiffChars,
      pr: options.pr,
      repo: options.repo,
      token: readGitHubToken(env),
    });

    stdout(JSON.stringify({
      mode: "evidence-dry-run",
      dry_run: true,
      requested_model: options.model,
      openai_call_made: false,
      github_review_submitted: false,
      evidence,
    }, null, 2));
    return 0;
  } catch (error) {
    if (!(error instanceof EvidenceError)) {
      throw error;
    }

    stderr(`Reviewer Agent evidence collection refused: ${error.message}`);
    stderr("No OpenAI API call was made.");
    stderr("No GitHub review was submitted.");
    return 1;
  }
}

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    issue: null,
    maxDiffChars: defaultMaxDiffChars,
    model: null,
    pr: null,
    repo: defaultRepo,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    const key = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : arg.slice(equalsIndex + 1);

    if (!["--pr", "--issue", "--max-diff-chars", "--model", "--repo"].includes(key)) {
      throw new EvidenceError(`Unknown argument: ${arg}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined) {
      throw new EvidenceError(`${key} requires a value.`);
    }
    if (inlineValue === null) {
      index += 1;
    }

    if (key === "--pr") {
      options.pr = parsePrNumber(value);
    } else if (key === "--issue") {
      options.issue = parseIssueId(value);
    } else if (key === "--max-diff-chars") {
      options.maxDiffChars = validateMaxDiffChars(value);
    } else if (key === "--model") {
      options.model = parseModel(value);
    } else if (key === "--repo") {
      options.repo = parseRepo(value);
    }
  }

  if (options.pr === null) {
    throw new EvidenceError("--pr is required.");
  }
  if (!options.issue) {
    throw new EvidenceError("--issue is required.");
  }
  if (!options.dryRun) {
    throw new EvidenceError("MAR-312 implements evidence-only collection; pass --dry-run.");
  }

  return options;
}

export function readGitHubToken(env = process.env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(`Reviewer Agent evidence collector failed: ${error.message}`);
      process.exitCode = 1;
    },
  );
}

function parsePrNumber(value) {
  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) {
    throw new EvidenceError("--pr must be a positive integer.");
  }
  return Number.parseInt(text, 10);
}

function parseIssueId(value) {
  const text = String(value).trim();
  if (!/^MAR-\d+$/.test(text)) {
    throw new EvidenceError("--issue must match MAR-<number>.");
  }
  return text;
}

function parseModel(value) {
  const text = String(value).trim();
  if (!text) {
    throw new EvidenceError("--model must not be empty.");
  }
  return text;
}

function parseRepo(value) {
  const text = String(value).trim();
  if (text !== defaultRepo) {
    throw new EvidenceError(`--repo must be ${defaultRepo} for this campaign.`);
  }
  return text;
}
