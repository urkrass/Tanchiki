export const linearAuthEnvNames = ["LINEAR_API_TOKEN", "LINEAR_API_KEY"];
export const githubAuthEnvNames = ["GH_TOKEN", "GITHUB_TOKEN"];
export const openAiAuthEnvNames = ["OPENAI_API_KEY"];
export const reviewerAppAuthEnvNames = [
  "GITHUB_REVIEWER_APP_ID",
  "GITHUB_REVIEWER_INSTALLATION_ID",
  "GITHUB_REVIEWER_PRIVATE_KEY_PATH",
];

export const secretEnvNames = [
  ...linearAuthEnvNames,
  ...githubAuthEnvNames,
  ...openAiAuthEnvNames,
  ...reviewerAppAuthEnvNames,
  "GITHUB_REVIEWER_PRIVATE_KEY",
];

export const linearAuthChannel = {
  envNames: linearAuthEnvNames,
  label: "Linear API token",
  reason: "missing-linear-auth",
};

export const githubAuthChannel = {
  envNames: githubAuthEnvNames,
  label: "GitHub token",
  reason: "missing-github-auth",
};

export const openAiAuthChannel = {
  envNames: openAiAuthEnvNames,
  label: "OpenAI API key",
  reason: "missing-openai-auth",
};

export const reviewerAppAuthChannel = {
  envNames: reviewerAppAuthEnvNames,
  label: "Reviewer App environment",
  reason: "missing-reviewer-app-auth",
};

export function readFirstEnv(env = {}, names = []) {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function getMissingAuthChannels(env = {}, channels = []) {
  return channels.filter((channel) => !readFirstEnv(env, channel.envNames));
}

export function formatAuthChannel(channel) {
  return `${channel.label} (${channel.envNames.join(" or ")})`;
}

export function formatMissingAuthChannels(channels = []) {
  return channels.map(formatAuthChannel).join("; ");
}

export function redactSecureText(value, { env = {}, extraSecrets = [] } = {}) {
  let text = String(value ?? "");
  const envNamePattern = secretEnvNames.join("|");

  text = text
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      "[redacted-private-key]",
    )
    .replace(
      new RegExp(`(\\$env:(?:${envNamePattern})\\s*=\\s*)([^\\r\\n]+)`, "gi"),
      "$1[redacted]",
    )
    .replace(
      new RegExp(`\\b(${envNamePattern})\\s*=\\s*([^\\s;]+)`, "gi"),
      "$1=[redacted]",
    )
    .replace(
      new RegExp(`(["'](?:${envNamePattern})["']\\s*:\\s*["'])([^"']+)(["'])`, "gi"),
      "$1[redacted]$3",
    )
    .replace(
      /(["']?[Aa]uthorization["']?\s*:\s*["']?)(?:Bearer\s+)?[^"',\s}]+(["']?)/g,
      "$1[redacted]$2",
    )
    .replace(
      /\b[Aa]uthorization\s*=\s*(?:Bearer\s+)?[^\s,;]+/g,
      "Authorization=[redacted]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/\bsk-proj-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/\bsecret-(?:gh|github|linear|openai|reviewer|app|token)[A-Za-z0-9_-]*/gi, "[redacted]");

  const exactSecrets = [
    ...extraSecrets,
    ...secretEnvNames.map((name) => env[name]),
  ]
    .filter((secret) => typeof secret === "string" && secret.length >= 4)
    .sort((a, b) => b.length - a.length);

  for (const secret of exactSecrets) {
    text = text.replace(new RegExp(escapeRegExp(secret), "g"), "[redacted]");
  }

  return text;
}

export function sanitizeSecureError(error, options = {}) {
  return redactSecureText(error?.message || String(error), options);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
