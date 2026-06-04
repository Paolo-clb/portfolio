<#
  build-dist.ps1 — assembles desktop/dist/ (the ONLY files Tauri bundles).

  It copies Light Again straight from the portfolio (the single source of truth:
  js/light-again, css, assets) into a clean folder that does NOT contain
  src-tauri — which is exactly what Tauri requires (the original "separate your
  files from the Tauri files" error).

  Tauri runs this automatically before every build (beforeBuildCommand), but you
  can also run it by hand to refresh dist/ after editing the game:
      powershell -ExecutionPolicy Bypass -File build-dist.ps1
#>
$ErrorActionPreference = 'Stop'

$root      = $PSScriptRoot                 # ...\portfolio\desktop
$portfolio = Split-Path $root -Parent      # ...\portfolio
$launcher  = Join-Path $root 'launcher'
$dist      = Join-Path $root 'dist'

Write-Host "Building Light Again dist from $portfolio" -ForegroundColor Cyan

# 1. Clean dist ------------------------------------------------------------
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
foreach ($d in @('js\light-again', 'css', 'assets\light-again', 'vendor')) {
  New-Item -ItemType Directory -Path (Join-Path $dist $d) -Force | Out-Null
}

# 2. Game source from the portfolio ---------------------------------------
Copy-Item (Join-Path $portfolio 'js\light-again\*.js') (Join-Path $dist 'js\light-again') -Force
Copy-Item (Join-Path $portfolio 'js\i18n.js')          (Join-Path $dist 'js')            -Force
Copy-Item (Join-Path $portfolio 'css\styles.css')      (Join-Path $dist 'css')           -Force
Copy-Item (Join-Path $portfolio 'css\modals.css')      (Join-Path $dist 'css')           -Force
Copy-Item (Join-Path $portfolio 'css\light-again.css') (Join-Path $dist 'css')           -Force
# Pickaxe skins only — skip the 44 MB gameplay-preview.mp4 (portfolio button, not the game)
Copy-Item (Join-Path $portfolio 'assets\light-again\*.png') (Join-Path $dist 'assets\light-again') -Force

# 3. Launcher shell (vendored Phaser + the __siteT shim + desktop overrides) -
Copy-Item (Join-Path $launcher 'vendor\phaser.min.js')     (Join-Path $dist 'vendor') -Force
Copy-Item (Join-Path $launcher 'i18n-shim.js')              $dist                     -Force
Copy-Item (Join-Path $launcher 'desktop-overrides.css')     $dist                     -Force
Copy-Item (Join-Path $launcher 'desktop-cursor.js')         $dist                     -Force

# 4. index.html — inject the EXACT <script> list from the portfolio's index.html
#    so the module load order can never drift out of sync with the game.
$portfolioHtml = Get-Content (Join-Path $portfolio 'index.html') -Raw
$matches = [regex]::Matches($portfolioHtml, '<script src="js/light-again/[^"]+"></script>')
if ($matches.Count -eq 0) { throw "No light-again <script> tags found in portfolio/index.html" }
$scriptBlock = ($matches | ForEach-Object { '  ' + $_.Value }) -join "`r`n"

$template = Get-Content (Join-Path $launcher 'index.html') -Raw
$out = $template.Replace('<!--LIGHT_AGAIN_SCRIPTS-->', $scriptBlock)
Set-Content -Path (Join-Path $dist 'index.html') -Value $out -Encoding UTF8

$sizeMB = [math]::Round(((Get-ChildItem $dist -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Host "OK - dist built ($($matches.Count) game modules, $sizeMB MB) -> $dist" -ForegroundColor Green
