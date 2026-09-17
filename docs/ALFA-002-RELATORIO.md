# SPRINT 02 — ALFA-002.0 — HIGIENE DA ARQUITETURA E MOTOR

## 1. Resumo da sprint
Sprint de higiene sem redesign amplo, sem APK, sem laboratórios. Objetivos: centralizar constantes GPRO, auditar motores, classificar `calculateSetup.ts`, mapear dependências incompatíveis APK, eliminar padrão híbrido Supabase e preservar conta gerente. **Nomenclatura atualizada**: conta gerente (não piloto), área do gerente, APIs do gerente.

## 2. Pré-condição
- Migration `20250914000001_rls_hardening.sql` **pendente** (local existe, não aplicada no remoto) — registrada, não fingida.
- Testes ALFA-001: **PASS** (34/34).
- Build: **PASS** (37 rotas).
- Git status com alterações ALFA-001 não commitadas — nenhum commit/push automático.

## 3. Fase 1 — Validação ALFA-001
- `requireAuth`/`requireAdmin`/`resolveUserId`/`isAdmin`/`middleware`/`supabase-admin` validados via `tests/alfa-001-auth.test.js` (ainda PASS).
- Proteção IDOR em 7 APIs confirmada.
- Separação gerente (`/dashboard/*` exceto `admin`) vs admin (`/dashboard/admin/*` + `/api/admin/*`) confirmada.
- **Correção feita nesta sprint**: `app/lib/db.ts` híbrido eliminado (ver Fase 6).

## 4. Fase 2 — Centralização
- **Criado** `app/lib/tracks.ts:1` com `TRACK_FLAGS` (63), `getTrackFlag()` (case-insensitive + aliases), `TYRE_SUPPLIERS` (7 canônico), `TYRE_SUPPLIERS_LEGACY` (9) + `TYRE_SUPPLIER_IMAGES`.
- **Migradas**: `app/context/GameContext.tsx:162` (re-export), `app/lib/db.ts:4` (re-export), `app/dashboard/{page,setup,strategy,tests,manager}/page.tsx`, `app/api/calendar/route.ts:9` (`getTrackFlag`). Valores não alterados; `tests`/`strategy` mantêm legado 9 via import central para não quebrar cálculo.

## 5. Fase 3 — Auditoria motores
| Cálculo | Oficial | Legados (mapeados, não removidos) |
|---|---|---|
| Setup | `python:setup_calculate` (HyperFormula, `Setup&WS`) | `api/calcular/route.js`, `backend_python:calculate_setup` |
| Strategy | `python:strategy_calculate` | `backend_python:calculate_strategy` |
| Performance | `python:performance` | `api/performance/route.js`, `api/test-calculator/route.ts` |
| Desgaste | `python` wear (J/K, Tyre&Fuel C4, planning) | `calculateSetup.ts` P25 stub |
| Planejamento | `python:planning_calculate` + `user_planning` | — |
| Patrocinadores | `python:sponsors` | `api/sponsors/route.js` |
| Testes | `python:test_calculate` | `api/test-calculator/route.ts` |
| Tracks | `python:tracks` | `api/tracks/route.js` |

**Dependências**: `hyperformula@3.1.1`+`exceljs@4.4.0`+`data/calculadora.xlsx` via `ExcelJS`+`buildFromSheets`+`Mutex`; `fs.readFileSync` só em `calendar` (bloqueante); `backend_python` exige Windows/COM.

## 6. Fase 4 — calculateSetup.ts
- **Asa Dianteira Q1/Q2/Race**: implementado, sem teste — `P25=154` hardcoded (TODO N13+N19), `M25` com `talento`, `V24/W24` com `rdAero/expTD`, `trackBase` via `tracks.json` real, `mround`.
- **Asa Traseira/Motor/Freios/Câmbio/Suspensão**: incompleto (`q1:0`).
- **Decisão**: manter `services/setupService.ts` Strangler (Excel oficial, TS shadow com `compareResults`), não promover TS.

## 7. Fase 5 — Dependências APK
- `better-sqlite3@12.6.2` (`package.json:16`) — **não usado** em `app/**` (grep 0), `data/gpro_users.db` 12KB existe mas não lido — **remoção proposta ALFA-003**, não removido agora.
- `backend_python/main.py:6` `xlwings` `xw.App(visible=False)` — isolado, não usado em prod — **remoção proposta**.
- `fs.readFileSync` — só `calendar:52` — **migração para `fs/promises` proposta**.
- Conta gerente **não depende** de nativas; `lab` admin fora do APK por `dashboard/admin` + `api/admin` separation (docs/ALFA-001-APK-STRATEGY).

