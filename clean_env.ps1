$ErrorActionPreference = 'Stop'

$SensitiveKey = if ($env:SENSITIVE_ENV_KEY) { $env:SENSITIVE_ENV_KEY } else { 'DISCORD_CLIENT_ID' }
$SensitiveValue = $env:SENSITIVE_ENV_VALUE
$RepoRoot = (git rev-parse --show-toplevel).Trim()
$HelperScript = Join-Path $RepoRoot 'scripts/remove-discord-env-line.mjs'
$BackupName = 'env-cleanup-' + (Get-Date -Format 'yyyyMMddHHmmss')

Set-Location $RepoRoot

if (-not $SensitiveValue) {
  Write-Error "Set SENSITIVE_ENV_VALUE before running this script."
}

$Status = git status --short
if ($Status) {
  Write-Error "Working tree is not clean. Commit or stash changes before rewriting history."
}

Write-Host "Creating local safety refs..."
git branch "backup/$BackupName" HEAD | Out-Null
git tag "backup-$BackupName" HEAD | Out-Null

Write-Host "Removing current $SensitiveKey from local env files..."
node $HelperScript $RepoRoot
$TrackedEnvFiles = @(git ls-files '.env' '.env.*')
if ($TrackedEnvFiles.Count -gt 0) {
  git add -u -- $TrackedEnvFiles
}

if (git diff --cached --quiet) {
  Write-Host "No current env changes were needed."
} else {
  git commit -m "Remove Discord client id from env files"
}

Write-Host "Rewriting history to remove $SensitiveKey from env files..."
$FilterRepo = Get-Command git-filter-repo -ErrorAction SilentlyContinue

if ($FilterRepo) {
  $Callback = @"
import os
import re
key = os.environ.get('SENSITIVE_ENV_KEY', 'DISCORD_CLIENT_ID').encode()
value = os.environ.get('SENSITIVE_ENV_VALUE', '').encode()
pattern = re.compile(rb'(?m)^\s*' + re.escape(key) + rb'=.*(?:\r?\n)?')
if filename == b'.env' or (filename.startswith(b'.env.') and filename != b'.env.example'):
    data = pattern.sub(b'', data)
elif value:
    data = data.replace(value, b'[removed-discord-client-id]')
"@
  $CallbackFile = Join-Path $env:TEMP "elevate-env-cleanup-$BackupName.py"
  Set-Content -LiteralPath $CallbackFile -Value $Callback -Encoding UTF8
  git filter-repo --force --blob-callback $CallbackFile
  Remove-Item -LiteralPath $CallbackFile -Force
} else {
  $HelperScriptForGit = $HelperScript.Replace('\', '/')
  $TreeFilter = "node '$HelperScriptForGit' ."
  $env:FILTER_BRANCH_SQUELCH_WARNING = '1'
  git filter-branch --force --tree-filter $TreeFilter --prune-empty --tag-name-filter cat -- --all
}

Write-Host "Cleaning rewrite leftovers..."
if (Test-Path '.git/refs/original') {
  Remove-Item -LiteralPath '.git/refs/original' -Recurse -Force
}
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "Validating cleanup..."
$TrackedEnvFiles = @(git ls-files '.env' '.env.*')
$Remaining = if ($TrackedEnvFiles.Count -gt 0) {
  git grep -n -e $SensitiveKey -- $TrackedEnvFiles 2>$null
}
if ($Remaining) {
  Write-Error "Sensitive key still exists in tracked env files:`n$Remaining"
}

Write-Host "====================================="
Write-Host "Local env cleanup completed."
Write-Host "Safety refs: backup/$BackupName and backup-$BackupName"
Write-Host "Review with: git log --all -S `"$SensitiveKey`" -- .env .env.*"
Write-Host "Then update remote with: git push --force --all; git push --force --tags"
Write-Host "====================================="
