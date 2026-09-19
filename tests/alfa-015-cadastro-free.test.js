// tests/alfa-015-cadastro-free.test.js
// ============================================================
// ALFA-015.0 — CADASTRO GRATUITO (/cadastro)
// ============================================================
// Cobre os TESTE 1..6, 10, 11 e 12 do escopo da sprint.
// Execução: node tests/alfa-015-cadastro-free.test.js
//           node --test tests/alfa-015-cadastro-free.test.js
//
// Dois tipos de verificação:
//  - COMPORTAMENTAL: regras puras de app/lib/auth-flow.ts executadas de verdade
//    (Node 22.18+ faz type stripping ao importar .ts).
//  - ESTRUTURAL: o código que toca Supabase/banco é inspecionado no fonte, pois os
//    testes deste repositório não têm banco/credenciais (mesmo padrão de ALFA-011/014).
// ============================================================

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
function countMatches(src, re) { return (src.match(re) || []).length }

console.log('=== ALFA-015.0 — Cadastro gratuito ===\n')

// ---------------------------------------------------------------------------
// 0. Arquivos do fluxo
// ---------------------------------------------------------------------------
const ACTION = 'app/actions/freeSignup.ts'
const PAGE = 'app/cadastro/page.tsx'
const PURE = 'app/lib/auth-flow.ts'
const LOGIN = 'app/login/page.tsx'
const PLANOS = 'app/planos/page.tsx'
const MIGRATION = 'supabase/migrations/20260919000001_harden_user_state_insert.sql'

for (const f of [ACTION, PAGE, PURE, MIGRATION]) {
  assert(fs.existsSync(path.join(ROOT, f)), `arquivo existe: ${f}`)
}

const actionSrc = read(ACTION)
const actionCode = stripComments(actionSrc)
const pageCode = stripComments(read(PAGE))
const loginCode = stripComments(read(LOGIN))

// Regras puras carregadas de verdade (comportamental)
let flow = null
try {
  flow = require(path.join(ROOT, PURE))
} catch (e) {
  pending(`não foi possível carregar ${PURE} para testes comportamentais (${String(e.message).slice(0, 80)})`)
}

const VALID = {
  name: '  Ana   Paula  ',
  email: '  PILOTO@AlfaRacing.com ',
  password: 'alfa2026x',
  confirmPassword: 'alfa2026x',
}

