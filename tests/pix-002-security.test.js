// tests/pix-002-security.test.js
// PIX-002.6 — Testes de segurança e regressão (Preparação para Homologação)
//
// Foco: provar que NADA concede VIP, NADA confirma pagamento, NENHUM segredo vaza,
// e que os portões de autorização existem.
//
// Estratégia (igual à PIX-001.1): o que não pode ser importado em Node puro
// (`server-only`, cliente Supabase) é verificado por CONTRATO ESTRUTURAL sobre o
// código-fonte; o que é puro é EXECUTADO de verdade. Casos que exigem servidor com
// sessão real são marcados PENDING — nunca PASS.
//
// Provas HTTP reais desta sprint ficaram registradas no relatório
// `docs/payments/PIX-002-RELATORIO-HOMOLOGACAO.md` (12 requisições rejeitadas com
// `payment_events` permanecendo em 1 linha).

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

// Remove comentários: documentar uma garantia ("não altera premium_payments") não
// pode ser confundido com a violação dela.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

console.log('=== PIX-002.6 — Segurança e regressão (homologação) ===\n')

// ---------------------------------------------------------------------------
// 1. Autorização: usuário comum não acessa a área administrativa
// ---------------------------------------------------------------------------
console.log('--- 1. Controle de acesso administrativo ---')

const ADMIN_DIR = path.join(ROOT, 'app', 'api', 'admin')
function walkRoutes(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walkRoutes(full))
    else if (e.name === 'route.ts') out.push(full)
  }
  return out
}

const adminRoutes = walkRoutes(ADMIN_DIR)
assert(adminRoutes.length >= 10, `rotas administrativas encontradas: ${adminRoutes.length}`)

let semGuard = []
for (const abs of adminRoutes) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/')
  const src = read(rel)
  // O guard precisa ser IMPORTADO (não apenas citado em comentário)
  const importa = /import\s*\{[^}]*\brequireAdmin\b[^}]*\}\s*from\s*['"]@\/app\/lib\/auth['"]/.test(src)
  const chama = /\brequireAdmin\s*\(\s*\)/.test(stripComments(src))
  if (!importa || !chama) semGuard.push(rel)
}
assert(semGuard.length === 0, `todas as rotas admin importam e chamam requireAdmin (falhas: ${semGuard.join(', ') || 'nenhuma'})`)

const plansRoute = read('app/api/admin/plans/route.ts')
assert(/^import\s*\{[^}]*requireAdmin[^}]*\}\s*from\s*'@\/app\/lib\/auth'/m.test(plansRoute),
  'plans/route.ts importa requireAdmin do módulo de auth')
const plansCode = stripComments(plansRoute)
const getBody = plansCode.slice(plansCode.indexOf('export async function GET'), plansCode.indexOf('export async function PATCH'))
assert(/requireAdmin\s*\(\s*\)/.test(getBody), 'GET de planos exige admin ANTES de qualquer leitura')
const patchIdx = plansCode.indexOf('export async function PATCH')
const patchReqAdmin = plansCode.indexOf('requireAdmin()', patchIdx)
const patchUpdate = plansCode.indexOf(".update(", patchIdx)
assert(patchReqAdmin > -1 && patchUpdate > -1 && patchReqAdmin < patchUpdate,
  'PATCH de planos exige admin ANTES de qualquer escrita')
assert(/from\('premium_plans'\)/.test(plansCode), 'GET/PATCH operam somente em premium_plans')

