// tests/pix-002-plans.test.js
// PIX-002.5 — Testes da área de planos (pública + administrativa)
//
// Verifica que:
// - a área pública existe, não expõe dado administrativo e não ativa checkout real;
// - a área administrativa é só para admin, valida valores e registra alterações;
// - nenhuma das duas concede VIP ou confirma pagamento.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

console.log('=== PIX-002.5 — Área de planos ===\n')

const PUBLIC_PAGE = 'app/planos/page.tsx'
const PUBLIC_BTN = 'app/planos/checkout-button.tsx'
const ADMIN_PAGE = 'app/dashboard/admin/plans/page.tsx'
const ADMIN_API = 'app/api/admin/plans/route.ts'

for (const f of [PUBLIC_PAGE, PUBLIC_BTN, ADMIN_PAGE, ADMIN_API]) {
  assert(fs.existsSync(path.join(ROOT, f)), `arquivo existe: ${f}`)
}

const page = read(PUBLIC_PAGE)
const pageCode = stripComments(page)
const btn = read(PUBLIC_BTN)
const btnCode = stripComments(btn)
const adminPage = read(ADMIN_PAGE)
const adminPageCode = stripComments(adminPage)
const apiCode = stripComments(read(ADMIN_API))

// ---------------------------------------------------------------------------
// 1. Área pública
// ---------------------------------------------------------------------------
console.log('--- 1. Área pública /planos ---')

