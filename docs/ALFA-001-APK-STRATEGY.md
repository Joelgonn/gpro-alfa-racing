# ALFA-001 — Estratégia APK (Fase 6)

## Objetivo
Documentar separação entre área do piloto (WEB + futuro APK) e área administrativa (somente WEB + admin), e dependências que impactam a futura geração do APK Android.

## Área do Piloto — WEB + FUTURO APK
Estas rotas e APIs devem ser embarcadas no APK. Todas exigem autenticação (`requireAuth`) e validação de IDOR, mas NÃO exigem papel admin.

**Páginas (App Router):**
- `/` e `/login` (públicas)
- `/dashboard` (Visão Geral)
- `/dashboard/setup` (Setup Calculadora)
- `/dashboard/strategy` (Estratégia)
- `/dashboard/manual` (Setup Manual)
- `/dashboard/tests` (Testes)
- `/dashboard/wear` (Planejamento)
- `/dashboard/market` (Mercado de Pilotos)
- `/dashboard/sponsors` (Patrocinadores)
- `/dashboard/calendar` (Calendário — tracks públicos, calendário autenticado)
- `/dashboard/manager` (Gerente)
- `/dashboard/configuracoes/integracao` (Integração GPRO — armazena gpro_token)

**APIs piloto (requerem `requireAuth` + resolveUserId):**
- `POST /api/gpro/sync` — sync GPRO (user só acessa próprio gpro_token)
- `GET/POST /api/python/[[...route]]` — motor HyperFormula (get_state, update_state, setup_calculate, strategy_calculate, performance, planning_calculate, get_planning/save_planning)
- `GET /api/manager/profile` — perfil
- `GET /api/calendar` — tracks públicos, calendar autenticado
- `POST /api/market/update` — GET público, POST requer auth (sincroniza market_drivers via service_role)
- `GET /api/tracks`, `POST /api/sponsors`, `POST /api/test-calculator`, `POST /api/manual`, `POST /api/calcular` — cálculos stateless (públicos ou auth leve)

**Componentes piloto:**
- `app/context/GameContext.tsx` (fonte única verdade)
- `app/components/*` exceto `research/`
- `app/lib/db.ts`, `app/lib/supabase.ts`, `utils/supabase/server.ts`
- `domain/setup/calculateSetup.ts`, `services/setupService.ts`, `utils/compareResults.ts`

## Área Administrativa — SOMENTE WEB + ADMIN
Estas rotas e APIs NÃO devem ser embarcadas no APK. Exigem `requireAdmin` (sessão + role=admin).

**Páginas:**
- `/dashboard/admin/gpro-kb` (Knowledge Center / GPRO Explorer)
- `/dashboard/admin/research` (Research Hub)
- `/dashboard/admin/research/fuel`
- `/dashboard/admin/research/tyres`
- `/dashboard/admin/research/driver-energy`
- Qualquer futura `/dashboard/admin/*`

**APIs administrativas (`requireAdmin`):**
- `GET/POST/DELETE /api/admin/gpro-kb`
- `POST /api/gpro-kb/explore` (Explorer single endpoint) — admin only
- `GET /api/admin/research/fuel`
- `GET /api/admin/research/tyres`
- `GET /api/admin/research/driver-energy`

**Libs administrativas (não embarcar no APK):**
- `app/lib/knowledge-base.ts`, `knowledge-base-db.ts`, `knowledge-base-api.ts`
- `app/lib/capture.ts`, `observation.ts`, `fingerprint.ts`, `gpro-snapshot.ts`, `observation-pipeline.ts`, `knowledge-*`, `discovery-*`, `gpro-api.ts`, `research/research-variable-catalog.ts`
- `app/components/research/*` (28 arquivos)
- `app/lib/gpro-client.ts` (legado)

