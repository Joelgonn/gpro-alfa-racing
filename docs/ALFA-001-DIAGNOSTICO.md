# ALFA-001 — Diagnóstico Fase 1

## Arquivos envolvidos (verificados)
- `app/lib/db.ts` — híbrido `SERVICE_ROLE || ANON`, logs verbose
- `app/lib/supabase.ts` — anon client, usado em GameContext
- `app/lib/knowledge-base-db.ts` — server-only, service_role, OK
- `app/lib/supabase-admin.ts` — **criado** em ALFA-001, isola service_role
- `app/lib/auth.ts` — **criado**, `requireAuth/requireAdmin/resolveUserId/isAdmin`
- `utils/supabase/server.ts` + `middleware.ts` — **criados**, `@supabase/ssr`
- `middleware.ts` — **criado**, atualiza sessão
- `app/api/gpro/sync/route.ts` — usava `body userId` sem validação
- `app/api/python/[[...route]]/route.ts` — usava `header user-id` sem validação, `supabase` híbrido
- `app/api/admin/gpro-kb/route.ts` — usava `header user-id` sem admin check
- `app/api/gpro-kb/explore/route.ts` — usava `body userId` sem validação
- `app/api/manager/profile/route.ts` — `header user-id` sem validação
- `app/api/calendar/route.ts` — `?userId` sem validação, `getUserToken` service_role OK
- `app/api/admin/research/{fuel,tyres,driver-energy}/route.ts` — `header user-id` sem admin
- `app/api/market/update/route.ts` — `POST` sem auth, `GET` público OK, usava `supabase` anon para delete/insert
- `app/dashboard/layout.tsx` — `use client`, menu admin sempre visível
- `app/dashboard/admin/**` — sem layout de proteção server-side
- `app/actions/signup.ts` — `Math.random` previsível, sem transação atômica invite
- `app/actions/admin.ts` — `Math.random`, checagem admin OK mas código fraco
- `.env.local` — contém `SUPABASE_SERVICE_ROLE_KEY`, `GPRO_TOKEN`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `.gitignore:38` protege, `git log --all -- .env*` não mostra histórico exposto
- `supabase/migrations` — **não existia**, RLS desconhecida (nenhuma pasta, nenhum .sql)

## Problemas confirmados (reproduzíveis)
- **P1 IDOR**: `curl -H "user-id: <uuid-alheio>"` em `/api/gpro/sync`, `/api/python`, `/api/admin/gpro-kb` retorna dados de outro usuário (validado via código, não via execução remota, mas padrão idêntico em 7 rotas)
- **P2 Sem middleware**: `glob middleware.ts` vazio, `GameContext.tsx:587` só client-side redirect
- **P3 Tokens plaintext**: `user_state.gpro_token` coluna `text`, `select('gpro_token')` em sync/explore/calendar/profile, nenhum `pgp_sym_encrypt`
- **P4 Sem RLS versionada**: `glob supabase/**/*` vazio, nenhuma migration, políticas não verificáveis
- **P5 Admin sem proteção server**: `dashboard/admin/*` acessível via URL direta mesmo para `role=user` (nenhum `layout.tsx` admin)
- **P6 Invite fraco**: `admin.ts:25` `Math.random().toString(36)` previsível, `signup.ts:28-55` sem `FOR UPDATE`

## Problemas prováveis (não executados em prod, mas inferência forte)
- RLS desabilitada ou permissiva (pois nenhuma migration e APIs usavam `SERVICE_ROLE` bypass)
- `better-sqlite3` pode estar commitado com `data/gpro_users.db` (existe arquivo, `package.json` inclui dep)

## Problemas não reproduzidos
- Vazamento de `GPRO_TOKEN` no histórico Git — `git log --all --oneline --name-only -- .env*` não retornou commits (protegido desde início)
- Exposição de `SUPABASE_SERVICE_ROLE_KEY` no bundle cliente — `app/lib/db.ts:6` fallback `SERVICE_ROLE || ANON` poderia vazar se `db.ts` fosse importado em client, mas `supabase.ts` é o client usado em `GameContext`, `db.ts` é usado via `getUserState` que rota usa `SERVICE_ROLE` mas `GameContext` importa `supabase` de `supabase.ts` (anon), não de `db.ts` — não confirmado vazamento, mas risco arquitetural

## Informação que precisa de acesso adicional
- Políticas RLS reais no Supabase remoto (requer `supabase link` ou SQL `select * from pg_policies`)
- Conteúdo de `data/gpro_users.db` (não inspecionado)
- Validação de `gpro_token` criptografia (requer decisão produto e migração de dados)

## Plano de correção (executado)
- Criar `auth.ts` + `supabase-admin.ts` + `utils/supabase/*` + `middleware.ts`
- Corrigir 7 APIs para `requireAuth/requireAdmin` + `resolveUserId`
- Proteger `POST market/update` com `requireAuth`
- Criar `app/dashboard/admin/layout.tsx` server + filtrar menu `localRole === 'admin'`
- Criar `supabase/migrations/20250914000001_rls_hardening.sql` (aditiva, não destrutiva)
- Trocar `Math.random` por `crypto.randomUUID` em `admin.ts`
- Documentar APK strategy e diagnóstico
- Remover stack trace de `python` POST erro, manter logs sem token

## Arquivos alterados (ALFA-001)
- Criados: `utils/supabase/server.ts`, `utils/supabase/middleware.ts`, `app/lib/supabase-admin.ts`, `app/lib/auth.ts`, `middleware.ts`, `app/dashboard/admin/layout.tsx`, `supabase/migrations/20250914000001_rls_hardening.sql`, `docs/ALFA-001-APK-STRATEGY.md`, `docs/ALFA-001-DIAGNOSTICO.md`
- Modificados: `app/api/gpro/sync/route.ts`, `app/api/python/[[...route]]/route.ts`, `app/api/admin/gpro-kb/route.ts`, `app/api/gpro-kb/explore/route.ts`, `app/api/manager/profile/route.ts`, `app/api/calendar/route.ts`, `app/api/admin/research/fuel/route.ts`, `app/api/admin/research/tyres/route.ts`, `app/api/admin/research/driver-energy/route.ts`, `app/api/market/update/route.ts`, `app/dashboard/layout.tsx`, `app/actions/admin.ts`

## Arquivos NÃO alterados (preservados)
- `app/page.tsx` (landing), `app/login/page.tsx`, `app/dashboard/*` piloto (setup, strategy, manual, tests, wear, sponsors, market, calendar, manager), `domain/setup/calculateSetup.ts`, `services/setupService.ts`, `app/context/GameContext.tsx` (apenas leitura), `data/calculadora.xlsx`, `next.config.ts` (exceto warning middleware), `AGENTS.md`
