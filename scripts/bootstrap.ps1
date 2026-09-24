param([Parameter(Mandatory=$true)][string]$Destination,[Parameter(Mandatory=$true)][string]$Title)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $target){if(Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1){throw 'Destination must be empty; inspect existing projects before reusing.'}}
$template=Join-Path (Split-Path $PSScriptRoot -Parent) 'assets/template'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Get-ChildItem -LiteralPath $template -Force | Copy-Item -Destination $target -Recurse
foreach($dir in @('public','sources','output','output/qa','.cache')){New-Item -ItemType Directory -Force -Path (Join-Path $target $dir) | Out-Null}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cleanup-qa.ps1') -Destination (Join-Path $target 'scripts/cleanup-qa.ps1')
@{title=$Title;subtitle='钢琴乐句';tagline='';label='PIANO SCORE';bpm=84;fifths=0;beats=4;beatType=4;composer='';source='';upper=@();lower=@()} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $target 'score-input.json') -Encoding utf8
'[]' | Set-Content -LiteralPath (Join-Path $target '.qa-images.json') -Encoding utf8
Write-Output "Created: $target. Add verified notation to score-input.json before preparing. No song notes were prefilled."
