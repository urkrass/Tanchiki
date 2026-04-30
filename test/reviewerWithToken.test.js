import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createChildEnvironment,
  getCommandRefusalReason,
} from "../scripts/reviewer-with-token.js";

test("reviewer token-scoped runner refuses missing and non-gh child commands", () => {
  assert.match(getCommandRefusalReason([]), /No child command provided/);
  assert.match(
    getCommandRefusalReason(["node", "script.js"]),
    /only direct gh commands are allowed/,
  );
});

test("reviewer token-scoped runner allows focused review and inspection gh commands", () => {
  const allowedCommands = [
    ["gh", "auth", "status"],
    ["gh", "api", "installation/repositories"],
    ["gh", "api", "installation/repositories", "--jq", ".repositories[].full_name"],
    ["gh", "api", "--method", "GET", "repos/urkrass/Tanchiki"],
    ["gh", "pr", "view", "123"],
    ["gh", "pr", "diff", "123"],
    ["gh", "pr", "checks", "123"],
    ["gh", "pr", "review", "123", "--comment", "--body", "Reviewer App smoke test"],
    ["gh", "pr", "review", "123", "--approve", "--body", "Policy allows approval"],
    ["gh", "pr", "comment", "123", "--body", "Reviewer App comment"],
    ["gh", "issue", "view", "123"],
  ];

  for (const command of allowedCommands) {
    assert.equal(getCommandRefusalReason(command), null, command.join(" "));
  }
});

test("reviewer token-scoped runner refuses forbidden command patterns", () => {
  const forbiddenCommands = [
    ["gh", "pr", "merge", "123"],
    ["gh", "pr", "edit", "123"],
    ["gh", "issue", "edit", "123"],
    ["gh", "label", "create", "merge:auto-eligible"],
    ["git", "push"],
    ["git", "commit", "-m", "x"],
    ["git", "tag", "v1"],
    ["git", "reset", "--hard"],
    ["gh", "pr", "review", "123", "--comment", "--body", "apply merge:auto-eligible"],
  ];

  for (const command of forbiddenCommands) {
    assert.notEqual(getCommandRefusalReason(command), null, command.join(" "));
  }
});

test("reviewer token-scoped runner refuses gh api write-shaped commands", () => {
  const forbiddenApiCommands = [
    ["gh", "api", "--method", "POST", "repos/urkrass/Tanchiki/issues/1/comments"],
    ["gh", "api", "-X", "PATCH", "repos/urkrass/Tanchiki/pulls/1"],
    ["gh", "api", "repos/urkrass/Tanchiki/issues/1/labels"],
    ["gh", "api", "repos/urkrass/Tanchiki/pulls/1/merge"],
    ["gh", "api", "graphql", "-f", "query=mutation { x }"],
    ["gh", "api", "repos/urkrass/Tanchiki/issues/1", "--field", "title=x"],
  ];

  for (const command of forbiddenApiCommands) {
    assert.notEqual(getCommandRefusalReason(command), null, command.join(" "));
  }
});

test("reviewer token-scoped runner scopes GH_TOKEN to child env and scrubs app key env", () => {
  const parentEnv = {
    Path: "C:\\Windows\\System32",
    GH_TOKEN: "normal-user-token",
    GITHUB_REVIEWER_APP_ID: "1",
    github_reviewer_installation_id: "2",
    GITHUB_REVIEWER_PRIVATE_KEY_PATH: "C:\\Users\\Legion\\.config\\key.pem",
  };

  const childEnv = createChildEnvironment(parentEnv, "reviewer-app-token");

  assert.equal(parentEnv.GH_TOKEN, "normal-user-token");
  assert.equal(parentEnv.GITHUB_REVIEWER_APP_ID, "1");
  assert.equal(childEnv.GH_TOKEN, "reviewer-app-token");
  assert.equal(childEnv.Path, parentEnv.Path);
  assert.equal("GITHUB_REVIEWER_APP_ID" in childEnv, false);
  assert.equal("github_reviewer_installation_id" in childEnv, false);
  assert.equal("GITHUB_REVIEWER_PRIVATE_KEY_PATH" in childEnv, false);
});
