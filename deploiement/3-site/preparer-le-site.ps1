# Prepare le dossier du site, pret a deposer chez Cloudflare Pages.
#
# CE SCRIPT FAIT TROIS CHOSES, et la premiere est celle qu'on oublie :
#   1. il ecrit l'adresse de votre API dans `_headers`. Sans elle, le navigateur
#      interdit au site d'appeler l'API, et la page reste vide SANS message ;
#   2. il construit le site ;
#   3. il pose `_headers` et `_redirects` dans le dossier construit.
#
# Usage, dans PowerShell :
#
#   cd C:\Users\N\Projets\thm-roadmap\deploiement\3-site
#   .\preparer-le-site.ps1 -ApiUrl 'https://thm-roadmap-api.onrender.com'
#
# Le resultat est un dossier `site-a-deposer` : c'est LUI qu'on depose.

param(
  [Parameter(Mandatory = $true, HelpMessage = "L'adresse de votre API, sans barre oblique finale")]
  [string]$ApiUrl
)

# PAS DE "Stop" ICI, ET C EST VOLONTAIRE.
#
# Windows PowerShell 5.1 traite CHAQUE LIGNE ecrite par un programme externe
# sur sa sortie d erreur comme une erreur de PowerShell. pnpm y ecrit sa
# progression : avec "Stop", le script s arreterait des la premiere ligne,
# alors que tout va bien. On verifie donc $LASTEXITCODE apres chaque appel,
# ce qui est la seule mesure fiable de leur reussite.
$ErrorActionPreference = "Continue"

# Une barre oblique finale casserait la politique de securite sans rien dire.
$ApiUrl = $ApiUrl.TrimEnd('/')
if ($ApiUrl -notmatch '^https://') {
  throw "L'adresse doit commencer par https:// - le navigateur refuse le reste."
}

$racine = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$app = Join-Path $racine "app"
$sortie = Join-Path $PSScriptRoot "site-a-deposer"

Write-Host ""
Write-Host "API      : $ApiUrl"
Write-Host "Sortie   : $sortie"
Write-Host ""

Write-Host "1/3  Construction du site, avec l'adresse de l'API dedans..." -ForegroundColor Cyan
Set-Location $app

# CE QUI SE JOUE SUR CETTE LIGNE.
#
# Sans elle, le front construit n'appelle AUCUNE origine externe : il demande
# /api/stats a sa propre adresse. Chez l'hebergeur statique, la regle de repli
# de _redirects attrape ce chemin et rend index.html en 200 text/html.
# `response.ok` est donc vrai, toute la gestion d'erreur est contournee, et le
# site affiche l'erreur brute "Unexpected token '<'". Aucune erreur CORS
# n'apparait, puisque aucun appel n'a quitte l'origine : le symptome ne designe
# pas sa cause, et on
# perd la soiree a verifier CORS_ORIGINS et connect-src, qui sont corrects.
$env:VITE_API_BASE_URL = $ApiUrl

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "L'installation a echoue." }
pnpm build
if ($LASTEXITCODE -ne 0) { throw "La construction a echoue." }

$dist = Join-Path $app "apps\web\dist"
if (-not (Test-Path $dist)) { throw "Le dossier construit est introuvable : $dist" }

# PREUVE, PAS CONFIANCE.
#
# Poser la variable ne prouve pas qu'elle soit ARRIVEE dans le bundle : un nom
# mal orthographie, un cache de construction, une version de Vite qui ne
# remplace plus `import.meta.env`, et `pnpm build` se termine sans erreur avec
# des chemins relatifs. On relit donc ce qui a ete produit, au lieu de supposer.
$assets = Join-Path $dist "assets"
$trouve = Get-ChildItem $assets -Filter *.js -Recurse -ErrorAction SilentlyContinue |
  Select-String -SimpleMatch -Pattern $ApiUrl -List
if (-not $trouve) {
  throw ("L'adresse $ApiUrl n'est PAS dans le site construit. Publie tel quel, " +
         "il appellerait sa propre origine et n'afficherait aucune donnee. Rien n'a ete assemble.")
}
Write-Host ("     adresse presente dans " + $trouve[0].Filename) -ForegroundColor Green

Write-Host "2/3  Copie du site construit..." -ForegroundColor Cyan
if (Test-Path $sortie) { Remove-Item $sortie -Recurse -Force }
Copy-Item $dist $sortie -Recurse

Write-Host "3/3  En-tetes et repli, avec votre adresse d'API..." -ForegroundColor Cyan
$entetes = Get-Content (Join-Path $PSScriptRoot "_headers") -Raw
if ($entetes -notmatch 'https://api\.exemple\.fr') {
  throw "Le modele _headers ne contient plus l'adresse d'exemple : il a deja ete modifie."
}
$entetes = $entetes -replace 'https://api\.exemple\.fr', $ApiUrl
Set-Content -Path (Join-Path $sortie "_headers") -Value $entetes -Encoding utf8
Copy-Item (Join-Path $PSScriptRoot "_redirects") (Join-Path $sortie "_redirects")

Write-Host ""
Write-Host "Termine." -ForegroundColor Green
Write-Host "Le dossier a deposer est : $sortie" -ForegroundColor Green
Write-Host ""
Write-Host "Chez Cloudflare Pages : Workers & Pages > Create > Pages > Upload assets," -ForegroundColor Green
Write-Host "puis glissez le CONTENU de ce dossier (pas le dossier lui-meme)."
Write-Host ""
Write-Host "Verification rapide, le dossier doit contenir :"
Get-ChildItem $sortie | Select-Object -First 6 -ExpandProperty Name | ForEach-Object { Write-Host "  $_" }
Write-Host ""
