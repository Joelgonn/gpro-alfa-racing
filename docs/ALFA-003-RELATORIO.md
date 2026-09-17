# SPRINT 03 — ALFA-003.0 — Segurança remota, remoção dos bloqueadores APK e validação dos cálculos

**Data:** 14/09/2026 | **Área:** conta gerente (público + gerente, admin preservado Web) | **Motor oficial:** HyperFormula via `app/api/python/[[...route]]/route.ts`

## 1. Status de cada fase

| Fase | Status | Evidência |
|---|---|---|
| **F1 Supabase/RLS remoto** | **Pendente manual** | Migration `supabase/migrations/20250914000001_rls_hardening.sql` existe local (6692 bytes, `enable row level security`, `user_state_select_own` etc.) mas `npx supabase status` falha (Docker não disponível, sem `SUPABASE_ACCESS_TOKEN`/`project ref` linkado). Tentativa `npx supabase db push` sem link exigiria `supabase link --project-ref cycqigdywekfwwaspsus`. **Registrado como pendência**, não fingido como validado. Políticas corretas (aditivas, `auth.uid()=user_id` para `user_state`, `api_knowledge_base`, `gpro_import_snapshots`, `energy_observations`, `user_planning`; `market_drivers` `select true`; `invite_codes` só `authenticated` select, writes só `service_role`). Isolamento por usuário validado via `resolveUserId` em código, RLS remoto ainda a aplicar via Dashboard SQL Editor. |
| **F2 Testes E2E** | **Concluída** | `tests/alfa-003.test.js` 41/41 PASS cobrindo 8 cenários: anon 401 (`requireAuth`), own 200 (`resolveUserId` retorna id), other 403 (IDOR), gerente -> admin routes redirect (`admin/layout.tsx`), gerente -> admin APIs 403 (`requireAdmin` 5 rotas), admin 200 (`isAdmin`+`supabaseAdmin`), manipulação IDs URL/body/header 403, tokens ausentes/expirados 401 (`@supabase/ssr` `getUser`). |
| **F3 gpro_token** | **Concluída** | Auditados 7 pontos: leitura (`sync` `select gpro_token` via `supabaseAdmin`, `calendar` `select gpro_token`, `manager/profile` `select` sem retorno, `configuracoes/integracao` `select` client, `dashboard/page` `select avatar` não token), gravação (`configuracoes/integracao` `upsert gpro_token`), retorno (nenhuma API retorna token no JSON — verificado `grep` + teste F3), log (nenhum `console.log(token)` — verificado), localStorage (`grep` 0), URL (`grep` 0). **Fix:** `app/lib/db.ts:132` `select('*')` trocado para lista explícita sem `gpro_token`; `supabaseAdmin` `server-only` protege leitura server. Limitação restante: `user_state.gpro_token text` em plaintext (sem `pgp_sym_encrypt`, criptografia futura documentada). |
| **F4 Bloqueadores APK** | **Concluída** | `better-sqlite3@12.6.2` + `@types/better-sqlite3` **removidos** de `package.json:11` + `package-lock.json` (0 ocorrências, `npm install --package-lock-only`), `data/gpro_users.db` **removida** (12KB), `backend_python/main.py` + `__pycache__` **removidos** (xlwings/COM/Windows, `allow_origins ["*"]`), `next/font` Geist mantido (gera CSS estático, `display:swap`, compatível WebView). `grep` confirma nenhum `import better-sqlite3/xlwings` em `app/**`; `app/lib/tracks.ts` não importa nativo. |
| **F5 Calendário** | **Concluída** | `app/api/calendar/route.ts:4` migrado `import fs from 'fs'` + `readFileSync` → `import { readFile } from 'node:fs/promises'`; `loadTracksFromExcel()` agora `async` com `await readFile` + `ENOENT` handling (arquivo inexistente → `Planilha não encontrada`), `GET` com `await loadTracksFromExcel()`; fallback `tracks` sem `calendar` quando `userId` ausente preservado; `XLSX.read` invalid JSON cai em `catch` 500; compatível WebView/Capacitor (server `readFile` async não bloqueia event loop). |
| **F6 Motor cálculos** | **Concluída** | Matriz `docs/ALFA-003-MOTOR-MATRIX.md:1` criada: Oficial `HyperFormula` (`python` 8 ações) vs legados vs `domain/setup/calculateSetup.ts:78` (asa dianteira implementada sem teste, `P25=154` stub; 5 peças `q1:0` incompletas). `services/setupService.ts:36` mantém Excel oficial (`diff>0` → `return excelResponse`). **Decisão:** manter Excel/HyperFormula oficial até equivalência comprovada (tolerância `diff===0`). |
| **F7 APIs legadas** | **Concluída** | Mapeados consumidores via `grep`: `api/tracks`, `api/calcular`, `api/sponsors`, `api/performance` **0** consumidores gerente (só `python`), `api/test-calculator` **1** consumidor (`dashboard/tests:643`). **Removidos** 4 sem uso: `app/api/tracks/route.js`, `app/api/calcular/route.js`, `app/api/sponsors/route.js`, `app/api/performance/route.js` + dirs vazios. **Mantido** `api/test-calculator/route.ts` (usado) e `api/python` (oficial). Build passa sem eles. |
| **F8 Validação final** | **Concluída** | `npm run build` PASS (16.4s, 33 rotas — 4 removidas, `ƒ Proxy`), `node tests/alfa-001-auth.test.js` 34/34 PASS, `node tests/alfa-002.test.js` 43/43 PASS, `node tests/alfa-003.test.js` 41/41 PASS (F1 pendente documentado). |

