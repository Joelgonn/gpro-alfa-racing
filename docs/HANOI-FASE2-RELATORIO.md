# HANOI — FASE 2 (reconhecimento da pista)

**Data:** 17/10/2026
**Escopo:** tornar Hanoi (`vn`) reconhecida pela UX, pelo motor de cálculo, pelo
planejamento e pelo histórico, corrigindo somente os pontos da auditoria.
**Fora de escopo:** commit, push, deploy, chamadas à API da GPRO, alteração de
outras pistas.
**Revisão do documento:** Sprint 2.4 (higiene documental). Este relatório descreve
a Fase 2 e as sprints seguintes; o histórico consolidado está no §10 e as
limitações de validação abertas no §11.

---

## 1. Semântica confirmada antes de tocar em `data/tracks.json`

`getTrackBaseValue()` (`domain/setup/calculateSetup.ts:63`) lê `data/tracks.json`
e é o substituto do `PROCV($R$5;Tracks!$A$4:$W$885;19;0)` da planilha.

| Elemento | Coluna | Índice PROCV | Cabeçalho | Valor de Hanoi |
|---|---|---|---|---|
| **Wings base** | **S** | **19** | `S3 = "Wings (19)"` | `S68 = 194.32` |
| **WS Base** | **Y** | **25** | `Y3 = "WS (25)"` | `Y68 = 37` (provisório) |

Conferência por amostragem (o `tracks.json` traz a coluna S, não a Y):

- `Tracks!S4 = 253.117` ↔ `tracks.json["A1-Ring"] = 253.117`
- `Tracks!S5 = 626` ↔ `tracks.json["Adelaide"] = 626`
- `Tracks!S67 = 661.951` ↔ `tracks.json["Zolder"] = 661.951`
- `Tracks!Y4 = 145.114` ≠ `tracks.json["A1-Ring"] = 253.117`

Consumidores:

- **Wings base (S / 19)** — `Setup&WS!I25 = PROCV(...,19,0)*2` → asa dianteira.
  É o único valor que o motor TypeScript (`calculateSetup.ts`) replica.
- **WS Base (Y / 25)** — `Setup&WS!Y24`, `Z24`, `AA24`, `AB38` → asa traseira.
  Não é consumida pelo motor TypeScript.

**Conclusão:** `data/tracks.json` recebe `194.32` (Wings base). O `37` (WS Base)
fica exclusivamente na planilha, em `Tracks!Y68`.

---

## 2. Estado encontrado na planilha (antes do patch)

| Célula | Esperado pela auditoria | Estado real encontrado |
|---|---|---|
| `Tracks!A68` | `Hanoi` | ✅ `Hanoi` |
| `Tracks!S68` | `194.32` (Wings) | ✅ `194.32` |
| `Tracks!Y68` | `37` (WS provisório) | ❌ **célula vazia** (existia apenas com estilo `<c r="Y68" s="585"/>`) |

Impacto real de `Y68` vazia (medido no motor, não presumido): `PROCV` de célula
vazia **não** retorna `#N/A`, retorna **0**. Ou seja, a asa traseira de Hanoi era
calculada com WS Base = 0 (`Setup&WS!Y24 = -81,14`; `A.T. Q1 previsto = 251`) —
valor silenciosamente errado, sem erro visível. Com `Y68 = 37`: `Y24 = -44,14` e
`A.T. Q1 previsto = 288`.

---

## 3. Alterações aplicadas

### 3.1 `data/calculadora.xlsx` — 4 patches de XML interno

Reempacotado preservando a ordem das entradas do ZIP. Não foi usado
SheetJS/ExcelJS para escrita porque esses reescrevem o arquivo inteiro e
descartam estilos, comentários, desenhos e validações fora do escopo.

| # | Entrada | Alteração | Motivo |
|---|---|---|---|
| 1 | `sheet5.xml` (Tracks) | `<c r="Y68" s="585"/>` → `<c r="Y68" s="585"><v>37</v></c>` | WS Base provisório; sem ela a asa traseira usa 0 |
| 2 | `sheet2.xml` (Tyre&Fuel) | `D15`: `Tracks!A4:AQ67,29,0` → `Tracks!A4:AQ68,29,0` | ramo **Rain** parava na linha 67 — Hanoi ficava fora do lookup de chuva |
| 3 | `sheet8.xml` (RaceHistory) | `Tracks!$A$4:$Q$67` → `Tracks!$A$4:$Q$68` (315 ocorrências) | histórico não reconhecia Hanoi |
| 4 | `sheet7.xml` (Planejamento) | `dataValidation` de lista **sem `<formula1>`** → `<formula1>Yesno</formula1>` | 17 células de toggle continuavam sem fonte de lista (dropdown vazio, digitação rejeitada no Excel) |

