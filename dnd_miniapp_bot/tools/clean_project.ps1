param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$Report = [Collections.Generic.List[string]]::new()
$script:ArchivedFiles=0
$script:DeletedFiles=0
$script:MovedFiles=0
$Report.Add('# Project cleanup')
$Report.Add('')

function WorkspacePath([string]$Relative) {
    $full=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (!$full.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe target: $full" }
    return $full
}
function HashStream($Stream) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($Stream)) } finally { $sha.Dispose() }
}
function ArchiveSources([string]$Name,[string[]]$Paths) {
    $files=@(foreach($relative in $Paths){
        $source=WorkspacePath $relative
        if(Test-Path -LiteralPath $source -PathType Leaf){Get-Item -LiteralPath $source}
        elseif(Test-Path -LiteralPath $source -PathType Container){Get-ChildItem -LiteralPath $source -File -Recurse -Force}
    })
    if(!$files.Count){return}
    foreach($file in $files){
        [void](WorkspacePath $file.FullName.Substring($Root.Length+1))
        if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Refusing link: $($file.FullName)"}
    }
    $target=WorkspacePath ('archive/'+$Name+'.zip')
    if(Test-Path -LiteralPath $target){throw "Archive already exists: $target"}
    $Report.Add("- Archive $($files.Count) files into archive/$Name.zip")
    if(!$Apply){return}
    [IO.Directory]::CreateDirectory((Split-Path -Parent $target))|Out-Null
    Add-Type -AssemblyName System.IO.Compression
    $zip=[IO.Compression.ZipArchive]::new([IO.File]::Create($target),[IO.Compression.ZipArchiveMode]::Create)
    $hashes=@{}
    try {
        foreach($file in $files){
            $relative=$file.FullName.Substring($Root.Length+1).Replace([IO.Path]::DirectorySeparatorChar,'/')
            $source=[IO.File]::OpenRead($file.FullName)
            try {
                $hashes[$relative]=HashStream $source
                $source.Position=0
                $entry=$zip.CreateEntry($relative,[IO.Compression.CompressionLevel]::Optimal)
                $destination=$entry.Open()
                try{$source.CopyTo($destination)}finally{$destination.Dispose()}
            }finally{$source.Dispose()}
        }
    }finally{$zip.Dispose()}
    $zip=[IO.Compression.ZipArchive]::new([IO.File]::OpenRead($target),[IO.Compression.ZipArchiveMode]::Read)
    try {
        if($zip.Entries.Count -ne $files.Count){throw 'Archive entry count mismatch'}
        foreach($entry in $zip.Entries){
            $stream=$entry.Open()
            try{if((HashStream $stream) -ne $hashes[$entry.FullName]){throw "Archive hash mismatch: $($entry.FullName)"}}finally{$stream.Dispose()}
        }
    }finally{$zip.Dispose()}
    # Delete only after every archive entry has been read back and SHA-256 verified.
    foreach($file in $files){Remove-Item -LiteralPath (WorkspacePath $file.FullName.Substring($Root.Length+1)) -Force}
    $script:ArchivedFiles+=$files.Count
    foreach($relative in $Paths){
        $source=WorkspacePath $relative
        if(Test-Path -LiteralPath $source -PathType Container){
            if(@(Get-ChildItem -LiteralPath $source -Recurse -File -Force).Count -eq 0){Remove-Item -LiteralPath $source -Recurse -Force}
        }
    }
}
function MoveSource([string]$From,[string]$To) {
    $source=WorkspacePath $From;$target=WorkspacePath $To
    if(!(Test-Path -LiteralPath $source)){return}
    if(Test-Path -LiteralPath $target){
        if($From -eq 'README.md' -and $To -eq 'docs/history/project-notes.md'){return}
        throw "Move destination exists: $target"
    }
    $count=if(Test-Path -LiteralPath $source -PathType Leaf){1}else{@(Get-ChildItem -LiteralPath $source -Recurse -File -Force).Count}
    $Report.Add("- Move $From -> $To")
    if($Apply){
        [IO.Directory]::CreateDirectory((Split-Path -Parent $target))|Out-Null
        try{Move-Item -LiteralPath $source -Destination $target;$script:MovedFiles+=$count}
        catch{if($From.EndsWith('.log')){$Report.Add("  - Kept active log: $From")}else{throw}}
    }
}
function DeleteGenerated([string]$Relative) {
    $target=WorkspacePath $Relative
    if(!(Test-Path -LiteralPath $target)){return}
    $count=if(Test-Path -LiteralPath $target -PathType Leaf){1}else{@(Get-ChildItem -LiteralPath $target -File -Recurse -Force).Count}
    $Report.Add("- Remove reproducible output: $Relative")
    if($Apply){Remove-Item -LiteralPath $target -Recurse -Force;$script:DeletedFiles+=$count}
}

ArchiveSources 'legacy-data-20261109' @('data1','tmp/incoming_data4_20261020_134149')
ArchiveSources 'old-test-databases-20261109' @('tmp/achievement_review.sqlite3','tmp/combat_templates_ui.sqlite3','tmp/live_schema_combat_templates.sqlite3','tmp/backups')
ArchiveSources 'model-generation-sources-20261109' @('tmp/imagegen','tools/Leg','uploads','frontend/inventory_body_cutout.png')
MoveSource 'backups' 'data/backups/manual'
MoveSource 'EFFECT_SHOP.md' 'docs/effect-shop.md'
MoveSource 'TREASURY.md' 'docs/treasury.md'
MoveSource 'README.md' 'docs/history/project-notes.md'
MoveSource 'Аватары персонаэей' 'references/characters'
MoveSource 'server_runtime.log' 'logs/server_runtime.log'
MoveSource 'cloudflared_url.log' 'logs/cloudflared_url.log'
MoveSource 'local_host/server_restart_stderr.log' 'logs/old-local-stderr.log'
MoveSource 'local_host/server_restart_stdout.log' 'logs/old-local-stdout.log'
DeleteGenerated 'tmp/pdfs'
DeleteGenerated 'tmp/inspect_dragon_sheets.py'
DeleteGenerated 'tmp/mobile-customization-20261109.png'
DeleteGenerated 'tmp/mobile-effect-settings-20261109.png'
DeleteGenerated 'tmp/treasury-mobile-result.png'
DeleteGenerated 'tmp/hub-qa'
foreach($folder in @('app','tests','tools','local_host')){
    $parent=WorkspacePath $folder
    foreach($cache in @(Get-ChildItem -LiteralPath $parent -Directory -Recurse -Filter '__pycache__' -Force | Sort-Object {$_.FullName.Length} -Descending)){
        DeleteGenerated $cache.FullName.Substring($Root.Length+1)
    }
}
$Report.Add('')
$Report.Add("Archived files: $script:ArchivedFiles; moved files: $script:MovedFiles; removed generated files: $script:DeletedFiles.")
$Report.Add('Live data/, .env, .venv, application code and working frontend assets are preserved.')
if($Apply){
    $destination=WorkspacePath 'docs/cleanup-20261109.md'
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination))|Out-Null
    [IO.File]::WriteAllLines($destination,$Report,[Text.UTF8Encoding]::new($false))
}
$Report
