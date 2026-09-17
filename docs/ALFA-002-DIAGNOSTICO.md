# ALFA-002 — Diagnóstico (Pré-condição e Fases 1-6)

**Data:** 14/09/2026 | **Sprint:** ALFA-002.0 — Higiene da Arquitetura e Motor | **Modo:** Sem commit/push

## Pré-condição obrigatória
- **Migration `20250914000001_rls_hardening.sql`**: **Não aplicada no Supabase remoto** (verificado: `Test-Path supabase/migrations/20250914000001_rls_hardening.sql` = True local, mas sem `supabase link`/`db push`; nenhuma política verificável via `pg_policies`). **Pendência registrada**, não fingida como validada.
- **Testes ALFA-001**: `node tests/alfa-001-auth.test.js` — 34/34 PASS (IDOR, admin, middleware, RLS migration existente).
- **Build**: `npm run build` — PASS (Turbopack 16.4s, 37 rotas, `ƒ Proxy (Middleware)`).
- **Git status**: `M app/api/*`, `M app/dashboard/*`, `M app/lib/*` (alterações ALFA-001 não commitadas) — nenhum push automático.

## Fase 1 — Validação ALFA-001
- `app/lib/auth.ts:1` — `requireAuth` (401), `requireAdmin` (403), `resolveUserId` (IDOR 403), `isAdmin` via `supabaseAdmin` ok.
- `app/api/gpro/sync`/`python`/`admin/gpro-kb`/`gpro-kb/explore`/`manager/profile`/`calendar`/`research/*`/`market/update` — todos agora validam via `requireAuth/requireAdmin`; header `user-id` comparado com `auth.uid()`; `supabaseAdmin` isolado `server-only`.
- `middleware.ts:1` + `utils/supabase/middleware.ts:1` — `updateSession` existe, matcher correto; `app/lib/supabase.ts:1` agora `createBrowserClient` (só ANON), `supabase-admin.ts` `server-only`.
- `app/dashboard/admin/layout.tsx:1` — Server Component com `role !== 'admin'` + redirect; `dashboard/layout.tsx:262` filtra menu `localRole === 'admin'` (frontend).
- **Falha encontrada e corrigida nesta sprint**: `app/lib/db.ts:7` ainda híbrido `SERVICE_ROLE || ANON` — corrigido para só `ANON` (ver Fase 6).

## Fase 2 — Centralização
- **Duplicações encontradas**: `TRACK_FLAGS` em 5 páginas gerente (`dashboard/page:18`, `setup:18`, `strategy:29`, `tests:16`, `manager:17`) — 63 entradas idênticas; `TYRE_SUPPLIERS` em `GameContext:162` (7) vs `tests:18`/`strategy:44` (9 divergentes); `MAPA_BANDEIRAS` em `calendar:9` (lowercase + aliases).
- **Solução**: criado `app/lib/tracks.ts:1` com `TRACK_FLAGS` canônica, `getTrackFlag()` helper (case-insensitive + aliases `a1 ring`, `magny-cours`, `monaco`), `TYRE_SUPPLIERS` (7 canônico), `DEFAULT_TYRE_SUPPLIERS` alias, `TYRE_SUPPLIERS_LEGACY` (9) + `TYRE_SUPPLIER_IMAGES` + `getTyreSuppliers()`. Migradas 6 páginas/APIs para importar; valores preservados (não alterados) — `tests`/`strategy` continuam com 9 legado para não quebrar, mas via import central.

## Fase 3 — Motores de cálculo
| Cálculo | Motor oficial (gerente) | Duplicações/Legados | Dependências | Status |
|---|---|---|---|---|
| **Setup** | `app/api/python/[[...route]]:666` `setup_calculate` (HyperFormula + Excel `Setup&WS` R5, T7-9, E6, I6:J16, AC6:AE11, J/K wear) + `Mutex` | `app/api/calcular/route.js:115` (duplica setup, mesmo Excel, sem auth) | `hyperformula@3.1.1`, `exceljs@4.4.0`, `data/calculadora.xlsx` (Leitura em `getHyperFormulaInstance` via `ExcelJS` + `buildFromSheets`) | Oficial validado, legado mapeado não removido nesta sprint |
| **Strategy** | `python:895` `strategy_calculate` (Tyre&Fuel C3-7, G21:N21, S/T 20-25, etc.) | `backend_python/main.py:288` `calculate_strategy` (xlwings, COM) | Mesmo Excel + `async-mutex` | Oficial python, backend_python isolado Windows |
| **Performance** | `python:831` `performance` (M,N,O,P + V24-28 ZS) | `app/api/performance/route.js:93` + `app/api/test-calculator/route.ts:56` (duplicam) | HyperFormula | Oficial python, legados mapeados |
| **Desgaste** | `python` `setup_calculate` wear col J/K + `planning_calculate` `wear/final` + `test_calculate` `test_wear` | `domain/setup/calculateSetup.ts:78` `P25=154` stub | Incluso em setup | Oficial python |
| **Planejamento** | `python:406` `planning_calculate` (Planejamento R8/40/72, `supabaseAdmin.from('user_planning')`) | Nenhum | `Hyperformula` + `user_planning` | Oficial |
| **Patrocinadores** | `python:460` `sponsors` (Patrocinador O37:T43, Tables AC28:AD30) | `app/api/sponsors/route.js:101` (mesma lógica) | Excel | Oficial python, legado mapeado |
| **Testes** | `python:764` `test_calculate` | `app/api/test-calculator/route.ts:56` (mesma injeção Setup&WS + Tyre&Fuel) | HyperFormula | Oficial python |
| **Tracks** | `python:262` `tracks` (Tracks A4:W) | `app/api/tracks/route.js:5` (A4:A67) | Excel | Oficial python |