**Não alterado (preservado):**

- `Tracks!S68 = 194.32` (Wings base) — intocada.
- Linhas 4..67 da aba `Tracks` (as 64 pistas anteriores) — idênticas ao backup.
- Todos os intervalos que **já** cobriam a linha 68 (`$A$4:$X$885`,
  `$A$4:$AP$848/885`, `A4:AQ68`, `A4:AE68`, `A4:Q68`) — **não foram ampliados**.
- 32 das 36 entradas do ZIP — **conteúdo descompactado** idêntico ao backup.
  O arquivo foi reempacotado, portanto os bytes comprimidos do ZIP **podem
  diferir em todas as 36 entradas**, inclusive nas 32 inalteradas.

### 3.2 `data/tracks.json`

```diff
   "Grobnik": 641.923,
+  "Hanoi": 194.320,
   "Hockenheim": 447.658,
```

Wings base (coluna S / índice 19). Total: 71 pistas.

### 3.3 Tabelas de bandeiras — código `vn`

```diff
 # app/lib/tracks.ts (TRACK_FLAGS)
   "Grobnik": "hr",
+  "Hanoi": "vn",
   "Hockenheim": "de",
```

```diff
 # app/dashboard/wear/page.tsx (TRACK_TO_FLAG — mapa local, não migrado em ALFA-002)
-  "Hockenheim": "de", "Hungaroring": "hu", ...
+  "Hanoi": "vn", "Hockenheim": "de", "Hungaroring": "hu", ...
```

`public/flags/vn.png` já existia (641 bytes).

### 3.4 `app/api/python/[[...route]]/route.ts` — cache do motor

`hfInstance` era singleton construído uma única vez por processo. Como a planilha
é atualizada fora do processo, um servidor aquecido continuava servindo o
workbook antigo: pista nova não aparecia em `/tracks` e os `PROCV` da pista nova
retornavam valor obsoleto/`#N/A` até reiniciar.

Correção mínima aplicada:

- `WORKBOOK_PATH` extraído para constante (era duplicado no loader).
- `getWorkbookFingerprint()` = `size:mtimeMs` do `data/calculadora.xlsx`.
- Cache revalidado contra a impressão digital; se mudou, o estado antigo é
  descartado (`hfInstance = null`, `sheetIdMap = {}`) e o motor é reconstruído.
- **Single-flight preservado** com `loadingFingerprint`: cargas concorrentes para
  a mesma planilha continuam reaproveitando a mesma `loadingPromise`.

---

## 4. Backup verificável

| | Arquivo | SHA256 |
|---|---|---|
| Baseline (pré-Fase 2) | `data/calculadora.backup-20261017-hanoi.xlsx` | `81eccfe8…8d5fb3e3` |
| Após Fase 2 | `data/calculadora.xlsx` | `e87d9cdb…3ba86059` |

Nota de rastreabilidade: `data/calculadora.fase2-hanoi.sha256.txt`.
A nota original `data/calculadora.backup-20261017-hanoi.sha256.txt` foi
preservada e continua conferindo com o backup.

**Prova de escopo:** reverter as 4 edições no arquivo novo reproduz, byte a
byte, o **conteúdo descompactado** das 4 entradas alteradas; as outras 32
entradas têm o mesmo SHA-256 do conteúdo descompactado. Os fluxos comprimidos
do ZIP **não** são idênticos — o arquivo foi reempacotado (mesmas 36 entradas,
mesma ordem e nomes), o que reduziu o tamanho de 1.639.284 para 1.308.982 bytes.

Reaplicar: `pwsh -File scripts/hanoi-fase2-patch-xlsx.ps1` (aceita `-DryRun`).

### 4.1 Achados documentais D1 e D2 — corrigidos na Sprint 2.1

| Achado | Descrição | Correção aplicada (Sprint 2.1) |
|---|---|---|
| **D1** | O manifesto `data/calculadora.fase2-hanoi.sha256.txt` registrava `bytes = 1639299` para `data/calculadora.xlsx`, mas o arquivo real tem **1.308.982** bytes. O `sha256` já estava correto e **não** foi alterado. | Apenas o campo `bytes` foi corrigido, por medição do arquivo em disco. O XLSX **não** foi regenerado para coincidir com o valor antigo. |
| **D2** | O manifesto e este relatório afirmavam que 32 das 36 entradas do ZIP eram *byte a byte* idênticas ao backup. A afirmação é válida para o **conteúdo descompactado**, não para os bytes do arquivo. | Textos reescritos nos dois arquivos distinguindo conteúdo descompactado × bytes comprimidos, e registrando que o reempacotamento reduziu o arquivo de 1.639.284 para 1.308.982 bytes. |

