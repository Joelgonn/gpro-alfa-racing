# scripts/hanoi-fase2-patch-xlsx.ps1
#
# Fase 2 - Reconhecimento Hanoi (correção mínima na planilha)
#
# Estratégia: patch cirúrgico no XML interno do .xlsx, reempacotando o ZIP na
# mesma ordem de entradas. NÃO usa SheetJS/ExcelJS para escrita porque esses
# reescrevem o arquivo inteiro e descartam estilos, comentários, desenhos e
# validações de dados que não fazem parte deste escopo.
#
# Alterações aplicadas (somente as 4 autorizadas):
#   1. Tracks!Y68            = 37      (WS Base provisório - coluna Y, "WS (25)")
#   2. Tyre&Fuel!D15         A4:AQ67 -> A4:AQ68   (ramo "Rain" do VLOOKUP)
#   3. RaceHistory I2:...    $A$4:$Q$67 -> $A$4:$Q$68  (VLOOKUP Tracks)
#   4. Planejamento          dataValidation lista sem <formula1> -> Yesno
#
# Uso:
#   pwsh -File scripts/hanoi-fase2-patch-xlsx.ps1 -DryRun
#   pwsh -File scripts/hanoi-fase2-patch-xlsx.ps1

[CmdletBinding()]
param(
  [string]$SourcePath = (Join-Path $PSScriptRoot '..\data\calculadora.xlsx'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\data\calculadora.xlsx'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$SourcePath = [System.IO.Path]::GetFullPath($SourcePath)
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------------------
# Regras de patch: entry do ZIP -> lista de [regex, substituição, valor esperado]
# Cada regra é validada por contagem de ocorrências antes de aplicar.
# ---------------------------------------------------------------------------
function Get-PatchRules {
  return @(
    @{
      Entry = 'xl/worksheets/sheet5.xml'   # Tracks
      Label = 'Tracks!Y68 = 37 (WS Base provisório)'
      Edits = @(
        @{
          Find    = '<c r="Y68" s="585"\s*/>'
          Replace = '<c r="Y68" s="585"><v>37</v></c>'
          Expect  = 1
          AlreadyApplied = '<c r="Y68" s="585"><v>37</v></c>'
        }
      )
    },
    @{
      Entry = 'xl/worksheets/sheet2.xml'   # Tyre&Fuel
      Label = 'Tyre&Fuel!D15 ramo Rain cobre linha 68'
      Edits = @(
        @{
          Find    = 'Tracks!A4:AQ67,29,0'
          Replace = 'Tracks!A4:AQ68,29,0'
          Expect  = 1
          AlreadyApplied = 'Tracks!A4:AQ68,29,0'
        }
      )
    },
    @{
      Entry = 'xl/worksheets/sheet8.xml'   # RaceHistory
      Label = 'RaceHistory VLOOKUP Tracks cobre linha 68'
      Edits = @(
        @{
          Find    = 'Tracks!\$A\$4:\$Q\$67'
          Replace = 'Tracks!$A$4:$Q$68'
          Expect  = 315
          AlreadyApplied = 'Tracks!$A$4:$Q$68'
        }
      )
    },
    @{
      Entry = 'xl/worksheets/sheet7.xml'   # Planejamento
      Label = 'Planejamento: dataValidation de lista sem formula1'
      Edits = @(
        @{
          Find    = '(<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="AA41 Q9 Q73 Q41 G9 G73 G41 BE9 BE41 AU9 AU73 AU41 AK9 AK73 AK41 AA9 AA73" xr:uid="\{00000000-0002-0000-0600-000000000000\}")\s*/>'
          Replace = '$1><formula1>Yesno</formula1></dataValidation>'
          Expect  = 1
          AlreadyApplied = '<formula1>Yesno</formula1></dataValidation>'
        }
      )
    }
  )
}

function Read-ZipEntryText {
  param([System.IO.Compression.ZipArchive]$Zip, [string]$EntryName)
  $entry = $Zip.GetEntry($EntryName)
  if (-not $entry) { throw "Entrada não encontrada no ZIP: $EntryName" }
  $reader = New-Object System.IO.StreamReader($entry.Open(), $utf8NoBom)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

$rules = Get-PatchRules

# ---------------------------------------------------------------------------
# 1) Fase de verificação (somente leitura)
# ---------------------------------------------------------------------------
Write-Host "=== VERIFICAÇÃO (somente leitura) ===" -ForegroundColor Cyan

$srcZip = [System.IO.Compression.ZipFile]::OpenRead($SourcePath)
$patched = @{}
try {
  foreach ($rule in $rules) {
    $text = Read-ZipEntryText -Zip $srcZip -EntryName $rule.Entry
    $newText = $text
    foreach ($edit in $rule.Edits) {
      $matches = [regex]::Matches($newText, $edit.Find)
      $count = $matches.Count
      if ($count -eq 0) {
        # Idempotência: já aplicado?
        if ($newText.Contains($edit.AlreadyApplied)) {
          Write-Host ("  [JA APLICADO] {0} ({1})" -f $rule.Label, $rule.Entry) -ForegroundColor Yellow
          continue
        }
        throw ("Nenhuma ocorrência para '{0}' em {1} ({2})" -f $edit.Find, $rule.Entry, $rule.Label)
      }
      if ($count -ne $edit.Expect) {
        throw ("Esperava {0} ocorrência(s) de '{1}' em {2}, encontrei {3}" -f $edit.Expect, $edit.Find, $rule.Entry, $count)
      }
      $newText = [regex]::Replace($newText, $edit.Find, $edit.Replace)
      Write-Host ("  [OK] {0} -> {1} ({2} ocorrência(s))" -f $rule.Label, $rule.Entry, $count) -ForegroundColor Green
    }
    $patched[$rule.Entry] = $newText
  }
} finally {
  $srcZip.Dispose()
}

if ($DryRun) {
  Write-Host "`n=== DRY RUN: nenhum arquivo gravado ===" -ForegroundColor Yellow
  return
}

# ---------------------------------------------------------------------------
# 2) Regravação: novo ZIP preservando a ordem original de entradas
# ---------------------------------------------------------------------------
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("hanoi-fase2-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null
$tmpZipPath = Join-Path $tmpDir 'calculadora.xlsx'

try {
  $srcZip = [System.IO.Compression.ZipFile]::OpenRead($SourcePath)
  $dstStream = [System.IO.File]::Open($tmpZipPath, 'Create', 'Write')
  $dstZip = New-Object System.IO.Compression.ZipArchive($dstStream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    foreach ($entry in $srcZip.Entries) {
      $newEntry = $dstZip.CreateEntry($entry.FullName, [System.IO.Compression.CompressionLevel]::Optimal)
      $newEntry.LastWriteTime = $entry.LastWriteTime
      $out = $newEntry.Open()
      try {
        if ($patched.ContainsKey($entry.FullName)) {
          $bytes = $utf8NoBom.GetBytes($patched[$entry.FullName])
          $out.Write($bytes, 0, $bytes.Length)
        } else {
          $in = $entry.Open()
          try { $in.CopyTo($out) } finally { $in.Dispose() }
        }
      } finally { $out.Dispose() }
    }
  } finally {
    $dstZip.Dispose()
    $dstStream.Dispose()
    $srcZip.Dispose()
  }

  Copy-Item -LiteralPath $tmpZipPath -Destination $OutputPath -Force
  Write-Host "`n=== ARQUIVO REGRAVADO ===" -ForegroundColor Cyan
  Write-Host "  destino: $OutputPath"
  Write-Host ("  sha256 : {0}" -f (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLower())
} finally {
  Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
