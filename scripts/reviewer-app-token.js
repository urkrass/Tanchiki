import { createSign } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error(`Reviewer App token helper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export async function main({ env = process.env, fetchImpl = fetch } = {}) {
  const context = readReviewerAppEnvironment(env);
  validatePrivateKeyPath(context.privateKeyPath);
  console.log("Reviewer App environment check passed.");
  console.log("Private key path exists; private key contents will not be printed.");
  if (context.currentGhToken) {
    console.log("");
    console.log(
      "Existing GH_TOKEN detected. It will not be read, replaced on disk, or cleared automatically.",
    );
    console.log(
      "The token-scoped runner will override GH_TOKEN only inside the child process.",
    );
  }

  const token = await createReviewerAppInstallationToken(context, { fetchImpl });

  console.log("Tanchiki Reviewer GitHub App installation token created.");
  if (token.expires_at) {
    console.log(`Expires at: ${token.expires_at}`);
  }
  console.log("The token was not printed, exported, or written to disk.");
  printReviewerSafetyInstructions();
}

export function readReviewerAppEnvironment(env = process.env) {
  const appId = env.GITHUB_REVIEWER_APP_ID;
  const installationId = env.GITHUB_REVIEWER_INSTALLATION_ID;
  const privateKeyPath = env.GITHUB_REVIEWER_PRIVATE_KEY_PATH;
  const currentGhToken = env.GH_TOKEN;

  requireEnv("GITHUB_REVIEWER_APP_ID", appId);
  requireEnv("GITHUB_REVIEWER_INSTALLATION_ID", installationId);
  requireEnv("GITHUB_REVIEWER_PRIVATE_KEY_PATH", privateKeyPath);

  return {
    appId,
    installationId,
    privateKeyPath,
    currentGhToken,
  };
}

export function validatePrivateKeyPath(privateKeyPath) {
  if (!existsSync(privateKeyPath)) {
    throw new Error(
      "GITHUB_REVIEWER_PRIVATE_KEY_PATH does not point to an existing file.",
    );
  }
  if (!statSync(privateKeyPath).isFile()) {
    throw new Error("GITHUB_REVIEWER_PRIVATE_KEY_PATH must point to a file.");
  }
}

export async function createReviewerAppInstallationToken(
  context = readReviewerAppEnvironment(),
  { fetchImpl = fetch } = {},
) {
  validatePrivateKeyPath(context.privateKeyPath);
  const privateKey = readFileSync(context.privateKeyPath, "utf8");
  const jwt = createGitHubAppJwt(context.appId, privateKey);
  return createInstallationToken(jwt, context.installationId, fetchImpl);
}

export function printReviewerSafetyInstructions() {
  console.log("Run Reviewer App gh commands through the token-scoped runner:");
  console.log("npm run reviewer:with-token -- <command>");
  console.log("");
  console.log("Verify Reviewer App installation access before reviewer work:");
  console.log(
    "npm run reviewer:with-token -- gh api installation/repositories --jq '.repositories[].full_name'",
  );
  console.log("Expected repository access includes: urkrass/Tanchiki");
  console.log("");
  console.log("Record the verified Reviewer App identity/access in review notes.");
  console.log("");
  console.log(
    "Identity warning: this GH_TOKEN is a GitHub App installation token, not a normal user token.",
  );
  console.log(
    "Use it only through the token-scoped runner for Reviewer-agent PR inspection, comments, and reviews as Tanchiki Reviewer.",
  );
  console.log(
    "Do not export this Reviewer App GH_TOKEN into Coder sessions or human merge-label sessions.",
  );
  console.log(
    "Coder sessions and human merge-label sessions must use the normal GitHub identity.",
  );
  console.log("");
  console.log("Forbidden with this Reviewer App token:");
  console.log("- pushing code or updating PR branches");
  console.log("- merging PRs");
  console.log("- applying merge:auto-eligible");
  console.log("- removing stop labels");
  console.log("- enabling auto-merge");
  console.log("- changing workflows, repo settings, branch protection, or secrets");
  console.log("");
  console.log("The token-scoped runner does not set GH_TOKEN in the parent shell.");
  console.log("If GH_TOKEN was set manually or by an older flow, clear it before coding or human label work:");
  console.log("Remove-Item Env:\\GH_TOKEN -ErrorAction SilentlyContinue");
  console.log("Then verify the normal identity:");
  console.log("gh auth status");
  console.log("");
  console.log("Reviewer App tokens are short-lived and must not be written to disk.");
}

export function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
}

export function createGitHubAppJwt(issuer, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: issuer,
  };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedToken)
    .end()
    .sign(privateKey, "base64url");

  return `${unsignedToken}.${signature}`;
}

export async function createInstallationToken(jwt, id, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${id}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "tanchiki-reviewer-app-token-helper",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub token exchange failed with ${response.status}: ${body}`,
    );
  }

  const token = await response.json();
  if (!token.token) {
    throw new Error("GitHub token exchange response did not include a token.");
  }

  return token;
}

export function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function formatPowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function isDirectRun(importMetaUrl) {
  return (
    process.argv[1] &&
    resolve(fileURLToPath(importMetaUrl)) === resolve(process.argv[1])
  );
}