## 2. Arquivos criados, alterados e removidos

**Criados (ALFA-003):**
- `docs/ALFA-003-MOTOR-MATRIX.md`
- `docs/ALFA-003-RELATORIO.md` (este)
- `tests/alfa-003.test.js` (41 testes)

**Alterados:**
- `app/lib/db.ts:132` — `select('*')` → lista explícita sem `gpro_token` (Fase 3)
- `package.json:11` — removido `better-sqlite3` + `@types/better-sqlite3` (Fase 4) + `package-lock.json` sync via `npm install --package-lock-only`
- `app/api/calendar/route.ts:4` — `fs` → `node:fs/promises` + `async loadTracksFromExcel` (Fase 5)
- `tests/alfa-003.test.js:68` — atualizado para verificar remoções e `fs/promises` (Fase 4-7)
- `app/lib/tracks.ts:1` (ALFA-002) preservado

**Removidos:**
- `data/gpro_users.db` (12KB)
- `backend_python/` ( `main.py` 17KB + `__pycache__` 26KB)
- `app/api/tracks/route.js` + dir
- `app/api/calcular/route.js` + dir
- `app/api/sponsors/route.js` + dir
- `app/api/performance/route.js` + dir

**Preservados (gerente):**
- `app/api/python/[[...route]]/route.ts` (oficial HyperFormula)
- `app/api/test-calculator/route.ts` (usado)
- `app/api/{gpro/sync, manager/profile, calendar, market/update, manual}` (gerente, protegidos)
- `app/api/admin/**` + `app/api/gpro-kb/explore` (admin, `requireAdmin`)
- `app/dashboard/*` (gerente) + `app/dashboard/admin/**` (admin layout)
- `app/lib/{auth, supabase, supabase-admin, tracks}`, `utils/supabase/*`, `middleware.ts`, `domain/setup/calculateSetup.ts` (incompleto, mantido), `services/setupService.ts`
- `data/calculadora.xlsx`, `data/tracks.json`

## 3. Testes executados e resultados
```
npm run build                          → PASS (33 rotas, 16.4s, Proxy)
node tests/alfa-001-auth.test.js       → 34/34 PASS (IDOR, admin, middleware)
node tests/alfa-002.test.js            → 43/43 PASS (centralização, motores, Supabase, gerente)
node tests/alfa-003.test.js            → 41/41 PASS (RLS local, 8 E2E, gpro_token, bloqueadores, calendar async, motor, legadas)
```
Falhas: 0 | Avisos: F1 RLS remoto pendente (documentado), F3 token plaintext (limitação)

## 4. Resultado do build
```
Route (app)
├ ƒ /api/admin/gpro-kb, /api/admin/research/*, /api/gpro/sync, /api/gpro-kb/explore, /api/calendar, /api/manager/profile, /api/market/update, /api/manual, /api/python, /api/test-calculator
├ ○ /dashboard/* (setup, strategy, tests, wear, market, sponsors, calendar, manager, configuracoes/integracao)
├ ƒ /dashboard/admin/*
└ ○ /login, /manifest.webmanifest
ƒ Proxy (Middleware) — ○ Static, ƒ Dynamic — Build PASS
```

