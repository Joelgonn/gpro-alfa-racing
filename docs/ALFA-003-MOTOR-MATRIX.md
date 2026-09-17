# ALFA-003 — Matriz Motor de Cálculos (Excel vs HyperFormula vs TS)

**Data:** 14/09/2026 | **Oficial:** HyperFormula via `app/api/python/[[...route]]/route.ts` (Excel `data/calculadora.xlsx`)

## 1. Classificação `domain/setup/calculateSetup.ts`
| Peça | Q1 | Q2 | Race | Classificação | Cálculo TS | Oficial |
|---|---|---|---|---|---|---|
| Asa Dianteira | ✅  | ✅ | ✅ | **implementado, sem teste** | `talento*arred*-0.001349...`, `trackModifier` Indianápolis 0.39, `P25=154` stub, `V24/W24` com `rdAero/expTD`, `getTrackBaseValue` via `tracks.json` real | **Excel** |
| Asa Traseira | ❌ 0 | ❌ 0 | ❌ 0 | **incompleto** | `return 0` | **Excel** |
| Motor | ❌ 0 | ❌ 0 | ❌ 0 | **incompleto** | `return 0` | **Excel** |
| Freios | ❌ 0 | ❌ 0 | ❌ 0 | **incompleto** | `return 0` | **Excel** |
| Câmbio | ❌ 0 | ❌ 0 | ❌ 0 | **incompleto** | `return 0` | **Excel** |
| Suspensão | ❌ 0 | ❌ 0 | ❌ 0 | **incompleto** | `return 0` | **Excel** |
| P25 (N13+N19) | — | — | — | **stub** | `return 154` (Jeddah calibrado) TODO N13+N19 real | **Excel** |

**Diferença observada (setupService `compareResults`):**
- Para `Interlagos`, `talento 200`, `experiencia 50`, `tecnica 50`, `rdAero 0`, `expTD 50`, `Dry`:
  - Excel (HyperFormula) asa dianteira Q1 ≈ 312 (exemplo, varia por pista)
  - TS asa dianteira Q1 ≈ 308 (diff 4, dentro de tolerância? Não validado com `tracks.json` 463.966)
  - Outras peças diff = valor Excel (ex: 450) vs 0 => diff grande, **não equivalente**
- **Tolerância definida:** `diff === 0` para considerar equivalente; `diff > 0` => Excel oficial mantido (`setupService.ts:36` `if (diff > 0) console.log("Divergência")` e `return excelResponse`).

**Conclusão:** **Manter Excel/HyperFormula como oficial** até TS completar 5 peças + P25 dinâmico + testes comparativos com `tracks.json` 72 pistas.

## 2. Motores mapeados (oficial vs legados)
| Domínio | Oficial (gerente) | Legados (não removidos ou removidos) | HyperFormula? | Excel? |
|---|---|---|---|---|
| Setup | `python:setup_calculate` | `api/calcular/route.js` **removido ALFA-003**, `backend_python:calculate_setup` **removido** | ✅ | `Setup&WS` |
| Strategy | `python:strategy_calculate` | `backend_python:calculate_strategy` **removido** | ✅ | `Tyre&Fuel` |
| Performance | `python:performance` | `api/performance/route.js` **removido ALFA-003**, `api/test-calculator` **mantido** (usado por `tests/page.tsx:643`) | ✅ | `Setup&WS` V24-28 |
| Desgaste | `python` wear (J/K, `desgasteModifier` C4) + `planning_calculate` + `test_calculate` | `calculateSetup.ts` P25 stub | ✅ | `Setup&WS` K, `Tyre&Fuel` |
| Planejamento | `python:planning_calculate` + `save_planning` (`user_planning`) | — | ✅ | `Planejamento` |
| Patrocinadores | `python:sponsors` (Patrocinador O37:T43) | `api/sponsors/route.js` **removido ALFA-003** | ✅ | `Patrocinador` |
| Testes | `python:test_calculate` | `api/test-calculator/route.ts` **mantido** (duplicata usada) | ✅ | `Tyre&Fuel` G21:N21 |
| Tracks | `python:tracks` | `api/tracks/route.js` **removido ALFA-003` | ✅ | `Tracks` A4:W |

**Validação consumidores (gerente):**
- `grep -r "/api/(tracks|calcular|sponsors|performance)" app/dashboard` → **0** (nenhum uso direto, só `python`)
- `grep -r "/api/test-calculator"` → **1** `app/dashboard/tests/page.tsx:643` (mantido)
- `grep -r "backend_python"` → 0 em `app/**` (isolado)

## 3. Riscos e próximos passos
- Completar `calculateSetup.ts` 5 peças + `calculateP25` real (N13+N19 = `I6*B13...` + `J6*B19...`) + testes com `compareResults` assertivo (não só log) em ALFA-004.
- `next/font` Geist: compatível WebView (gera CSS estático), offline requer `display:swap` já em `layout.tsx:8` — OK.
- `data/calculadora.xlsx` 1.6MB: para APK, servir via CDN + cache `IndexedDB` em vez de `fs.readFile` a cada request.

## 4. Decisão
**Excel/HyperFormula permanece oficial para conta gerente até equivalência comprovada.**
