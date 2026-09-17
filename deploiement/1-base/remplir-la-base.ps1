# Remplit la base de production avec les 714 rooms et les 3 parcours.
#
# A LANCER DEPUIS VOTRE ORDINATEUR, pas depuis un serveur : ces commandes ont
# besoin des sources du depot, que l'image de production n'embarque pas.
#
# Usage, dans PowerShell :
#
#   cd C:\Users\N\Projets\thm-roadmap\deploiement\1-base
#   .\remplir-la-base.ps1 -DatabaseUrl 'postgresql://...-pooler.../neondb?sslmode=require'
#
# Si PowerShell refuse d'executer le script, c'est sa protection par defaut.
# Autoriser la session en cours, une seule fois :
#
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

param(
  [Parameter(Mandatory = $true, HelpMessage = "La chaine de connexion Neon, celle qui contient -pooler")]
  [string]$DatabaseUrl
)

# PAS DE "Stop" ICI, ET C EST VOLONTAIRE.
#
# Windows PowerShell 5.1 traite CHAQUE LIGNE ecrite par un programme externe
# sur sa sortie d erreur comme une erreur de PowerShell. pnpm y ecrit sa
# progression : avec "Stop", le script s arreterait des la premiere ligne,
# alors que tout va bien. On verifie donc $LASTEXITCODE apres chaque appel,
# ce qui est la seule mesure fiable de leur reussite.
$ErrorActionPreference = "Continue"

# Le dossier `app` du depot, quel que soit l'endroit d'ou le script est lance.
$app = Resolve-Path (Join-Path $PSScriptRoot "..\..\app")
Set-Location $app

Write-Host ""
Write-Host "Base visee : " -NoNewline
# On n'affiche JAMAIS le mot de passe, meme dans un journal local.
if ($DatabaseUrl -match '@([^/]+)') { Write-Host $Matches[1] } else { Write-Host "(adresse illisible)" }
Write-Host "Dossier    : $app"
Write-Host ""

$env:DATABASE_URL = $DatabaseUrl

Write-Host "1/6  Installation des dependances..." -ForegroundColor Cyan
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "L'installation a echoue." }

Write-Host "2/6  Construction..." -ForegroundColor Cyan
pnpm build
if ($LASTEXITCODE -ne 0) { throw "La construction a echoue." }

Write-Host "3/6  Creation des tables..." -ForegroundColor Cyan
pnpm --filter @thm/api run db:migrate
if ($LASTEXITCODE -ne 0) { throw "Les migrations ont echoue. Verifiez la chaine de connexion." }

Write-Host "4/6  Referentiels (difficultes, types, equipes)..." -ForegroundColor Cyan
pnpm --filter @thm/api run db:seed
if ($LASTEXITCODE -ne 0) { throw "Le semis des referentiels a echoue." }

# LE `--apply` N'EST PAS DECORATIF. Sans lui, ces deux commandes affichent ce
# qu'elles feraient, se terminent sans erreur, et n'ecrivent rien.
Write-Host "5/6  Import des 714 rooms..." -ForegroundColor Cyan
pnpm data:import -- --apply-mappings --apply
if ($LASTEXITCODE -ne 0) { throw "L'import a echoue." }

Write-Host "6/6  Parcours editoriaux..." -ForegroundColor Cyan
pnpm --filter @thm/api run roadmap:seed -- --apply
if ($LASTEXITCODE -ne 0) { throw "Le semis des parcours a echoue." }

Write-Host ""
Write-Host "Termine." -ForegroundColor Green
Write-Host "A verifier dans la console Neon, onglet SQL Editor :" -ForegroundColor Green
Write-Host "  select count(*) from rooms;   -- attendu : 714"
Write-Host "  select count(*) from tracks;  -- attendu : 3"
Write-Host ""