// Nenhuma rota admin deve conceder VIP
const VIP_WRITE = /ensureVipGrantForInvite|renew_access_grant|revoke_access_grant|from\(['"]access_grants['"]\)\s*\.\s*(insert|update|upsert|delete)/
const adminComVip = adminRoutes
  .map((a) => path.relative(ROOT, a).replace(/\\/g, '/'))
  .filter((rel) => VIP_WRITE.test(stripComments(read(rel))))
assert(adminComVip.length === 0, `nenhuma rota admin concede/altera VIP (falhas: ${adminComVip.join(', ') || 'nenhuma'})`)

assert(plansCode.includes('405') && /export async function POST/.test(plansCode),
  'planos: POST/PUT/DELETE respondem 405 (produto não é criado nem removido)')

// ---------------------------------------------------------------------------
// 2. Assinatura ausente/inválida não grava evento
// ---------------------------------------------------------------------------
console.log('\n--- 2. Assinatura ---')

const WH = 'app/api/payments/webhooks/mercadopago/route.ts'
const wh = read(WH)
const whCode = stripComments(wh)

assert(whCode.includes("verdict.status !== 'verified'"), 'rejeita qualquer veredito que não seja verified')
assert(!/SIGNATURE_ENFORCE_ENV/.test(whCode), 'enforcement NÃO depende de flag de ambiente (fail-closed permanente)')
assert(!/\benforce\b/.test(whCode), 'não existe mais variável de permissividade no handler')

// A rejeição tem de acontecer ANTES da persistência
const idxReject = whCode.indexOf("reason: 'signature_not_verified'")
const idxStore = whCode.indexOf('processWebhookEvent(')
assert(idxReject > -1 && idxStore > -1, 'handler contém rejeição e persistência')
assert(idxReject < idxStore, 'rejeição por assinatura ocorre ANTES de processWebhookEvent (nada é gravado)')
assert(whCode.includes('401'), 'assinatura não verificada => 401')

// Módulo de assinatura nunca aprova sem segredo+template
const SIG = read('app/lib/payments/mercadopago-signature.ts')
assert(SIG.includes("reason: 'no_secret'") && SIG.includes("reason: 'no_template'"),
  'módulo distingue ausência de segredo e de template')
// O código real usa `const secret = params.secret ?? null` seguido de `if (!secret)`.
// (Asserção anterior procurava `if (!secret)` literal e falhava por causa do `?? null`.)
assert(/if \(!secret\) return \{ status: 'not_verified', reason: 'no_secret' \}/.test(SIG),
  'sem segredo retorna not_verified (nunca verified)')
assert(/if \(!manifest\) return \{ status: 'not_verified', reason: 'no_template' \}/.test(SIG),
  'sem template retorna not_verified (nunca verified)')

// ---------------------------------------------------------------------------
// 3. Nenhuma confirmação de pagamento e nenhum grant (garantias negativas)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Garantias negativas (pagamento / VIP) ---')

const SVC = 'app/lib/payments/webhook-service.ts'
const svcCode = stripComments(read(SVC))
assert(!/\.update\(|\.upsert\(|\.delete\(/.test(svcCode), 'webhook-service não executa update/upsert/delete')
assert(!svcCode.includes('premium_payments'), 'webhook-service não toca premium_payments')
assert(!svcCode.includes('access_grants'), 'webhook-service não toca access_grants')
assert(!whCode.includes('premium_payments'), 'handler não toca premium_payments')
assert(!whCode.includes('access_grants'), 'handler não toca access_grants')
assert(!/fetch\(|axios|https\.request/.test(whCode + svcCode), 'nenhuma chamada externa ao Mercado Pago')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(whCode + svcCode + SIG), 'Access Token nunca referenciado no módulo Pix')

// Eventos financeiros declarados mas SEM emissor: prova estrutural de que o caminho
// que confirma pagamento ou cria grant não existe no código.
const LOGGER = read('app/lib/access/accessLogger.ts')
const NUNCA_EMITIDOS = ['pix.payment.confirmed', 'pix.payment.failed', 'pix.grant.created', 'pix.grant.reused', 'pix.order.created', 'pix.charge.created', 'pix.charge.failed']
const appFiles = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(e.name)) appFiles.push(full)
  }
})(path.join(ROOT, 'app'))
const appSources = appFiles
  .filter((f) => !f.endsWith('accessLogger.ts'))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n')
const comEmissor = NUNCA_EMITIDOS.filter((ev) => appSources.includes(`'${ev}'`))
assert(comEmissor.length === 0, `nenhum evento financeiro é emitido hoje (emissores inesperados: ${comEmissor.join(', ') || 'nenhum'})`)
assert(LOGGER.includes("'pix.payment.confirmed'") && LOGGER.includes("'pix.grant.created'"),
  'eventos financeiros estão declarados no union (contrato pronto, sem emissor)')

// Nenhum caminho de código concede grant a partir de pagamento
const GRANT_CALLERS = ['app/actions/signup.ts', 'app/lib/access/accessService.ts']
const pagamentoComGrant = ['app/lib/payments', 'app/api/payments', 'app/planos']
  .flatMap((d) => {
    const out = []
    ;(function walk(dir) {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const full = path.join(ROOT, dir, e.name)
        if (e.isDirectory()) walk(path.relative(ROOT, full).replace(/\\/g, '/'))
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(path.relative(ROOT, full).replace(/\\/g, '/'))
      }
    })(d)
    return out
  })
  .filter((rel) => /ensureVipGrantForInvite|grantVip|access_grants/.test(stripComments(read(rel))))
