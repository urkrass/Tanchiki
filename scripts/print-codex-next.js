import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const promptPath = join(root, "prompts", "codex-next.md");

console.log(readFileSync(promptPath, "utf8"));
