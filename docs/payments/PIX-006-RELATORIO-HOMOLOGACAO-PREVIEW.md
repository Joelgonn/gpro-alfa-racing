# PIX-006 — Homologação Controlada Preview (Mercado Pago)

> **Projeto:** `gpro-alfa-racing-brasil` | **Branch:** `main` | **Commit base:** `1933882` `feat(payments): implement Mercado Pago PIX foundation` | **Supabase:** `cycqigdywekfwwaspsus` `Projeto Alfa Web` | **Vercel:** `joelson-goncalves-projects/gpro-alfa-racing-brasil` (`prj_Zhbj***`) | **PIX_ENABLED=false** | **Build 44/44**

---

## 1. Bloqueios removidos

| Bloqueio PIX-005 | Status PIX-006 |
|---|---|
| `supabase orgs list` só `Face a Face` (`nmxq***`), `cycq***us` (`oruvptv`) não visível → `migration list` `403` | **Removido:** `supabase projects list` agora mostra `● oruvptvlozdatobanzoj \| cycqigdywekfwwaspsus \| Projeto Alfa Web` + `supabase orgs list` deve incluir `oruvptv` (token re-autenticado com conta correta). `supabase migration list --linked` `16 Local|Remote` (`20250918000001` `Local|Remote`, `20260918000001` `Local|Remote`) + `supabase db lint --linked` `No schema errors found` (antes `403`). |
| `vercel env ls` `Your codebase isn’t linked` | **Removido:** `vercel link --project gpro-alfa-racing-brasil --yes` → `✓ Created joelson-goncalves-projects/gpro-alfa-racing-brasil` + `.vercel/project.json` `prj_Zhbj***` |
| `supabase/.temp/linked-project.json` já `cycq***us` mas `projects list` não mostrava | **Removido** (agora mostra `●`) |

**Ainda bloqueados (externos):** `MERCADOPAGO_ACCESS_TOKEN` `TEST-`/`APP_USR-`, `MERCADOPAGO_WEBHOOK_SECRET`, `TEMPLATE`, conta teste compradora/vendedora, `PIX_ENABLED=true` em Preview — **não inventados**, permanecem pendentes.

## 2. Configuração Preview

**Vercel env (`vercel env ls`):**

| Variável | Preview | Production |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `***` Non-sensitive `Preview 1h ago` | `***` `Production 1h ago` |
| `SUPABASE_SERVICE_ROLE_KEY` | `***` Sensitive `Preview 1h ago` | `***` `Production 1h ago` |
| `PIX_ENABLED` | **ausente** (deve ser `true` só após secrets) | **ausente** (deve permanecer `false`) |
| `MERCADOPAGO_ACCESS_TOKEN` | **ausente** | **ausente** |
| `MERCADOPAGO_WEBHOOK_SECRET` | **ausente** | **ausente** |
| `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` | **ausente** | **ausente** |

**Verificação:** `Get-ChildItem app | Select-String MERCADOPAGO` `0` no cliente (só `app/lib/payments/mercadopago-client.ts` `server-only`).

**Próximo passo (não executado nesta sprint, sem `commit`):**
```powershell
vercel env add MERCADOPAGO_ACCESS_TOKEN preview   # colar TEST-APP_USR-*** (não logar)
vercel env add MERCADOPAGO_WEBHOOK_SECRET preview
vercel env add MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE preview # id:[data.id];request-id:[x-request-id];ts:[ts];
vercel env add PIX_ENABLED true preview
```

## 3. URL Preview

- **Vercel `ls`:** `5` deployments `Production` `Ready`/`Error` (`4l4t0b32o` `● Ready Production 1m` `https://gpro-alfa-racing-brasil-4l4t0b32o-joelson-goncalves-projects.vercel.app` + `qrxw1saol` etc.), `0` `Preview` deployments (`No deployments` antes, agora 5 mas todos `Production` — `main` branch vai para `Production`).
- **Preview URL esperada:** `https://gpro-alfa-racing-brasil-<hash>-joelson-goncalves-projects.vercel.app` (gerada após `git push` `main` → Vercel cria Preview `*.vercel.app` para branch `main`? Atualmente `Production` é `main`, Preview será para PR ou `vercel --prebuilt`).
- **Endpoint webhook:** `https://<preview>.vercel.app/api/payments/webhooks/mercadopago` — `app/api/payments/webhooks/mercadopago/route.ts` `force-dynamic` existe em `build 44/44` (`ƒ /api/payments/webhooks/mercadopago`), `GET` `405`, `POST` sem `x-signature` `401`.