## 8. Fase 6 — Limpeza Supabase
- **Antes**: `db.ts:7` `SERVICE_ROLE || ANON`.
- **Depois**: `db.ts:6` só `ANON` + comentário `Browser-safe`; `supabase.ts:1` `createBrowserClient` (só ANON, sincroniza cookies); `supabase-admin.ts:1` `server-only` + `utils/supabase/server.ts:1` `createServerClient` para sessão. Todas as APIs gerente usam `requireAuth`/`resolveUserId` e `supabaseAdmin` para writes; nenhuma retorna `gpro_token`.

## 9. Fase 7 — Testes
- **Novos**: `tests/alfa-002.test.js` — 10 grupos, **43/43 PASS** (setup, strategy, performance, planejamento, desgaste, constantes, proteção APIs, fluxo gerente, nativas, segredos).
- **Existentes**: `tests/alfa-001-auth.test.js` — **34/34 PASS**.
- **Build**: `npm run build` — **PASS** (16.4s, 37 rotas, `ƒ Proxy (Middleware)`).

## 10. Arquivos
**Criados:** `app/lib/tracks.ts`, `docs/ALFA-002-DIAGNOSTICO.md`, `docs/ALFA-002-RELATORIO.md`, `tests/alfa-002.test.js`
**Modificados:** `app/context/GameContext.tsx`, `app/lib/db.ts`, `app/lib/supabase.ts`, `app/dashboard/{page,setup,strategy,tests,manager}/page.tsx` (5), `app/api/calendar/route.ts`
**Preservados:** `domain/setup/calculateSetup.ts`, `services/setupService.ts`, `app/api/python/[[...route]]/route.ts` (oficial), `backend_python/main.py` (isolado), `app/api/{calcular,sponsors,performance,test-calculator,tracks}/route.*` (legados mapeados), `app/dashboard/{wear,market,sponsors,calendar,manual}` (gerente), `app/dashboard/admin/**` (admin, sem alteração funcional), `middleware.ts`, `supabase/migrations/20250914000001_rls_hardening.sql`

## 11. Riscos restantes
- RLS ainda não aplicada no remoto (pendência).
- `calculateSetup.ts` incompleto — 5 peças retornam 0; P25 stub 154 só calibrado para Jeddah.
- `better-sqlite3`/`gpro_users.db`/`backend_python` ainda no repo (aumentam bundle, não usados).
- `fs.readFileSync` em `calendar` (bloqueante).
- `middleware` deprecation warning (Next 16.1 prefere `proxy`).

## 12. Pendências próxima sprint (ALFA-003.0)
- Aplicar RLS migration no remoto + teste E2E IDOR real.
- Remover `better-sqlite3` + `gpro_users.db` + `backend_python` após confirmar não usados (ou isolar fora do `webDir` APK).
- Migrar `calendar` para `fs/promises`.
- Completar `calculateSetup.ts` 5 peças + testes vs Excel com `compareResults` assert.
- Consolidar `api/*` legados (`calcular`, `sponsors`, `performance`, `tracks`) — deletar após confirmar frontend só usa `python`.

## 13. Conclusão
- **Sprint concluída:** Sim.
- **Validado:** Centralização (6 páginas), motores oficiais mapeados, `calculateSetup` classificado, nativas mapeadas, híbrido Supabase eliminado, testes 77/77 PASS, build PASS, conta gerente funcional (GameContext + 5 páginas + python).
- **Alterado:** 1 novo lib (`tracks.ts`) + 7 arquivos migrados para central + 2 docs + 1 teste + limpeza `db.ts`/`supabase.ts`.
- **Pendente:** RLS push, remoção nativas, `calculateSetup` completo (documentados, não bloqueiam gerente).
- **Conta gerente continua funcional:** Sim — `npm run build` e fluxo `useGame`/`getUserState`/`python` preservados.
- **Pronto para próxima sprint:** Sim — ALFA-002 não quebrou gerente, estabeleceu higiene para APK.

**Nenhum commit ou push automático foi realizado.**
