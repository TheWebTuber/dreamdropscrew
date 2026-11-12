# Dream Drops Crew public emote index updater (Windows PowerShell 5.1+ / PowerShell 7)
# Run from website ROOT: powershell -ExecutionPolicy Bypass -File .\scripts\refresh-crew-emotes.ps1
# Does not edit creator sites; reads public JSON files and verifies image paths.
# Improved verifier: tries HEAD, then ranged GET when HEAD is blocked.
# Blackjack images confirmed at /emotes/files/; their JSON is at /emotes/emotes.json.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# EDIT THESE CANDIDATES if a member stores their JSON/files somewhere else.
$Sources = @(
  @{ Id='crystal'; Base='https://crystalsdreamdrops.creatorpromote.com/'; Gallery='emotes'; Json=@('emotes/emotes.json','emotes.json','emotes/jdgifs.json','jdgifs.json','emotes/gifs.json','gifs.json'); Images=@('emotes/','jdemotes/','emotes/jdemotes/','emotes/gifs/','gifs/','img/','emotes/img/','') },
  @{ Id='sal'; Base='https://salahare.creatorpromote.com/'; Gallery='emotes.html'; Json=@('emotes.json','emotes/emotes.json','gifs.json','emotes/gifs.json','jdgifs.json'); Images=@('emotes/','gifs/','img/','emotes/gifs/','') },
  @{ Id='blackjack'; Base='https://blackjacksetzer.creatorpromote.com/'; Gallery='emotes.html'; Json=@('emotes/emotes.json','emotes.json','gifs.json','emotes/gifs.json','jdgifs.json'); Images=@('emotes/files/','emotes/','gifs/','img/','emotes/gifs/','') },
  @{ Id='daddy'; Base='https://daddydepresso.creatorpromote.com/'; Gallery='emotes.html'; Json=@('emotes/emotes.json'); Images=@('emotes/') },
  @{ Id='pmog'; Base='https://pmog.creatorpromote.com/'; Gallery='emotes'; Json=@('emotes.json','emotes/emotes.json','gifs.json','emotes/gifs.json','jdgifs.json','jdemotes/jdgifs.json'); Images=@('emotes/','gifs/','jdemotes/','img/','emotes/gifs/','') }
)
$Allowed = '\.(?:gif|png|apng|webp|jpe?g|avif)$'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Destination = Join-Path $Root 'data\crew-emotes.json'

function Get-RemoteText([string]$uri) {
  try { $res=Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 12; return [string]$res.Content }
  catch { return $null }
}
function Is-SafeName([string]$name) {
  return ($name -and $name -match $script:Allowed -and $name -notmatch '[\\/]' -and $name -notmatch '(?i)\%2f|\%5c' -and $name -notmatch '^\.{1,2}$')
}
function Encode-Name([string]$name) { return [Uri]::EscapeDataString($name) }
function Is-ImageReachable([string]$url) {
  # Some hosts reject HEAD even though the image works in a browser.
  # Try HEAD first, then a ranged GET. A real image response is required.
  foreach ($method in @('Head','Get')) {
    try {
      $args = @{
        Uri=$url; Method=$method; UseBasicParsing=$true; TimeoutSec=9;
        ErrorAction='Stop'
      }
      if ($method -eq 'Get') { $args.Headers = @{ Range='bytes=0-0' } }
      $resp = Invoke-WebRequest @args
      $code = [int]$resp.StatusCode
      $ctype = [string]$resp.Headers['Content-Type']
      if (($code -ge 200 -and $code -lt 300) -and
          ($ctype -match '(?i)^image/' -or $ctype -match '(?i)^application/octet-stream')) {
        return $true
      }
    } catch {
      # HEAD 403/405 or other errors: GET may still work.
    }
  }
  return $false
}
function Extract-Files($data) {
  $output=@()
  foreach($entry in @($data)) {
    $candidate=''; $label=''; $url=''
    if($entry -is [string]) { $candidate=$entry }
    elseif($null -ne $entry) {
      foreach($field in @('file','filename','src','image','url','name')) {
        $v=$entry.$field
        if($v -is [string] -and $v -match $script:Allowed){$candidate=$v;break}
      }
      foreach($field in @('title','label','displayName')) {
        $v=$entry.$field; if($v -is [string] -and $v.Trim()){ $label=$v.Trim();break }
      }
    }
    if(-not $candidate) { continue }
    if($candidate -match '^https://') {
      $url=$candidate
      try { $candidate=[Uri]::UnescapeDataString(([Uri]$candidate).Segments[-1]) }catch{continue}
    }
    if(-not (Is-SafeName $candidate)){continue}
    if(-not $label){$label=([IO.Path]::GetFileNameWithoutExtension($candidate) -replace '[_-]',' ').Trim()}
    $output+= [pscustomobject]@{ File=$candidate; Name=$label; Url=$url }
  }
  return ,$output
}
function Discover-JsonCandidates($src) {
  $paths=@($src.Json)
  $pageUrl=$src.Base+$src.Gallery
  $html=Get-RemoteText $pageUrl
  if($html) {
    # Pick up JSON strings occurring in the HTML or its linked gallery JavaScript.
    $snippets=@($html)
    $scriptMatches=[regex]::Matches($html,'(?i)<script\b[^>]*\bsrc\s*=\s*["'']([^"'']+\.js(?:\?[^"'']*)?)["'']')
    foreach($m in @($scriptMatches | Select-Object -First 8)) {
      try {
        $jsUri=[Uri]::new([Uri]$pageUrl,$m.Groups[1].Value).AbsoluteUri
        $body=Get-RemoteText $jsUri
        if($body){ $snippets+=$body }
      } catch {}
    }
    foreach($body in $snippets) {
      foreach($m in [regex]::Matches($body,'["'']([a-zA-Z0-9_./-]+\.json)["'']')){
        $p=$m.Groups[1].Value
        if($p -match '^https?://') { continue }
        if($p -match '(?i)emote|gif|emoji|jd') { $paths+= $p }
      }
    }
  }
  return ,@($paths | Select-Object -Unique)
}

