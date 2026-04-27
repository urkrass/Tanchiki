$ErrorActionPreference = "Stop"

$null = [Console]::In.ReadToEnd()

$context = @"
For this Tanchiki turn, preserve Git discipline:
1. Check git status before edits.
2. Keep changes scoped.
3. Run npm test, npm run build, and npm run lint after edits.
4. Commit passing changes before final response.
5. Do not push unless the user explicitly asks.
"@

@{
  additionalContext = $context
} | ConvertTo-Json -Compress