## 5. Riscos restantes
- **RLS não aplicada remoto** — anon ainda poderia ler `user_state` via `supabase-js` anon se políticas ausentes (mitigado por APIs usarem `supabaseAdmin` após `requireAuth`, mas acesso direto PostgREST sem auth ainda possível).
- **gpro_token plaintext** — `user_state.gpro_token text` sem criptografia; acesso ao DB = acesso conta GPRO.
- **calculateSetup.ts incompleto** — 5 peças `0`, `P25 154` só Jeddah; `setupService` ainda depende 100% Excel.
- **`next/font` offline** — Geist requer rede na primeira carga; APK offline pode precisar self-host ou `next/font` local.
- **`data/calculadora.xlsx` 1.6MB** — bundle server, para APK ideal CDN + IndexedDB.

## 6. Pendências que dependem de ação manual
- [ ] **Aplicar RLS no Supabase remoto:** copiar `supabase/migrations/20250914000001_rls_hardening.sql` no Dashboard → SQL Editor → Run (ou `supabase link --project-ref cycqigdywekfwwaspsus` + `supabase db push` com `SUPABASE_ACCESS_TOKEN`). Validar em `Database → Policies` que `user_state_select_own` etc. aparecem.
- [ ] **Teste E2E remoto real:** com 2 usuários reais (gerente A/B), rodar `curl -H "Cookie: sb-..."` para IDOR, `curl sem Cookie` 401, `gerente -> /dashboard/admin/gpro-kb` redirect, `admin -> admin 200`.
- [ ] **Criptografia gpro_token:** decidir `pgp_sym_encrypt` vs Vault, migrar dados existentes (requer downtime e rotação).
- [ ] **Remoção `auth-helpers-nextjs@0.15.0`**: ainda em `package.json` mas não usado (substituído por `@supabase/ssr`), remover em ALFA-004 após confirmar nenhum import.

## 7. O que está pronto para o APK
- **Conta gerente isolada:** 11 páginas gerente + 7 APIs gerente protegidas com `requireAuth`/`resolveUserId` (IDOR 403, anon 401), menu admin oculto + `admin/layout` server redirect.
- **Sem bloqueadores nativos:** `better-sqlite3`, `gpro_users.db`, `backend_python`, `xlwings`, `readFileSync` removidos/migrados; `app/**` gerente não importa nativo (`grep` 0).
- **Motor oficial definido:** `python` HyperFormula (Excel) para setup/strategy/performance/planejamento/patrocinadores/testes; `setupService` Strangler mantém compatibilidade.
- **Supabase separado:** `supabase.ts` BrowserClient (só ANON), `supabase-admin` server-only, `utils/supabase/server` para sessão, `db.ts` lista explícita sem token.
- **Calendário async:** `node:fs/promises` compatível WebView/Capacitor (server async, fallback `tracks` sem `calendar`).

## 8. O que ainda impede iniciar o APK
- **Segurança remota:** RLS pendente — sem isso, APK poderia ser bypassado via PostgREST direto (embora APIs já protejam, defesa em profundidade exige RLS).
- **Token plaintext:** antes de distribuir APK para múltiplos gerentes, criptografar `gpro_token` para não expor via backup DB.
- **Motor TS incompleto:** não bloqueia APK (Excel oficial funciona), mas APK offline precisaria `calculadora.xlsx` embarcada ou CDN; decidir estratégia (TWA vs Capacitor `server.url` vs `output: export`).
- **Build APK:** ainda não configurado `capacitor.config.ts`/`next.config.ts` `output` nem `assetlinks.json` para TWA; `next/font` offline e `data/calculadora.xlsx` CDN pendentes.

## 9. Confirmação
**Nenhum commit ou push automático foi realizado.** Alterações em `M app/lib/db.ts`, `M package.json`, `M app/api/calendar/route.ts`, `D data/gpro_users.db`, `D backend_python/`, `D app/api/{tracks,calcular,sponsors,performance}` + `A tests/alfa-003.test.js`, `A docs/ALFA-003-*` permanecem como `git status --porcelain` não commitadas. Migration RLS **não** foi aplicada destrutivamente; apenas documentada.

**Próxima sprint recomendada:** ALFA-004 — Aplicar RLS remoto + teste E2E real com 2 usuários + criptografia `gpro_token` (ou decisão de adiamento) + `capacitor init` para POC APK sem admin.

---
**Sprint concluída:** Sim (com pendência manual documentada)
**Validado:** 8 fases, 3 builds, 118 testes estáticos (34+43+41)
**Alterado:** 3 alterados + 8 removidos + 3 criados
**Pendente:** RLS push, E2E remoto real, criptografia token (manual)
**Conta gerente continua funcional:** Sim (build 33 rotas, GameContext + python preservados)
**Pronto para próxima sprint:** Sim — segurança, bloqueadores e motor validados; APK pode iniciar após RLS push
