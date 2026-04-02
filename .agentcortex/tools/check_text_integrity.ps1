param(
    [string]$Root,
    [string]$BaselinePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-PathString {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ($Path.StartsWith('\\?\')) { return $Path.Substring(4) }
    return $Path
}

function Get-RepoRoot {
    if ($Root) {
        return Normalize-PathString ([System.IO.Path]::GetFullPath((Normalize-PathString $Root)))
    }
    $scriptDir = Normalize-PathString $PSScriptRoot
    if (-not $scriptDir) { $scriptDir = Normalize-PathString (Split-Path -Parent $PSCommandPath) }
    if (-not $scriptDir) { $scriptDir = Normalize-PathString ((Get-Location).Path) }
    return Normalize-PathString ([System.IO.Path]::GetFullPath([System.IO.Path]::Combine($scriptDir, '..')))
}

function Get-BaselinePath {
    param([string]$RepoRoot)
    if ($BaselinePath) { return Normalize-PathString ([System.IO.Path]::GetFullPath((Normalize-PathString $BaselinePath))) }
    return [System.IO.Path]::Combine($RepoRoot, 'tools', 'text_integrity_baseline.txt')
}

function Get-CandidateFiles {
    param([string]$RepoRoot)
    $commands = @(
        @('ls-files'),
        @('ls-files', '--others', '--exclude-standard')
    )
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $results = [System.Collections.Generic.List[string]]::new()
    foreach ($commandArgs in $commands) {
        $output = & git -C $RepoRoot @commandArgs
        $exitCode = if (Get-Variable LASTEXITCODE -ErrorAction SilentlyContinue) { $LASTEXITCODE } else { 0 }
        if ($exitCode -ne 0) {
            throw 'git ls-files failed while building text integrity file list.'
        }
        foreach ($line in ($output | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
            if ($seen.Add($line)) {
                $results.Add($line)
            }
        }
    }
    return $results
}

function Test-TextCandidate {
    param([string]$RelativePath)
    $ext = [System.IO.Path]::GetExtension($RelativePath).ToLowerInvariant()
    $name = [System.IO.Path]::GetFileName($RelativePath).ToLowerInvariant()
    $suffixes = @('.md', '.sh', '.ps1', '.cmd', '.bat', '.yml', '.yaml', '.txt', '.rules', '.toml', '.json', '.py', '.cff')
    $names = @('.gitignore', '.gitattributes', '.editorconfig')
    return ($suffixes -contains $ext) -or ($names -contains $name)
}

function Get-BaselineSet {
    param([string]$Path)
    $set = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    if (-not (Test-Path -Path $Path -PathType Leaf)) { return $set }
    foreach ($line in Get-Content -Path $Path -Encoding utf8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        [void]$set.Add($trimmed.Replace('\', '/'))
    }
    return $set
}

function Test-MixedLineEndings {
    param([byte[]]$Bytes)
    $hasCrLf = $false
    for ($i = 0; $i -lt ($Bytes.Length - 1); $i++) {
        if ($Bytes[$i] -eq 13 -and $Bytes[$i + 1] -eq 10) {
            $hasCrLf = $true
            break
        }
    }
    $hasBareLf = $false
    $hasBareCr = $false
    for ($i = 0; $i -lt $Bytes.Length; $i++) {
        $current = $Bytes[$i]
        $prev = if ($i -gt 0) { $Bytes[$i - 1] } else { -1 }
        $next = if ($i -lt ($Bytes.Length - 1)) { $Bytes[$i + 1] } else { -1 }
        if ($current -eq 10 -and $prev -ne 13) { $hasBareLf = $true }
        if ($current -eq 13 -and $next -ne 10) { $hasBareCr = $true }
    }
    return ($hasCrLf -and ($hasBareLf -or $hasBareCr)) -or ($hasBareLf -and $hasBareCr)
}

function Get-FileIssues {
    param([byte[]]$Bytes)
    $issues = [System.Collections.Generic.List[string]]::new()
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        $issues.Add('utf8-bom')
    }
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
        $text = $utf8.GetString($Bytes)
    } catch {
        $issues.Add('invalid-utf8')
        return $issues
    }
    if ($text.Contains([char]0)) {
        $issues.Add('null-byte')
    }
    if (Test-MixedLineEndings $Bytes) {
        $issues.Add('mixed-eol')
    }
    return $issues
}

$repoRoot = Get-RepoRoot
$baseline = Get-BaselineSet (Get-BaselinePath $repoRoot)
$baselineHits = [System.Collections.Generic.List[string]]::new()
$regressions = [System.Collections.Generic.List[string]]::new()

foreach ($relativePath in Get-CandidateFiles $repoRoot) {
    if (-not (Test-TextCandidate $relativePath)) { continue }
    $normalizedRelativePath = $relativePath.Replace('\', '/')
    $fullPath = [System.IO.Path]::Combine($repoRoot, $relativePath)
    if (-not (Test-Path -Path $fullPath -PathType Leaf)) { continue }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    } catch {
        Write-Error "unable to read text integrity candidate: ${normalizedRelativePath} ($fullPath)"
        exit 1
    }
    $issues = @(Get-FileIssues $bytes)
    if ($issues.Count -eq 0) { continue }
    $entry = "${normalizedRelativePath}: $($issues -join ', ')"
    if ($baseline.Contains($normalizedRelativePath)) {
        $baselineHits.Add($entry)
    } else {
        $regressions.Add($entry)
    }
}

if ($regressions.Count -gt 0) {
    Write-Error ('Text integrity regression(s) detected:' + [Environment]::NewLine + '  - ' + ($regressions -join ([Environment]::NewLine + '  - ')))
    exit 1
}

Write-Output "Text integrity check passed ($($baselineHits.Count) baseline exception(s) tracked)."