**Dependências Excel**: `data/calculadora.xlsx` lido via `ExcelJS` + `HyperFormula` singleton em `python` e `performance`/`calcular`/`tracks`/`test-calculator` (todos com `readFile` async exceto `calendar` que usa `readFileSync` bloqueante). **Compatibilidade APK**: `HyperFormula`/`ExcelJS` funcionam em WebView, mas `fs` e `better-sqlite3` não.

## Fase 4 — calculateSetup.ts
- **Local**: `domain/setup/calculateSetup.ts:1` (312 linhas, importa `data/tracks.json`).
- **Asa Dianteira Q1/Q2/Race**: **implementado, mas sem teste** — fórmulas `talento*arred*-0.001349...`, `trackModifier` Indianópolis 0.39, `P25` stub, `V24/W24` com `rdAero/expTD`; `getTrackBaseValue` via `PROCV` real (`tracks.json`); classificação `mround`, `round`.
- **Asa Traseira, Motor, Freios, Câmbio, Suspensão**: **incompleto** — retornam `{q1:0,q2:0,race:0}` (`:286-311`).
- **Outros**: `calculateP25()` incompleto (hardcoded 154, TODO N13+N19).
- **Decisão segura**: Manter `services/setupService.ts:11` como **Strangler Fig** — Excel (`/api/python?action=setup_calculate`) oficial, TS apenas shadow com `compareResults` e logs; não promover TS até completar 5 peças + testes vs Excel.

## Fase 5 — Dependências incompatíveis APK
- **`better-sqlite3@12.6.2`** (`package.json:16` + `@types/better-sqlite3:32`) — **não importado** em `app/**` (`grep` 0), apenas `package.json`; `data/gpro_users.db` (12KB, 31/01/2026) existe mas não lido; **uso real: nenhum na conta gerente**; proposta: remover em ALFA-003.
- **`backend_python/main.py:6`** `import xlwings as xw` + `xw.App(visible=False)` (`:56`) + `allow_origins ["*"]` (`:16`) — exige Windows+Excel COM, `__pycache__` presente; **uso: nenhum em prod** (Vercel usa `python` HyperFormula); proposta: remover ou isolar, não empacotar.
- **`fs.readFileSync`** — uso real apenas `app/api/calendar/route.ts:52` (`readFileSync` bloqueante) — gerente usa mas bloqueia event loop; HyperFormula já usa async; proposta: migrar para `fs/promises` ou cache.
- **`data/calculadora.xlsx`** — ~MB, carregado em 4 rotas legadas + `python`; no APK aumenta bundle, melhor CDN + IndexedDB cache.
- **Conclusão**: nenhuma dependência nativa é usada diretamente pela conta gerente, exceto `fs` em calendar (facilmente substituível); `better-sqlite3`/`xlwings` são mapeados para remoção proposta, não removidos agora por segurança.

## Fase 6 — Limpeza Supabase
- **Antes**: `app/lib/db.ts:7` `SERVICE_ROLE || ANON` híbrido; `app/lib/supabase.ts:1` `createClient` anon mas sem `createBrowserClient`; `supabase-admin.ts` ok `server-only`.
- **Depois**: `db.ts:6` agora **só `NEXT_PUBLIC_SUPABASE_ANON_KEY`** + comentário `Browser-safe — service_role só via supabase-admin`; `supabase.ts:1` agora `createBrowserClient` (sincroniza cookies com `utils/supabase/server.ts`), `supabase-admin.ts` e `utils/supabase/server.ts` permanecem server-only. Separação clara: browser=ANON, server session=`utils/supabase/server`, service_role=`supabase-admin`.
- **APIs**: todas as 7 corrigidas já usam `supabaseAdmin` para writes privilegiados (`user_planning`, `market_drivers`) + `requireAuth` para leitura própria; nenhuma retorna `gpro_token`.

## Riscos para Fase 7
- Build e testes estáticos passam, mas `npm run build` ainda mostra `middleware deprecated` (Next 16.1 prefere `proxy` — não bloqueante).
- `calculateSetup.ts` ainda sem testes vs Excel; `compareResults` loga diff mas sem `assert`.