---

## 5. Testes

### Novos

| Arquivo | Cobertura | Resultado |
|---|---|---|
| `tests/hanoi-fase2.test.js` | 39 asserções — semântica Wings/WS, linha 68, intervalos de lookup, chuva, histórico, planejamento, bandeiras, cache, escopo | ✅ todas |
| `tests/hanoi-fase2-engine.test.js` | HyperFormula real sobre a planilha: setup (Q1/Q2/Race), chuva, histórico, planejamento, endpoint `/tracks`, comparação com pista de controle | ✅ todas |

### Regressão existente

`node tests/*.test.js` — **58 arquivos: 49 passam, 9 falham**.
As 9 falhas são **pré-existentes** (confirmado rodando os mesmos testes com as
fontes do `HEAD` antes das alterações):

`alfa-002`, `alfa-003-regression`, `alfa-0142-payment-preparation`,
`alfa-0143-isolation`, `alfa-0143-pix-txid`, `alfa-0143-security`,
`alfa-015-jornada-free`, `pix-008-mercadopago-client`, `sponsors-library-0095`.

**Nenhuma falha nova**.

### Estático

- `npx tsc --noEmit` → exit 0.
- `npx eslint` nos 3 arquivos alterados → **28 errors / 7 warnings no roteador,
  idêntico ao `HEAD`** (todos pré-existentes: `no-explicit-any`, `prefer-const`,
  imports não usados). Nenhum problema novo.

---

## 6. Valores observados para Hanoi no motor

| Célula | Significado | Resultado |
|---|---|---|
| `Setup&WS!I25` | Wings base × 2 (PROCV 19) | `388.64` = 194.32 × 2 |
| `Setup&WS!Y24` | A.T. Q1 (usa WS Base) | `-44.14` (com `Y68=37`) |
| `Setup&WS!D24` | A.T. Q1 previsto | `288` (era `251` com `Y68` vazia) |
| `Setup&WS!I26..I29` | Motor / freios / câmbio / suspensão | `620.42 / 540 / 700 / 496.72` |
| `Tyre&Fuel!D15` (Rain) | base de pneu na chuva | `0.72` (= `Tracks!AC68`) |
| `Tyre&Fuel!D15` (seco) | base de pneu no seco | `1.04` (= `Tracks!AD68`) |
| `RaceHistory!I2/J2/K2` | fator de pista / curvas / vel. média | `0.02388 / 23 / 216` |
| `Planejamento!E11..E21` | desgaste por peça | todos numéricos |
| `/api/python/tracks` | lista da UX | 65 pistas, Hanoi presente |

Erros `Tracks` para Hanoi: **0**. Controle (Monza): **0**.

---

## 7. Pendências (não corrigidas — fora do escopo autorizado)

1. **`Tables!U` — tabela "Season tracks" (Fator P. teste por categoria).**
   `Tables!U2:*` tem 64 pistas (até `Zolder`) e fatores por categoria
   (Rookie/Amador/Pro/Master) preenchidos só até `U62` (Yas Marina).
   Consequência: `Tyre&Fuel!U3:X3`, `Tyre&Fuel!U9`, `Tables!AD1`, `Tables!AD2`
   retornam `#N/A` para Hanoi.
   **Já acontecia com Zolder, Zandvoort e Yeongam** — é defeito pré-existente,
   não regressão de Hanoi (validado no teste de motor).
   **Não é corrigível por ajuste de intervalo:** faltam os *dados* (fatores por
   categoria de Hanoi), que precisam vir da GPRO. As células que o app consome
   (setup, teste, performance, planejamento, histórico e os campos de estratégia
   em `Tyre&Fuel` D4/D6-D9/G/K/N/O/P e D17-D24) **não** entram em erro.

2. **`Tracks!AX68` e `Tracks!DU68` vazias.** São espelhos do WS Base nos blocos
   por fornecedor de pneu (`AX3 = "WS (25)"`, `DU3 = "WS (25)"`). Não são
   consultados por nenhuma fórmula, mas ficam inconsistentes com `Y68`.

3. **Nome definido `Tracks` (`Tracks!$A$4:$A$62`).** Está obsoleto desde antes
   da Fase 2 (não inclui `Yeongam`, `Zandvoort`, `Zolder` nem `Hanoi`) e não é
   referenciado por nenhuma fórmula do arquivo. Candidato a limpeza futura.

