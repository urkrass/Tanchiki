$ErrorActionPreference = "Stop"

$null = [Console]::In.ReadToEnd()

$context = @"
Tanchiki Git discipline is active:
- Inspect git status before editing files.
- If the tree is dirty before starting, create a checkpoint commit or explain why not.
- After changes, run npm test, npm run build, and npm run lint.
- If validation passes, git add -A and commit with a meaningful message.
- Include the Linear issue ID in the commit message when available.
- Never run git push automatically.
"@

@{
  additionalContext = $context
} | ConvertTo-Json -Compress