assert(/export const dynamic = 'force-dynamic'/.test(pageCode), 'página pública é dinâmica (preço sempre atual, nunca cacheado)')
assert(/supabaseAdmin/.test(pageCode), 'lê planos no servidor (service_role), não no cliente')
assert(/from\('premium_plans'\)/.test(pageCode), 'consulta a tabela premium_plans')
assert(/\.eq\('is_active', true\)/.test(pageCode), 'exibe somente planos ativos')
assert(!/\.select\('id,/.test(pageCode) && /\.select\('code, name, description, duration_days, price_cents, currency'\)/.test(pageCode),
  'seleciona apenas colunas seguras (sem id, sem timestamps internos)')
assert(!/supabaseAdmin/.test(btnCode), 'componente cliente NÃO usa service_role')
assert(!/'use server'/.test(btnCode), 'botão de checkout é componente de cliente, sem acesso a segredo')
assert(!/service_role|SERVICE_ROLE/.test(btnCode), 'botão de checkout não menciona service role')

// Gate da flag: desligado => sem checkout
assert(/const pixEnabled = process\.env\.PIX_ENABLED === 'true'/.test(pageCode), 'gate lê PIX_ENABLED no servidor')
assert(/pixEnabled \? \(/.test(pageCode), 'checkout só é renderizado quando a flag está ligada (ternário)')
assert(/Pagamento indisponível/.test(page), 'estado de indisponibilidade com texto ao usuário')
assert(/disabled/.test(page) && /aria-disabled/.test(page), 'botão indisponível é realmente desabilitado e acessível')
assert(/<CheckoutButton/.test(page) && /planCode=\{plan\.code\}/.test(page), 'o checkout recebe apenas o código do plano')

// Nenhum dado administrativo no HTML público
assert(!/is_active|created_at|updated_at/.test(pageCode.match(/select\([^)]*\)/)?.[0] || ''),
  'nenhum campo administrativo na consulta pública')
assert(!/access_grants|premium_orders|premium_payments|payment_events/.test(pageCode),
  'página pública não toca tabelas de pagamento/VIP')
assert(!/ensureVipGrant|requireAdmin/.test(pageCode), 'página pública não concede VIP nem exige admin')

// ---------------------------------------------------------------------------
// 2. Checkout: não cria pagamento real nem confirma nada
// ---------------------------------------------------------------------------
console.log('\n--- 2. Checkout (cliente) ---')

assert(/fetch\('\/api\/payments\/orders'/.test(btnCode), 'checkout chama a API interna de pedidos')
assert(!/mercadopago\.com/.test(btnCode), 'checkout NÃO chama o Mercado Pago diretamente')
assert(!/ACCESS_TOKEN|APP_USR-/.test(btnCode), 'checkout não carrega token do provedor')
assert(/Idempotency-Key/.test(btn), 'checkout envia header de idempotência (evita pedido duplicado)')
// O corpo enviado à API não pode conter preço: o servidor é a fonte da verdade.
// (Asserção anterior checava o arquivo inteiro e falhava por causa de textos de UI
//  que mencionam "preço" legitimamente.)
const bodyMatch = /JSON\.stringify\((\{[\s\S]*?\})\)/.exec(btnCode)
assert(bodyMatch, 'checkout serializa um corpo explícito para a API')
assert(bodyMatch && !/price|amount|cents|valor/i.test(bodyMatch[1]),
  'corpo do pedido não contém preço/valor — somente o código do plano')
assert(/planCode/.test(btn), 'corpo do pedido inclui o código do plano')

// ---------------------------------------------------------------------------
// 3. Área administrativa: autorização e validação
// ---------------------------------------------------------------------------
console.log('\n--- 3. Área administrativa ---')

assert(/requireAdmin/.test(apiCode), 'API de planos exige admin')
assert(/from\('premium_plans'\)/.test(apiCode), 'API opera somente em premium_plans')
assert(!/access_grants|ensureVipGrant|premium_orders|premium_payments/.test(apiCode),
  'API de planos não toca VIP nem pedidos/pagamentos')

// Validação de preço: inteiro em centavos, faixa defensiva
assert(/PRICE_MIN_CENTS = 100/.test(apiCode) && /PRICE_MAX_CENTS = 1_000_000/.test(apiCode),
  'faixa de preço defensiva (R$ 1,00 a R$ 10.000,00)')
assert(/Number\.isInteger\(body\.priceCents\)/.test(apiCode), 'preço precisa ser inteiro (centavos) — nunca float')
assert(/body\.priceCents < PRICE_MIN_CENTS \|\| body\.priceCents > PRICE_MAX_CENTS/.test(apiCode),
  'preço fora da faixa é rejeitado com 400')
assert(!/parseFloat\([^)]*price/i.test(apiCode), 'não usa parseFloat para dinheiro')

// Nome, descrição, validade, ativo
assert(/NAME_MAX = 120/.test(apiCode) && /DESC_MAX = 500/.test(apiCode), 'limites de nome e descrição definidos')
assert(/durationDays === null/.test(apiCode) && /patch\.duration_days = null/.test(apiCode), 'vitalício aceito explicitamente (null)')
assert(/DURATION_MAX_DAYS = 3650/.test(apiCode), 'validade limitada a 10 anos')
assert(/typeof body\.isActive !== 'boolean'/.test(apiCode), 'isActive precisa ser booleano')

// Corpo inválido e campos vazios
assert(/Array\.isArray\(body\)/.test(apiCode), 'rejeita corpo que seja array')
assert(/Nenhum campo para atualizar/.test(apiCode), 'rejeita PATCH sem campos (400)')
assert(/Plano não encontrado/.test(apiCode) && /404/.test(apiCode), '404 quando o plano não existe (não cria por engano)')

// Registro da alteração sem vazar valor financeiro
assert(/accessLogger\.info\('pix\.plan\.updated'/.test(apiCode), 'alteração registrada no log de auditoria')
assert(/priceChanged: 'price_cents' in patch/.test(apiCode), 'log marca apenas QUE o preço mudou — não o valor')
// Extrai o objeto meta do log de sucesso e confirma que nenhum valor financeiro entra nele.
// (Asserção anterior usava janela de 300 caracteres e casava com o código de validação anterior.)
const metaMatch = /accessLogger\.info\('pix\.plan\.updated',\s*\{([\s\S]*?)\n\s*\}\)/.exec(apiCode)
assert(metaMatch, 'bloco de log de sucesso localizado')
const metaBlock = metaMatch ? metaMatch[1] : ''
assert(!/priceCents/.test(metaBlock), 'log nunca recebe o valor em centavos (apenas o booleano priceChanged)')
assert(/fields: Object\.keys\(patch\)\.join/.test(metaBlock), 'log registra apenas os NOMES dos campos alterados')
assert(/userIdMasked/.test(apiCode), 'log identifica o admin de forma mascarada')

// ---------------------------------------------------------------------------
// 4. Tela administrativa (cliente)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Tela /dashboard/admin/plans ---')

assert(/fetch\('\/api\/admin\/plans'/.test(adminPageCode), 'tela consome a API administrativa')
assert(/parseReaisToCents/.test(adminPageCode), 'converte reais digitados para centavos')
assert(/replace\(\/\\\.\/g, ''\)\.replace\(',', '\.'\)/.test(adminPageCode), 'aceita formato brasileiro (1.234,56)')
assert(/PRICE_MIN_REAIS = 1/.test(adminPageCode) && /PRICE_MAX_REAIS = 10000/.test(adminPageCode),
  'validação de faixa também no cliente')
assert(/cents === null/.test(adminPageCode), 'valor não numérico é rejeitado antes de enviar')
assert(/aria-live/.test(adminPage), 'feedback acessível (aria-live)')
assert(/role="alert"/.test(adminPage), 'erro anunciado com role=alert')
assert(!/requireAdmin|supabaseAdmin|service_role/.test(adminPageCode), 'tela NÃO tem privilégio: autorização vive na API')

// A tela não concede VIP nem confirma pagamento
assert(!/access_grants|ensureVipGrant|premium_payments/.test(adminPageCode), 'tela de planos não toca VIP nem pagamento')

// ---------------------------------------------------------------------------
// 5. Menu administrativo
// ---------------------------------------------------------------------------
console.log('\n--- 5. Menu administrativo ---')

const layout = read('app/dashboard/layout.tsx')
assert(/\/dashboard\/admin\/plans/.test(layout), 'menu admin aponta para a tela de planos')
assert(/name: 'Planos e preços'/.test(layout), 'item de menu rotulado em português')
assert(/\/dashboard\/admin\/vip-invites/.test(layout), 'menu de convites VIP preservado (nada foi removido)')

console.log('\n--- Casos que exigem sessão/servidor real ---')
pending('admin edita preço e o valor persiste: exige sessão admin real (proibido nesta sprint)')
pending('usuário comum autenticado recebe 403 na API: exige sessão de usuário não-admin')
pending('/planos com PIX_ENABLED=true renderizando o checkout: exigiria ligar a flag (proibido)')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas na área de planos PIX-002.')
else console.log('✅ Área de planos PIX-002 OK')