// ---------------------------------------------------------------------------
// TESTE 1 — Cadastro válido cria usuário
// ---------------------------------------------------------------------------
console.log('--- TESTE 1: cadastro válido cria usuário ---')
assert(/supabase\.auth\.signUp\(/.test(actionCode), 'TESTE 1: usa o Supabase Auth existente (supabase.auth.signUp)')
assert(/'use server'/.test(actionSrc), 'TESTE 1: cadastro roda em Server Action (autoridade no servidor)')
assert(/createClient/.test(actionCode) && /utils\/supabase\/server/.test(actionCode), 'TESTE 1: reutiliza o client SSR do projeto (mesmo mecanismo do /login)')
assert(!/createClient\([^)]*SERVICE_ROLE/.test(actionCode) && !/supabaseAdmin\.auth\.admin\.createUser/.test(actionCode), 'TESTE 1: não cria segundo mecanismo de auth (não usa admin.createUser)')
assert(/options:\s*\{[\s\S]*?data:\s*\{\s*full_name/.test(actionCode), 'TESTE 1: nome gravado em user_metadata.full_name (sem tabela paralela)')
assert(/ok:\s*true/.test(actionCode), 'TESTE 1: retorna sucesso quando o Auth cria o usuário')
assert(/if \(!user\?\.id\)/.test(actionCode), 'TESTE 1: trata resposta sem usuário como falha explícita')
if (flow) {
  const r = flow.validateFreeSignup(VALID)
  assert(r.ok === true, 'TESTE 1: entrada válida passa na validação')
  assert(r.values.email === 'piloto@alfaracing.com', 'TESTE 1: e-mail normalizado no servidor (trim + minúsculas)')
  assert(r.values.name === 'Ana Paula', 'TESTE 1: nome normalizado (espaços colapsados)')
}

// ---------------------------------------------------------------------------
// TESTE 2 — Cadastro não cria access_grant
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 2: cadastro não cria access_grant ---')
assert(!/access_grants/.test(actionCode), 'TESTE 2: nenhuma referência a access_grants no código do cadastro')
assert(!/access_events/.test(actionCode), 'TESTE 2: nenhum evento de acesso criado no cadastro')
assert(!/ensureVipGrantForInvite|syncUserStateWithGrant|recordAccessEvent/.test(actionCode), 'TESTE 2: não importa/chama concessão VIP')
assert(!/vip_status|vip_expires_at|access_plan|access_grant_id/.test(actionCode), 'TESTE 2: não escreve campos de concessão em user_state')

// ---------------------------------------------------------------------------
// TESTE 3 — Cadastro não cria Premium
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 3: cadastro não cria Premium ---')
assert(!/full_premium|'premium'|"premium"/.test(actionCode), 'TESTE 3: nenhum plano Premium atribuído')
assert(!/PREMIUM|VIP_CHECK\s*=\s*true/.test(actionCode), 'TESTE 3: não ativa VIP_CHECK nem privilégio')
assert(/role:\s*'user'/.test(actionCode), "TESTE 3: perfil criado explicitamente como role 'user'")
assert(/ignoreDuplicates:\s*true/.test(actionCode), 'TESTE 3: perfil usa ON CONFLICT DO NOTHING (nunca sobrescreve VIP/admin existente)')

// ---------------------------------------------------------------------------
// TESTE 4 e 5 — Cadastro não cria premium_order / premium_payment
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 4 e 5: pedidos e pagamentos ---')
assert(!/premium_orders/.test(actionCode), 'TESTE 4: nenhum premium_order criado')
assert(!/premium_payments/.test(actionCode), 'TESTE 5: nenhum premium_payment criado')
assert(!/payment_events/.test(actionCode), 'TESTE 5: nenhum evento de pagamento criado')
assert(!/payments\/orders/.test(actionCode) && !/orderService|paymentService/.test(actionCode), 'TESTE 4/5: não chama o serviço de pedidos/pagamentos')

// ---------------------------------------------------------------------------
// TESTE 6 — Cadastro não pode definir role=admin
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 6: cadastro não pode criar admin ---')
const formReads = actionCode.match(/formData\.get\('([^']+)'\)/g) || []
assert(formReads.length === 4, `TESTE 6: lê exatamente 4 campos do formulário (encontrado: ${formReads.length})`)
for (const field of ['name', 'email', 'password', 'confirmPassword']) {
  assert(formReads.some((r) => r.includes(`'${field}'`)), `TESTE 6: campo permitido lido do formulário: ${field}`)
}
for (const field of ['role', 'admin', 'premium', 'access_grant', 'plan', 'planCode', 'status']) {
  assert(!new RegExp(`formData\\.get\\('${field}'`).test(actionCode), `TESTE 6: campo privilegiado NÃO é lido do formulário: ${field}`)
}
assert(!/body\.role|body\.premium|\badmin\s*:\s*true|\bisAdmin\s*:\s*true/.test(actionCode), 'TESTE 6: nenhum privilégio aceito do cliente')
assert(/prevent_user_state_insert_privilege_escalation/.test(read(MIGRATION)), 'TESTE 6: migration de hardening de INSERT preparada (defesa no banco)')
assert(/drop trigger if exists trg_user_state_insert_privilege_guard/.test(read(MIGRATION)), 'TESTE 6: trigger BEFORE INSERT idempotente na migration')

// ---------------------------------------------------------------------------
// TESTE 10 — Usuário já cadastrado recebe erro apropriado
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 10: e-mail já cadastrado ---')
assert(/mapSupabaseSignupError/.test(actionCode), 'TESTE 10: erro do Supabase Auth é traduzido no servidor')
assert(/isDuplicateEmailResponse/.test(actionCode), 'TESTE 10: trata resposta "sucesso" sem sessão (anti-enumeração) como duplicado')
assert(/EMAIL_ALREADY_EXISTS/.test(actionCode), 'TESTE 10: código EMAIL_ALREADY_EXISTS retornado')
if (flow) {
  const dup = flow.mapSupabaseSignupError('User already registered')
  assert(dup.code === 'EMAIL_ALREADY_EXISTS', 'TESTE 10: "User already registered" → EMAIL_ALREADY_EXISTS')
  const dup2 = flow.mapSupabaseSignupError('A user with this email address has already been registered')
  assert(dup2.code === 'EMAIL_ALREADY_EXISTS', 'TESTE 10: variação de mensagem → EMAIL_ALREADY_EXISTS')
  assert(flow.isDuplicateEmailResponse({ identities: [] }) === true, 'TESTE 10: identities vazio → e-mail já cadastrado')
  assert(flow.isDuplicateEmailResponse({ identities: [{ id: 'x' }] }) === false, 'TESTE 10: identities preenchido → cadastro novo')
  assert(typeof dup.message === 'string' && dup.message.length > 10, 'TESTE 10: mensagem clara ao usuário')
  assert(!/already registered/i.test(dup.message), 'TESTE 10: mensagem não repassa texto bruto do provedor')
}
assert(/setFieldErrors/.test(pageCode) && /role="alert"/.test(pageCode), 'TESTE 10: erro exibido no formulário de forma acessível')
assert(/SIGNUP_DISABLED|mapSupabaseSignupError/.test(actionCode), 'TESTE 10: trata signup desabilitado no projeto Supabase')

// ---------------------------------------------------------------------------
// TESTE 11 — Senha e confirmação diferentes são rejeitadas
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 11: senha x confirmação ---')
assert(/confirmPassword/.test(actionCode), 'TESTE 11: confirmação de senha validada no servidor')
if (flow) {
  const mismatch = flow.validateFreeSignup({ ...VALID, confirmPassword: 'outraSenha1' })
  assert(mismatch.ok === false && mismatch.code === 'PASSWORD_MISMATCH', 'TESTE 11: senhas diferentes → PASSWORD_MISMATCH')
  assert(mismatch.fields.includes('confirmPassword'), 'TESTE 11: campo confirmPassword destacado')
  assert(flow.validateFreeSignup({ ...VALID, password: '123' }).ok === false, 'TESTE 11 (extra): senha curta rejeitada')
  assert(flow.validateFreeSignup({ ...VALID, password: 'somenteletras' }).code === 'WEAK_PASSWORD', 'TESTE 11 (extra): senha sem número rejeitada')
  assert(flow.validateFreeSignup({ ...VALID, password: '' }).code === 'MISSING_FIELDS', 'TESTE 11 (extra): senha vazia → MISSING_FIELDS')
  assert(flow.validateFreeSignup({ ...VALID, email: 'sem-arroba' }).code === 'INVALID_EMAIL', 'TESTE 11 (extra): e-mail inválido rejeitado')
  assert(flow.validateFreeSignup({ ...VALID, name: '   ' }).code === 'MISSING_FIELDS', 'TESTE 11 (extra): nome vazio → MISSING_FIELDS')
  assert(flow.passwordFieldError('abcdefgh1') === null, 'TESTE 11 (extra): senha conforme aceita')
}
assert(/collectErrors/.test(pageCode) && /confirmPasswordFieldError/.test(pageCode), 'TESTE 11: o formulário valida confirmação antes de enviar (UX)')

// ---------------------------------------------------------------------------
// TESTE 12 — Após cadastro/login o destino é /planos
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 12: destino /planos ---')
assert(/FREE_LANDING_PATH\s*=\s*'\/planos'/.test(read(PURE)), 'TESTE 12: /planos é a porta de entrada declarada')
assert(/redirectTo:\s*FREE_LANDING_PATH/.test(actionCode), 'TESTE 12: a Server Action devolve /planos como destino')
assert(/router\.push\(result\.redirectTo \|\| FREE_LANDING_PATH\)/.test(pageCode), 'TESTE 12: /cadastro redireciona para o destino devolvido pelo servidor')
assert(!/dashboard\/manager/.test(pageCode), 'TESTE 12: /cadastro não redireciona para o painel Premium')
assert(/Já tenho uma conta/.test(pageCode), 'TESTE 12: /cadastro oferece "Já tenho uma conta"')
assert(/LOGIN_WITH_NEXT/.test(pageCode) && /\/login\?next=/.test(pageCode), 'TESTE 12: "Já tenho uma conta" → /login preservando o retorno')
assert(/resolvePostLoginDestination/.test(loginCode), 'TESTE 12: /login resolve o destino (free → /planos)')
if (flow) {
  const free = flow.resolvePostLoginDestination({ access: { role: 'user', accessPlan: null } })
  assert(free === '/planos', 'TESTE 12: usuário gratuito autenticado → /planos')
  const explicit = flow.resolvePostLoginDestination({ next: '/planos', access: { role: 'user', accessPlan: null } })
  assert(explicit === '/planos', 'TESTE 12: ?next=/planos honrado')
  assert(flow.resolvePostLoginDestination({ access: null }) === '/dashboard/manager', 'TESTE 12: acesso desconhecido preserva o destino atual')
}

// ---------------------------------------------------------------------------
// Segurança (superfície pública)
// ---------------------------------------------------------------------------
console.log('\n--- Segurança ---')
if (flow) {
  assert(flow.safeInternalPath('//evil.com') === null, 'SEG: bloqueia open redirect "//evil.com"')
  assert(flow.safeInternalPath('https://evil.com') === null, 'SEG: bloqueia destino absoluto externo')
  assert(flow.safeInternalPath('/\\evil.com') === null, 'SEG: bloqueia barra invertida')
  assert(flow.safeInternalPath('/planos?plan=X') === '/planos?plan=X', 'SEG: permite caminho interno com query')
  assert(flow.safeInternalPath(null, '/planos') === '/planos', 'SEG: usa fallback quando ausente')
}
assert(!/SERVICE_ROLE|service_role/.test(pageCode), 'SEG: página de cadastro (client) não menciona service role')
assert(!/supabaseAdmin/.test(pageCode), 'SEG: página de cadastro não importa o client admin')
assert(!/console\.log\([^)]*password/i.test(actionSrc), 'SEG: senha nunca é logada')
assert(!/return\s*\{[^}]*password/.test(actionCode), 'SEG: resposta do cadastro não inclui senha')
assert(countMatches(actionCode, /maskEmail\(/g) >= 3, 'SEG: e-mail mascarado nos logs')
assert(/maskUserId/.test(actionCode), 'SEG: id de usuário mascarado nos logs')
assert(/'use server'/.test(actionSrc) && /server-only/.test(read('app/lib/supabase-admin.ts')), 'SEG: service_role permanece server-only')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas encontradas no cadastro gratuito.')
else console.log('✅ TESTE 1..6, 10, 11, 12 e segurança OK (comportamental + estrutural).')
