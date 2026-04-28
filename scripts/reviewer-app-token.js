import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const appId = process.env.GITHUB_REVIEWER_APP_ID;
const installationId = process.env.GITHUB_REVIEWER_INSTALLATION_ID;
const privateKeyPath = process.env.GITHUB_REVIEWER_PRIVATE_KEY_PATH;

main().catch((error) => {
  console.error(`Reviewer App token helper failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  requireEnv("GITHUB_REVIEWER_APP_ID", appId);
  requireEnv("GITHUB_REVIEWER_INSTALLATION_ID", installationId);
  requireEnv("GITHUB_REVIEWER_PRIVATE_KEY_PATH", privateKeyPath);

  if (!existsSync(privateKeyPath)) {
    throw new Error(
      "GITHUB_REVIEWER_PRIVATE_KEY_PATH does not point to an existing file.",
    );
  }

  const privateKey = readFileSync(privateKeyPath, "utf8");
  const jwt = createGitHubAppJwt(appId, privateKey);
  const token = await createInstallationToken(jwt, installationId);

  console.log("Tanchiki Reviewer GitHub App installation token created.");
  if (token.expires_at) {
    console.log(`Expires at: ${token.expires_at}`);
  }
  console.log("Run this in the current PowerShell session:");
  console.log(`$env:GH_TOKEN = ${formatPowerShellString(token.token)}`);
  console.log("");
  console.log("This token is short-lived and was not written to disk.");
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
}

function createGitHubAppJwt(issuer, privateKey) {
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

async function createInstallationToken(jwt, id) {
  const response = await fetch(
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

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function formatPowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
