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

# ---------------------------------------------------------------------------
# DEUX GARDES QUI MANQUAIENT, ET LE DEFAUT QU'ILS FERMENT.
#
# `$LASTEXITCODE` n'est PAS mis a jour quand la commande n'existe pas. Sous
# `$ErrorActionPreference = "Continue"`, une CommandNotFoundException n'arrete
# pas le script et laisse la VALEUR PRECEDENTE en place - 0, le plus souvent.
# Chaque `if ($LASTEXITCODE -ne 0)` voyait donc 0 et laissait passer.
#
# Constate sur une machine ou pnpm n'etait pas sur le PATH : le script affichait
# ses etapes, se terminait par "Termine." en vert, code de sortie 0, et
# proposait d'aller verifier 714 lignes dans une base ou rien n'avait ete ecrit.
#
# Deux mesures, et les deux sont necessaires :
#   1. exiger l'outil AVANT la premiere etape ;
#   2. remettre $LASTEXITCODE a $null avant chaque appel, pour qu'une commande
#      qui n'a pas tourne se distingue d'une commande qui a reussi.
# ---------------------------------------------------------------------------

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm est introuvable sur le PATH. Installez-le (corepack enable) et rouvrez le terminal."
}

function Invoquer {
  param(
    [Parameter(Mandatory = $true)][string]$Etape,
    [Parameter(Mandatory = $true)][scriptblock]$Commande
  )
  $global:LASTEXITCODE = $null
  & $Commande
  if ($null -eq $global:LASTEXITCODE) {
    throw "$Etape : la commande n'a pas ete executee du tout. Rien n'a ete fait."
  }
  if ($global:LASTEXITCODE -ne 0) {
    throw "$Etape : echec, code $global:LASTEXITCODE."
  }
}

Write-Host "1/6  Installation des dependances..." -ForegroundColor Cyan
Invoquer "1/6 installation" { pnpm install --frozen-lockfile }

Write-Host "2/6  Construction..." -ForegroundColor Cyan
Invoquer "2/6 construction" { pnpm build }

Write-Host "3/6  Creation des tables..." -ForegroundColor Cyan
Invoquer "3/6 migrations" { pnpm --filter @thm/api run db:migrate }

Write-Host "4/6  Referentiels (difficultes, types, equipes)..." -ForegroundColor Cyan
Invoquer "4/6 referentiels" { pnpm --filter @thm/api run db:seed }

# LE `--apply` N'EST PAS DECORATIF. Sans lui, ces deux commandes affichent ce
# qu'elles feraient, se terminent sans erreur, et n'ecrivent rien.
Write-Host "5/6  Import des 714 rooms..." -ForegroundColor Cyan
Invoquer "5/6 import des rooms" { pnpm data:import -- --apply-mappings --apply }

Write-Host "6/6  Parcours editoriaux..." -ForegroundColor Cyan
Invoquer "6/6 parcours" { pnpm --filter @thm/api run roadmap:seed -- --apply }

Write-Host ""
Write-Host "Termine." -ForegroundColor Green
Write-Host "A verifier dans la console Neon, onglet SQL Editor :" -ForegroundColor Green
Write-Host "  select count(*) from rooms;   -- attendu : 714"
Write-Host "  select count(*) from tracks;  -- attendu : 3"
Write-Host ""