4. **`Planejamento` não tem dropdown de pista.** Os seletores `B8/L8/V8/AF8`
   (e as posições de faixa 2 e 3) não têm validação de dados; a pista é escrita
   pelo motor. Comportamento preservado — não alterado nesta fase.

5. **Promessa de carregamento rejeitada permanece armazenada após falha
   persistente** (`app/api/python/[[...route]]/route.ts`). Se `ExcelJS.readFile`
   falhar e o `fs.stat` continuar retornando a mesma impressão digital, a
   `loadingPromise` rejeitada é devolvida em todas as chamadas seguintes até o
   arquivo mudar. Cenário **E6** do harness: continua retornando `ENOENT`.
   **Comportamento também observado no `HEAD` original** (que fazia
   `if (loadingPromise) return loadingPromise;`), portanto **não é regressão de
   Hanoi** e **não foi corrigido** nesta linha de trabalho por estar fora do
   escopo. Deve ser tratado em sprint independente, se autorizada.

---

## 8. Arquivos alterados

| Arquivo | Tipo |
|---|---|
| `data/calculadora.xlsx` | mod. (4 patches de XML) |
| `data/tracks.json` | mod. (+1 pista) |
| `app/lib/tracks.ts` | mod. (+1 bandeira) |
| `app/dashboard/wear/page.tsx` | mod. (+1 bandeira) |
| `app/api/python/[[...route]]/route.ts` | mod. (invalidação de cache) |
| `tests/hanoi-fase2.test.js` | novo |
| `tests/hanoi-fase2-engine.test.js` | novo |
| `scripts/hanoi-fase2-patch-xlsx.ps1` | novo |
| `data/calculadora.fase2-hanoi.sha256.txt` | novo (rastreabilidade) |
| `docs/HANOI-FASE2-RELATORIO.md` | novo (este documento) |

**Atualizações posteriores (documentais, sem alteração funcional de Hanoi):**
o manifesto e este relatório foram ajustados na Sprint 2.1 (D1/D2);
`tests/hanoi-fase2.test.js` foi ajustado na Sprint 2.2 (asserção 6.6 de
single-flight); este relatório foi consolidado na Sprint 2.4. Ver §10.

---

## 9. Achado D3: cache do motor sob falha de `fs.stat`

**Status: regressão introduzida na Fase 2, corrigida na Sprint 2.1 e revalidada
na Sprint 2.3.**

- Introduzida na **Fase 2**, junto com a invalidação por impressão digital.
- Correção mínima **proposta** na Sprint 2.1 e verificada antes da edição numa
  cópia isolada; **aplicada em seguida**, com autorização explícita, em
  `app/api/python/[[...route]]/route.ts`.
- **Revalidada na Sprint 2.3** executando o harness E1–E6 contra o `route.ts`
  real: **E2, E3, E4 e E5 confirmados**.
- **E6 permanece** retornando `ENOENT` na falha persistente — comportamento
  igualmente observado no `HEAD 1f6bfdc`, registrado no §7.5.

### 9.1 Evidência

Harness que transpila o `route.ts` real (e o do `HEAD 1f6bfdc`) com
`fs`/`ExcelJS`/`HyperFormula` instrumentados, exercitando 6 cenários. A coluna
"Fase 2" registra o comportamento **antes** da correção (evidência histórica da
regressão); a última coluna registra a revalidação feita na Sprint 2.3.

| Cenário | Fase 2 (antes da correção) | HEAD 1f6bfdc | Após correção (revalidado na Sprint 2.3) |
|---|---|---|---|
| E1 — cache aquecido e arquivo acessível | ok | ok | **ok** |
| E2 — XLSX alterado invalida o cache | **ok** (ganho da Fase 2) | falha | **ok** |
| E3 — falha transitória no `fs.stat` | **FALHA (`ENOENT`)** | ok (serve o cache em memória) | **ok** (serve o cache em memória) |
| E4 — recuperação com a mesma impressão digital | **FALHA + engine descartado** | ok (reutiliza o engine) | **ok** (reutiliza o engine) |
| E5 — concorrência em cache frio (single-flight) | ok (1 build) | ok (1 build) | **ok** (1 build) |
| E6 — falha persistente (2 chamadas) | `ENOENT` persistente | `ENOENT` persistente | `ENOENT` persistente |

### 9.2 Causa

`getWorkbookFingerprint()` devolvia a string `'unavailable'` no `catch`. Como
`hfSourceFingerprint` guarda um valor real, a comparação falhava, o engine em
memória era descartado (`hfInstance = null`) e o carregamento era tentado de
novo — que também falhava. Antes da Fase 2 não havia `fs.stat` no caminho
aquecido, logo o cenário não existia.

