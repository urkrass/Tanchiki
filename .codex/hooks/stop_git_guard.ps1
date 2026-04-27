$ErrorActionPreference = "Stop"

$rawInput = [Console]::In.ReadToEnd()
$payload = $null

if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
  try {
    $payload = $rawInput | ConvertFrom-Json
  } catch {
    $payload = $null
  }
}

$stopHookActive = $false
if ($payload -and $payload.PSObject.Properties.Name -contains "stop_hook_active") {
  $stopHookActive = [bool]$payload.stop_hook_active
}

$repoRoot = $null
try {
  $repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
} catch {
  $repoRoot = $null
}

if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  @{ decision = "allow" } | ConvertTo-Json -Compress
  exit 0
}

$status = (& git -C $repoRoot status --porcelain 2>$null)
if ([string]::IsNullOrWhiteSpace(($status -join ""))) {
  @{ decision = "allow" } | ConvertTo-Json -Compress
  exit 0
}

if ($stopHookActive) {
  $warning = "Git discipline guard warning: the worktree is still dirty, but stop_hook_active is true, so stop is allowed to avoid a hook loop."
  Write-Warning $warning
  @{
    decision = "allow"
    reason = $warning
  } | ConvertTo-Json -Compress
  exit 0
}

@{
  decision = "block"
  reason = "Git discipline guard: the worktree is dirty. Run npm test, npm run build, npm run lint. If they pass, git add -A and commit with a meaningful message. Then run git status and stop only when clean."
} | ConvertTo-Json -Compress
