param(
  [Parameter(Mandatory=$true)][string]$ProjectRoot,
  [Parameter(Mandatory=$true)][string]$Video,
  [Parameter(Mandatory=$true)][string]$SourceArchive,
  [switch]$WhatIf
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ProjectRoot).Path).TrimEnd('\','/')
if((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Project root is a reparse point.'}
$prefix=$root+[IO.Path]::DirectorySeparatorChar
function Resolve-InProject([string]$Relative){
  if([IO.Path]::IsPathRooted($Relative)){throw "Expected relative path: $Relative"}
  $full=[IO.Path]::GetFullPath((Join-Path $root $Relative))
  if(-not $full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw "Path escapes project: $Relative"}
  $parent=$full
  while($parent -and $parent -ne $root){
    if((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw "Reparse point: $parent"}
    $parent=Split-Path -Parent $parent
  }
  return $full
}
foreach($delivery in @($Video,$SourceArchive)){
  $p=Resolve-InProject $delivery
  if(-not (Test-Path -LiteralPath $p -PathType Leaf) -or (Get-Item -LiteralPath $p).Length -eq 0){throw "Missing delivery: $delivery"}
}
if([IO.Path]::GetExtension($Video) -ne '.mp4' -or [IO.Path]::GetExtension($SourceArchive) -ne '.zip'){throw 'Expected final MP4 and source ZIP.'}
foreach($report in @('verification.json','encoded-verification.json')){
  $r=Get-Content -Raw -LiteralPath (Join-Path $root $report) | ConvertFrom-Json
  if($r.passed -ne $true){throw "Verification has not passed: $report"}
}
$manifest=Join-Path $root '.qa-images.json'
if(-not (Test-Path -LiteralPath $manifest)){throw 'No explicit QA image manifest.'}
$entries=@(Get-Content -Raw -LiteralPath $manifest | ConvertFrom-Json)
$targets=@()
foreach($entry in $entries){
  if($entry -isnot [string]){throw 'QA manifest must contain relative path strings.'}
  $p=Resolve-InProject $entry
  $rel=[IO.Path]::GetRelativePath($root,$p).Replace('\','/')
  if($rel -notmatch '^output/' -and $rel -notmatch '^\.cache/qa/'){throw "Not a QA output path: $entry"}
  if([IO.Path]::GetExtension($p).ToLowerInvariant() -notin @('.png','.jpg','.jpeg','.webp','.bmp')){throw "Not an image: $entry"}
  if(Test-Path -LiteralPath $p){if(-not (Test-Path -LiteralPath $p -PathType Leaf)){throw "Not a file: $entry"};$targets+=$p}
}
# Every final absolute target has been checked before the first removal.
foreach($target in ($targets | Select-Object -Unique)){
  if($WhatIf){Write-Output "Would remove: $target"}else{Remove-Item -LiteralPath $target;Write-Output "Removed: $target"}
}
if(-not $WhatIf){@{removed=@($targets);video=$Video;sourceArchive=$SourceArchive;time=(Get-Date).ToString('o')} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'qa-cleanup.json') -Encoding utf8}