## Proteção implementada em ALFA-001.0
1. **Middleware** (`middleware.ts` + `utils/supabase/middleware.ts`): atualiza sessão via `@supabase/ssr` em todas as rotas (exceto estáticos). Não bloqueia, apenas sincroniza cookies.
2. **Auth server-side** (`app/lib/auth.ts`): `requireAuth`, `requireAdmin`, `resolveUserId`, `isAdmin` via `supabaseAdmin` (service_role). Todas as APIs críticas agora chamam `requireAuth`/`requireAdmin` e validam `header user-id` contra `auth.uid()` (IDOR).
3. **Layout admin** (`app/dashboard/admin/layout.tsx`): Server Component que verifica `auth.getUser()` e `user_state.role === 'admin'`, redireciona para `/login` ou `/dashboard?error=admin_required`.
4. **Menu** (`app/dashboard/layout.tsx`): `menuGroups.filter(g => g.id !== 'administration' || localRole === 'admin')` — admin oculto no frontend para piloto, mas proteção real é server-side.
5. **RLS** (`supabase/migrations/20250914000001_rls_hardening.sql`): Políticas para `user_state`, `api_knowledge_base`, `gpro_import_snapshots`, `invite_codes`, `energy_observations`, `user_planning`, `market_drivers`. Service_role bypassa, frontend nunca escreve direto com anon.

## Dependências que impedem APK hoje
- `better-sqlite3@12.6.2` (nativo Node, incompatível WebView/Android) — migração pendente para `@capacitor-community/sqlite` ou IndexedDB.
- `backend_python/main.py` (xlwings + COM, exige Windows/Excel) — já isolado, não usado em prod, mas não deve ser empacotado. `data/calculadora.xlsx` (~MB) aumenta bundle; servir via CDN + cache IndexedDB seria melhor para APK.
- `hyperformula@3.1.1` + `exceljs@4.4.0` funcionam em WebView, mas `fs.readFileSync` em `app/api/calendar/route.ts` bloqueia; no APK deve usar `Capacitor Filesystem`.
- `framer-motion@12.40.0` OK, mas `blur-2xl` pode causar overdraw em devices mid-range.
- `next/font` Geist requer rede; APK offline precisa self-host.

## Decisões para sprints futuras
1. **ALFA-002**: completar `domain/setup/calculateSetup.ts` ou fixar `USE_EXCEL=true`, centralizar `TRACK_FLAGS`/`TYRE_SUPPLIERS`, remover `backend_python`.
2. **Estratégia APK**: escolher entre **TWA (Trusted Web Activity)** — mais rápido, apenas wrapper da URL com `assetlinks.json` — vs **Capacitor (`npx cap add android` com `webDir: out`)** — requer `output: 'export'` ou `server.url`. Recomendado: TWA para MVP, Capacitor se precisar de APIs nativas (Push, Filesystem).
3. **Build APK**: configurar `next.config.ts` com `output: 'export'` ou manter SSR e usar `capacitor.config.ts` `server.url: https://...vercel.app`. Nunca embarcar `app/dashboard/admin/*` nem libs `research/` no bundle APK (usar `expo`/`webpack` split ou `capacitor` `bundledWebRuntime: false` + `allowNavigation`).
4. **Testes APK**: BrowserStack (Pixel 7, iPhone SE) + `playwright` E2E `sync -> setup -> strategy`.

## Como impedir que admin seja embarcado no APK
- **Separação física**: manter admin em `app/dashboard/admin/**` (já está). No `capacitor.config.ts` futuro, configurar `webDir` para `out` gerado com `next build` que inclui tudo, mas no CI filtrar: `rm -rf out/dashboard/admin` antes de `npx cap copy`, ou usar `next.config.ts` `rewrites` para bloquear `/dashboard/admin/:path` no APK.
- **Separação lógica**: criar flag `NEXT_PUBLIC_APK_BUILD=true` e em `app/dashboard/layout.tsx` condicionar `menuGroups` e em `middleware.ts` bloquear `if (process.env.NEXT_PUBLIC_APK_BUILD && request.nextUrl.pathname.startsWith('/dashboard/admin')) return NextResponse.redirect(new URL('/dashboard', request.url))`.
- **Separação de APIs**: no APK, `NEXT_PUBLIC_SUPABASE_URL` aponta para mesmo backend, mas backend já protege com `requireAdmin`; piloto com role `user` receberá 403 se tentar chamar admin API, mesmo se bundle contiver código.

## Checklist para não quebrar piloto ao evoluir admin
- Nunca mover `GameContext`, `db.ts`, `python` route para admin; manter piloto independente.
- Nunca fazer admin depender de libs piloto de forma circular.
- Toda nova rota admin deve estar sob `/dashboard/admin` e usar `requireAdmin`.
- Toda nova API admin deve estar sob `/api/admin` e usar `requireAdmin`.