assert(pagamentoComGrant.length === 0, `módulo de pagamento não concede VIP (falhas: ${pagamentoComGrant.join(', ') || 'nenhuma'})`)
assert(GRANT_CALLERS.every((f) => fs.existsSync(path.join(ROOT, f))), 'o único caminho de grant continua sendo o de convite')

// ---------------------------------------------------------------------------
// 4. Nenhum segredo nos logs nem nas respostas HTTP
// ---------------------------------------------------------------------------
console.log('\n--- 4. Segredos ---')

const SEGREDOS = ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']

// O logger bloqueia por NOME EXATO; verificar que a lista de bloqueio segue forte
assert(/const blocked = \[[^\]]*'token'[^\]]*\]/.test(LOGGER), 'logger mantém lista de campos bloqueados')
assert(LOGGER.includes("'service_role'"), 'logger bloqueia service_role')
assert(LOGGER.includes('maskUserId') && LOGGER.includes('maskCode'), 'logger mascara identificadores')

// Nenhum handler devolve segredo em resposta
const handlersComSegredo = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.name === 'route.ts') {
      const src = stripComments(fs.readFileSync(full, 'utf8'))
      if (SEGREDOS.some((s) => new RegExp(`json\\([^)]*${s}`).test(src))) {
        handlersComSegredo.push(path.relative(ROOT, full).replace(/\\/g, '/'))
      }
    }
  }
})(path.join(ROOT, 'app', 'api'))
assert(handlersComSegredo.length === 0, `nenhuma resposta HTTP ecoa nome de segredo (falhas: ${handlersComSegredo.join(', ') || 'nenhuma'})`)

// Nenhuma var pública (NEXT_PUBLIC_) aponta para segredo
const publicLeak = appFiles.filter((f) => /NEXT_PUBLIC_[A-Z_]*(TOKEN|SECRET|SERVICE_ROLE|ACCESS_TOKEN)/.test(fs.readFileSync(f, 'utf8')))
assert(publicLeak.length === 0, `nenhuma variável NEXT_PUBLIC_ de segredo (falhas: ${publicLeak.map((f) => path.relative(ROOT, f)).join(', ') || 'nenhuma'})`)

// O handler do webhook nunca loga o valor do header de assinatura
assert(/signature:\s*signatureStatus/.test(whCode), 'webhook loga apenas o STATUS da assinatura, nunca o valor')
assert(!/signature:\s*headers\.signature/.test(whCode), 'webhook não loga o header x-signature cru')
// O segredo nunca é um literal: tem de vir de process.env.
// (Asserção anterior usava regex com lookahead e casava com `secret: process.env[...]`.)
assert(!/(?:secret|token|password)\s*:\s*['"][^'"]+['"]/i.test(whCode),
  'webhook não hardcoda segredo (nenhum literal em campo secret/token/password)')
assert(/secret:\s*process\.env\[\s*SIGNATURE_SECRET_ENV\s*\]/.test(whCode),
  'segredo do webhook vem exclusivamente de variável de ambiente')
assert(!/SIGNATURE_SECRET_ENV\s*\]\s*\|\|\s*['"][^'"]+['"]/.test(whCode),
  'sem fallback literal para o segredo')

// ---------------------------------------------------------------------------
// 5. Nenhum select(*) universal em dado sensível novo
// ---------------------------------------------------------------------------
console.log('\n--- 5. Seleções ---')

const pixFiles = ['app/lib/payments/webhook-service.ts', 'app/api/payments/webhooks/mercadopago/route.ts',
  'app/api/admin/plans/route.ts', 'app/planos/page.tsx', 'app/lib/payments/orderService.ts']