$previous=@();$previousSource=@{}
if(Test-Path $Destination){
  try {
    $old=Get-Content $Destination -Raw -Encoding UTF8 | ConvertFrom-Json
    if($old.items){$previous=@($old.items)}
    if($old.sources){$old.sources.PSObject.Properties | ForEach-Object { $previousSource[$_.Name]=$_.Value }}
  } catch {Write-Warning 'Old catalog unreadable; starting with an empty catalog.'}
}
$all=@();$sourcesState=@{}
foreach($src in $Sources){
  Write-Host "`n[$($src.Id)] Checking public emote lists..." -ForegroundColor Cyan
  $list=@();$chosenJson=''
  $paths=Discover-JsonCandidates $src
  foreach($candidate in $paths){
    try {$url=[Uri]::new([Uri]$src.Base, [string]$candidate).AbsoluteUri} catch { continue }
    $raw=Get-RemoteText $url
    if(-not $raw){continue}
    try {
      $data=ConvertFrom-Json -InputObject $raw
      # Standard lists are top-level arrays; also accept {"emotes": [...] } and {"files": [...]}.
      if($data -isnot [Array]) {
        if($null -ne $data.emotes){$data=@($data.emotes)}
        elseif($null -ne $data.files){$data=@($data.files)}
        elseif($null -ne $data.items){$data=@($data.items)}
        else {continue}
      }
      $found=Extract-Files $data
      if($found.Count -gt 0){$list=@($found);$chosenJson=$url;break}
    } catch {}
  }
  if($list.Count -eq 0){
    # Keep previously indexed entries rather than erasing a member when their site is offline.
    $oldMember=@($previous | Where-Object { $_.member -eq $src.Id })
    $all+= $oldMember
    $sourcesState[$src.Id]=@{status='not found, previous entries kept';count=$oldMember.Count}
    Write-Warning "No public emote JSON detected for $($src.Id). Existing $($oldMember.Count) entries kept. Check manifest paths in script."
    continue
  }
  Write-Host "Using $chosenJson ($($list.Count) files)"
  $first=$list[0]
  $selectedImageBase=$null
  if(-not $first.Url){
    # Prefer the directory containing the JSON when files are beside it.
    $jsonDir=([Uri]$chosenJson).AbsolutePath -replace '[^/]+$',''
    $candidates=@()
    if($jsonDir -ne '/') { $candidates += $jsonDir.TrimStart('/') }
    $candidates += @($src.Images)
    $candidates = @($candidates | Select-Object -Unique)
    $samples=@($list[0].File)
    if($list.Count -gt 2){$samples+= $list[[int][Math]::Floor($list.Count/2)].File}
    foreach($path in $candidates){
      $base=[Uri]::new([Uri]$src.Base,[string]$path).AbsoluteUri
      foreach($sample in $samples){
        if(Is-ImageReachable ($base+(Encode-Name $sample))){$selectedImageBase=$base;break}
      }
      if($selectedImageBase){break}
    }
    if(-not $selectedImageBase){
      # Do not add made-up image links that cannot be verified.
      $oldMember=@($previous | Where-Object { $_.member -eq $src.Id })
      $all+= $oldMember
      $sourcesState[$src.Id]=@{status='image folder unverified, previous entries kept';count=$oldMember.Count;json=$chosenJson}
      Write-Warning "Found emote JSON but cannot verify the image URL for $($src.Id). Check an actual image's Copy Image Address in the creator gallery and add its folder to Images." 
      Write-Host "  First sample filename: $($first.File)" -ForegroundColor Yellow
      Write-Host "  Example URL checked: $($src.Base)$($candidates[0])$(Encode-Name $first.File)" -ForegroundColor Yellow
      continue
    }
    Write-Host "Verified image folder: $selectedImageBase" -ForegroundColor Green
  }
  $added=0;$used=@{}
  foreach($entry in $list){
    $u=if($entry.Url){$entry.Url}else{$selectedImageBase+(Encode-Name $entry.File)}
    try {
      $uri=[Uri]$u
      if($uri.Scheme -ne 'https'){continue}
      if($uri.Host -ne 'creatorpromote.com' -and -not $uri.Host.EndsWith('.creatorpromote.com')){continue}
    }catch{continue}
    if($used.ContainsKey($u)){continue};$used[$u]=$true
    $all+=@{member=$src.Id;name=$entry.Name;url=$u}
    $added++
  }
  $sourcesState[$src.Id]=@{status='indexed';count=$added;json=$chosenJson;images=$selectedImageBase}
  Write-Host "Added $added emotes" -ForegroundColor Green
}
# Sort for stable output, write UTF-8 without BOM where supported.
$all=@($all | Sort-Object member,name,url)
$catalog=[ordered]@{updated=(Get-Date).ToUniversalTime().ToString('o');items=$all;sources=$sourcesState}
$json=ConvertTo-Json -InputObject $catalog -Depth 8
$utf8NoBom=New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($Destination,$json,$utf8NoBom)
Write-Host "`nSaved $($all.Count) indexed emotes to: $Destination" -ForegroundColor Green
Write-Host 'Upload just data/crew-emotes.json to your website to refresh the shared gallery.'