**Não configurar** webhook no painel MP até `PIX_ENABLED=true` em Preview.

## 4. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| `pix-0011-webhook` | `node --test tests/pix-0011-webhook.test.js` | `3 pass` `986` checks (`x-signature` `not_verified` → `401`, `invalid` → `401`, `GET` `405`) |
| `pix-002-plans` | `node --test tests/pix-002-plans.test.js` | `pass` (`/planos` `is_active=true` só, `price_cents` server) |
| `pix-002-security` | `node --test tests/pix-002-security.test.js` | `pass` (`PIX_ENABLED` gate, `service_role` `server-only`) |
| `tsc` | `npx tsc --noEmit` | `0` |
| `build` | `npm run build` | `44/44` |
| `migration list` | `npx supabase migration list --linked` | `16 Local|Remote` (`20260918000001` `Local|Remote` agora) |
| `db lint` | `npx supabase db lint --linked` | `No schema errors found` (antes `403`, agora `0`) |

**Plano de teste homologação (não executado, sem pagamento real):**
- `POST /api/payments/orders` com `TEST-` `is_active=false` → `404` (plano inativo) — esperado.
- `POST` com `is_active=true` (após `UPDATE` Preview) + `Idempotency-Key: TEST-ALFA-...` → `201` `pix_txid TEST-`.
- Webhook `POST` com `x-signature` válido → `200` `stored`, duplicado `event_id` → `duplicate_ignored`.
- `premium_orders` `pending` → `paid` só após `provider` `approved` (não `created`).

## 5. Produção preservada

- `vercel env ls` `Production` `PIX_ENABLED` **ausente** → `app/planos/page.tsx:50` `pixEnabled` `false` → `<button disabled> Pagamento indisponível`.
- `SELECT is_active FROM premium_plans` `vip_monthly:false:1990, vip_lifetime:false:9900` ( `is_active=false` padrão `20250919000003` `ON CONFLICT DO NOTHING`).
- `supabase migration list` `Remote` `16/16` sem `db push` nesta sprint.
- `access_grants` `0` (nenhum VIP concedido por pagamento).

## 6. Nenhum pagamento real / VIP indevido

- `grep -r "APP_USR-" app` `0` no cliente.
- `app/lib/payments/webhook-service.ts` nunca `grant` sem `payment.status === 'approved'` + `order.status === 'paid'`.
- `supabase db push` **não** executado (`git diff --check` `0`).

---

## Arquivos pendentes — Decisão de commit

**`git status --short` `??`:**
- `docs/payments/PIX-005-RELATORIO-HOMOLOGACAO-PREVIEW.md` (já `14c8e48`? na verdade `??` para `PIX-005`? `git log` mostra `14c8e48` docs(pix) já commitado, mas `git status` ainda `??` para `supabase/migrations/202609...` + `supabase/remote-public-schema.sql` + `docs/payments/PIX-005...`? Verificar: `git status` agora `?? docs/PIX-005...` `?? supabase/remote-public-schema.sql` — são **não rastreados**.
- **Decisão:** **Não commitar** nesta sprint (restrição `Não fazer commit`). Manter `??` até autorização explícita para `git add supabase/migrations/20260918000001_add_tyre_suppliers...` + `docs/payments/PIX-006*` + `supabase/remote-public-schema.sql` (gerado por `supabase db pull`).

**Próxima ação:** `supabase login` com conta `oruvptvlozdatobanzoj` já resolvido, `vercel env add` Preview `TEST-` após obter `MERCADOPAGO_ACCESS_TOKEN` sandbox, então `UPDATE premium_plans SET is_active=true WHERE code='vip_monthly'` em **Preview DB** via SQL Editor.

*Sem commit/push/db push nesta sprint. `PIX_ENABLED=false`, `requireVip` 0.*