### 9.3 Correção mínima aplicada na Sprint 2.1 (4 linhas)

Proposta original da Sprint 2.1, verificada primeiro numa cópia isolada e depois
**aplicada** ao arquivo real com autorização explícita — distinguir "impressão
digital desconhecida" (`null`) de "impressão digital alterada":

```ts
async function getWorkbookFingerprint(): Promise<string | null> {   // era Promise<string>
    ...  catch { return null; }                                     // era 'unavailable'
}

// guarda do engine em memória
if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined &&
    (fingerprint === null || hfSourceFingerprint === fingerprint)) {

// guarda do single-flight
if (loadingPromise && (fingerprint === null || loadingFingerprint === fingerprint)) return loadingPromise;
```

Verificada primeiro numa cópia isolada do arquivo (**E1–E6 todos ok**, preservando
a invalidação normal em E2 e o single-flight em E5) e depois **aplicada** ao
arquivo real. A revalidação da Sprint 2.3, executada contra o `route.ts` atual,
confirmou E1–E5 aprovados e E6 inalterado.

### 9.4 Dívida técnica separada (não é regressão da Fase 2)

`app/api/test-calculator/route.ts` mantém singleton próprio do mesmo workbook,
sem invalidação, e `isLoading` não é resetado em caso de erro (linhas 16 e 52,
sem `finally`). A rota é alcançável por `app/dashboard/tests/page.tsx`. Fica
registrada como dívida técnica independente — fora do escopo de Hanoi.

---

## 10. Histórico das sprints

Distinção explícita entre **alteração realizada** e **verificação executada depois**.

| Etapa | Natureza | O que foi feito |
|---|---|---|
| **Fase 2** | Implementação | Inclusão de Hanoi: `Tracks!Y68 = 37` (WS provisório), `Tyre&Fuel!D15` (ramo chuva até a linha 68), `RaceHistory` (315 fórmulas até a linha 68), `Planejamento` (validação `Yesno` restaurada nas 17 células), `data/tracks.json` (`194.320`, Wings base), bandeira `vn` nas duas tabelas e invalidação do cache do motor por impressão digital. |
| **Sprint 2.1** | Correção documental **+** correção funcional | **Documental (D1):** tamanho do XLSX no manifesto (`1639299` → `1308982`). **Documental (D2):** precisão das afirmações sobre o ZIP reempacotado. **Funcional (D3):** diferenciar impressão digital desconhecida (`null`) de alterada, aplicada em `app/api/python/[[...route]]/route.ts`. |
| **Sprint 2.2** | Correção de teste | Atualização da asserção 6.6 de `tests/hanoi-fase2.test.js` para a nova guarda de single-flight, mantendo a exigência da condição completa. Nenhuma alteração de implementação. |
| **Sprint 2.3** | Verificação (auditoria) | Auditoria integrada das fases anteriores: diff conferido, planilha comparada ao backup, manifesto conferido, **harness E1–E6 reexecutado** contra o `route.ts` real (E1–E5 aprovados, E6 inalterado) e emissão do gate de liberação com ressalvas documentais. |
| **Sprint 2.4** | Correção documental | Consolidação deste relatório com o estado real: status de D3, contagem de asserções, rótulos D1/D2, histórico das sprints, limitação do E6 e limitações de validação abertas. Nenhuma alteração funcional. |

---

## 11. Limitações de validação abertas

Registradas na auditoria da Sprint 2.3. São **limitações de validação**, não
falhas funcionais comprovadas.

1. **Rotas verificadas por replicação, não por HTTP.** As ações
   `/api/python/tracks` e `strategy_calculate` foram verificadas reproduzindo o
   laço do próprio handler e pelo motor HyperFormula sobre a planilha. Nenhuma
   requisição HTTP real foi feita — nenhum servidor foi iniciado.
2. **Sem validação em produção.** Não houve deploy; todo o resultado descrito é
   local (Node + HyperFormula + arquivos do repositório).
3. **O harness E1–E6 não está versionado.** Ele reside em `%TEMP%` e não é
   reproduzível após limpeza do diretório temporário. Foi executado nas Sprints
   2.1 e 2.3 sobre o `route.ts` real, mas não pode ser reexecutado a partir do
   repositório.
4. **`npx tsc --noEmit` e ESLint não foram executados na Sprint 2.3.** A sprint
   de auditoria não alterou código; as verificações estáticas registradas na §5
   são da Fase 2 (exit 0 no `tsc`; ESLint com 28 errors / 7 warnings, idênticos
   ao `HEAD`).