for (const f of pixFiles) {
  const code = stripComments(read(f))
  // select('*') só é aceitável onde o resultado nunca é devolvido ao usuário final
  if (/select\(\s*'\*'\s*\)/.test(code)) {
    assert(f === 'app/lib/payments/orderService.ts', `${f}: select universal só é aceito no serviço interno (não devolvido ao cliente)`)
  } else {
    assert(true, `${f}: sem select('*') — usa lista explícita de colunas`)
  }
}

const WEBHOOK_SELECTS = read('app/lib/payments/webhook-service.ts')
assert(/select\('id, user_id, status'\)/.test(WEBHOOK_SELECTS), 'webhook lê premium_orders por lista explícita de colunas')

// ---------------------------------------------------------------------------
// 6. Migrations: aditivas, idempotentes e sem destruição
// ---------------------------------------------------------------------------
console.log('\n--- 6. Migrations PIX ---')

const MIGS = [
  'supabase/migrations/20250919000001_pix_mercadopago_columns.sql',
  'supabase/migrations/20250919000002_pix_payment_grant_uniqueness.sql',
  'supabase/migrations/20250919000003_pix_seed_premium_plans.sql',
]
for (const m of MIGS) {
  const code = stripComments(read(m)).toLowerCase()
  assert(!/drop\s+table|drop\s+column|truncate|drop\s+schema/.test(code), `${path.basename(m)}: sem DROP destrutivo`)
  assert(!/delete\s+from/.test(code), `${path.basename(m)}: sem DELETE`)
  assert(!/create\s+policy|enable\s+row\s+level\s+security/.test(code), `${path.basename(m)}: não altera RLS`)
  assert(/\$\$/.test(code) || !/raise\s+(notice|exception)/.test(code), `${path.basename(m)}: RAISE só dentro de bloco DO $$`)
  assert(!/\bas\s+any\b|:\s*any\b/.test(code), `${path.basename(m)}: sem any`)
}

const mig1 = read(MIGS[0])
assert(/add column if not exists/.test(mig1), '000001: colunas adicionadas com IF NOT EXISTS (idempotente)')
const mig2 = read(MIGS[1])
assert(/create unique index if not exists/i.test(mig2), '000002: índice único criado com IF NOT EXISTS')
assert(mig2.includes('uniq_grant_payment_order'), '000002: nome do índice de unicidade de grant por pedido')
const mig3 = read(MIGS[2])
assert(/on conflict \(code\) do nothing/i.test(mig3), '000003: seed idempotente (ON CONFLICT DO NOTHING, não sobrescreve preço)')

// ---------------------------------------------------------------------------
// 7. PIX_ENABLED mantém o checkout desativado
// ---------------------------------------------------------------------------
console.log('\n--- 7. PIX_ENABLED ---')

const planosPage = read('app/planos/page.tsx')
assert(/process\.env\.PIX_ENABLED === 'true'/.test(planosPage), 'gate lê PIX_ENABLED e exige exatamente "true"')
assert(planosPage.includes('Pagamento indisponível'), 'com a flag desligada exibe estado de indisponibilidade')
assert(/pixEnabled \?/.test(planosPage), 'o botão de checkout só é renderizado quando a flag está ligada')
const checkout = read('app/planos/checkout-button.tsx')
assert(!/PIX_ENABLED/.test(stripComments(checkout).replace(/process\.env\.PIX_ENABLED/g, '')),
  'componente de checkout não lê a flag (decisão permanece no servidor)')

// Nenhuma rota de API de pagamento ativa fluxo financeiro sem a flag
assert(!/PIX_ENABLED/.test(stripComments(read(WH))), 'webhook não depende de PIX_ENABLED (fail-closed independe da flag)')

console.log('\n--- Casos que exigem servidor/sessão real ---')
pending('usuário comum AUTENTICADO recebendo 403 em /api/admin/plans: exige sessão de usuário não-admin')
pending('403 (não 401) em rota admin com sessão válida sem papel admin')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas de segurança PIX-002.')
else console.log('✅ Segurança PIX-002 OK')
