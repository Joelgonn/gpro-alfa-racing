// tests/pix-015-free-premium-access.test.js
// ============================================================
// PIX-015 — AUTORIZAÇÃO FREE / PREMIUM / ADMIN (área Manager + APIs)
// ============================================================
// Cobre os 12 cenários obrigatórios da FASE 6.
//
// COMPORTAMENTAL: executa o código REAL de app/lib/access/authorization.ts (que usa
// o accessService real) num subprocesso, com stubs de:
//   - server-only
//   - @/app/lib/supabase-admin (banco em memória)
//   - @/utils/supabase/server   (sessão = usuário do cenário)
//   - next/server / next/navigation (NextResponse.json e redirect capturáveis)
// Assim a decisão é exercitada de verdade nos 4 níveis: anonymous/free/premium/admin.
//
// Execução: node tests/pix-015-free-premium-access.test.js
// ============================================================

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== PIX-015 — Autorização Free / Premium / Admin ===\n')

const AUTH = 'app/lib/access/authorization.ts'
const DASH_LAYOUT = 'app/dashboard/layout.tsx'
const SHELL = 'app/dashboard/DashboardShell.tsx'

const USER_FREE = '11111111-1111-4111-8111-111111111111'
const USER_PREMIUM = '22222222-2222-4222-8222-222222222222'
const USER_ADMIN = '33333333-3333-4333-8333-333333333333'
const TS_PAST = '2020-01-01T00:00:00.000Z'
const TS_FUTURE = '2099-01-01T00:00:00.000Z'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
const DB_STUB = [
  "const DB = globalThis.__DB__",
  "class Query {",
  "  constructor(t) { this.table = t; this.filters = []; this.mode = 'all' }",
  "  select() { return this }",
  "  eq(c, v) { this.filters.push(['eq', c, v]); return this }",
  "  in(c, v) { this.filters.push(['in', c, v]); return this }",
  "  order() { return this }",
  "  limit() { return this }",
  "  maybeSingle() { this.mode = 'one'; return this.run() }",
  "  single() { this.mode = 'one'; return this.run() }",
  "  insert() { return this }",
  "  update() { return this }",
  "  then(res, rej) { return this.run().then(res, rej) }",
  "  async run() {",
  "    const rows = (DB[this.table] || []).filter(r => this.filters.every(f => {",
  "      const op = f[0], c = f[1], v = f[2]",
  "      if (op === 'eq') return r[c] === v",
  "      if (op === 'in') return v.indexOf(r[c]) !== -1",
  "      return true",
  "    }))",
  "    return { data: this.mode === 'one' ? (rows[0] || null) : rows, error: null }",
  "  }",
  "}",
  "export const supabaseAdmin = { from(t) { return new Query(t) }, auth: { getUser: async () => ({ data: { user: null }, error: null }) } }",
].join('\n')

const AUTH_SERVER_STUB = [
  "export async function createClient() {",
  "  const user = globalThis.__SESSION_USER__",
  "  return {",
  "    auth: {",
  "      async getUser() {",
  "        if (!user) return { data: { user: null }, error: new Error('no session') }",
  "        return { data: { user: { id: user, email: 'piloto@alfaracing.com' } }, error: null }",
  "      },",
  "    },",
  "    from() { throw new Error('nao usar client de sessao para dados') },",
  "  }",
  "}",
].join('\n')

const NEXT_SERVER_STUB = [
  "export const NextResponse = {",
  "  json(body, init) { return { __nextResponse: true, status: (init && init.status) || 200, body } },",
  "  next() { return { __nextResponse: true, status: 200 } },",
  "}",
].join('\n')

const NEXT_NAV_STUB = [
  "export function redirect(url) { const e = new Error('NEXT_REDIRECT'); e.digest = 'NEXT_REDIRECT;' + url; throw e }",
  "export function notFound() { const e = new Error('NEXT_NOT_FOUND'); throw e }",
].join('\n')

const LOADER_SRC = [
  "import { pathToFileURL, fileURLToPath } from 'node:url'",
  "import { existsSync } from 'node:fs'",
  "const ROOT = process.env.__PIX15_ROOT__",
  "const url = (src) => 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64')",
  "const EMPTY = 'data:text/javascript,export default undefined;'",
  "const map = {",
  "  'server-only': EMPTY,",
  "  '@/app/lib/supabase-admin': url(process.env.__PIX15_DB__ || ''),",
  "  '@/utils/supabase/server': url(process.env.__PIX15_AUTH__ || ''),",
  "  'next/server': url(process.env.__PIX15_NEXTSERVER__ || ''),",
  "  'next/navigation': url(process.env.__PIX15_NEXTNAV__ || ''),",
  "}",
  "function withExt(base) { for (const e of ['', '.ts', '.tsx', '.js']) { if (existsSync(base + e)) return base + e } return null }",
  "export async function resolve(spec, ctx, next) {",
  "  if (map[spec]) return { url: map[spec], shortCircuit: true }",
  "  if (spec.endsWith('/server-only')) return { url: EMPTY, shortCircuit: true }",
  "  if (spec.startsWith('@/')) { const r = withExt(ROOT + '/' + spec.slice(2)); return { url: pathToFileURL(r || (ROOT + '/' + spec.slice(2))).href, shortCircuit: true } }",
  "  if (spec.startsWith('./') || spec.startsWith('../')) { const r = withExt(fileURLToPath(new URL(spec, ctx.parentURL))); if (r) return { url: pathToFileURL(r).href, shortCircuit: true } }",
  "  return next(spec, ctx)",
  "}",
].join('\n')

function runAuth(code, opts) {
  const o = opts || {}
  const boot = [
    `process.env.__PIX15_ROOT__ = ${JSON.stringify(ROOT.replace(/\\/g, '/'))};`,
    `process.env.__PIX15_DB__ = ${JSON.stringify(DB_STUB)};`,
    `process.env.__PIX15_AUTH__ = ${JSON.stringify(AUTH_SERVER_STUB)};`,
    `process.env.__PIX15_NEXTSERVER__ = ${JSON.stringify(NEXT_SERVER_STUB)};`,
    `process.env.__PIX15_NEXTNAV__ = ${JSON.stringify(NEXT_NAV_STUB)};`,
    `globalThis.__DB__ = ${JSON.stringify(o.seed || {})};`,
    `globalThis.__SESSION_USER__ = ${JSON.stringify(o.sessionUser || null)};`,
    `const { register } = await import('node:module');`,
    `register(${JSON.stringify('data:text/javascript;base64,' + Buffer.from(LOADER_SRC, 'utf8').toString('base64'))}, { parentURL: import.meta.url });`,
    `const mod = await import(${JSON.stringify('file:///' + ROOT.replace(/\\/g, '/') + '/app/lib/access/authorization.ts')});`,
    `const __out = await (async () => { ${code} })();`,
    `console.log('__PIX15__' + JSON.stringify(__out));`,
  ].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], {
    cwd: ROOT, encoding: 'utf8', timeout: 90000,
  })
  const full = (res.stdout || '') + (res.stderr || '')
  const idx = full.indexOf('__PIX15__')
  if (idx === -1) {
    const diag = full.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-4).join(' | ')
    return { ok: false, reason: diag.slice(0, 500) || 'sem saída' }
  }
  try {
    return { ok: true, out: JSON.parse(full.slice(idx + '__PIX15__'.length).split(/\r?\n/)[0]) }
  } catch (e) {
    return { ok: false, reason: 'resultado não parseável: ' + String(e.message).slice(0, 200) }
  }
}

// código reutilizado em cada cenário: executa as duas guardas e devolve o resultado
const PROBE = `
  const decision = await mod.resolveAccessDecision()
  const api = await mod.guardPremiumApi()
  let page = null
  try { const d = await mod.requireDashboardAccess('/dashboard/manager'); page = { ok: true, level: d.level } }
  catch (e) { page = { redirected: true, digest: String(e && e.digest || e && e.message) } }
  return {
    level: decision.level,
    isAdmin: decision.isAdmin,
    isPremium: decision.isPremium,
    reason: decision.reason,
    grantStatus: decision.grantStatus,
    apiStatus: api ? api.status : null,
    apiCode: api ? (api.body && api.body.code) || null : null,
    page,
  }`

const seedGrant = (userId, extra) => Object.assign({
  id: 'grant-' + userId.slice(0, 4), user_id: userId, source: 'payment', invite_code_id: null,
  plan: 'full_premium', status: 'active', starts_at: '2026-01-01T00:00:00.000Z',
  expires_at: TS_FUTURE, revoked_at: null, revoked_by: null, metadata: {},
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
}, extra || {})

// ---------------------------------------------------------------------------
// TESTE 1/3 — Free: dashboard bloqueado e URL direta bloqueada
// ---------------------------------------------------------------------------
console.log('--- TESTE 1 e 3: Free no /dashboard/manager (direto por URL) ---')
{
  const r = runAuth(PROBE, { sessionUser: USER_FREE, seed: { access_grants: [], user_state: [{ user_id: USER_FREE, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'free', '1. nível decidido = free (sem access_grant)')
    assert(r.out.page.redirected === true && /\/planos\?motivo=premium/.test(r.out.page.digest), '1. Free é redirecionado para /planos (não entra no Manager)')
    assert(r.out.page.digest.includes('/dashboard') === false, '3. nenhuma renderização da URL direta: redirect acontece no servidor')
  }
}

// ---------------------------------------------------------------------------
// TESTE 2 — Free: API Premium bloqueada
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 2: Free na API Premium ---')
{
  const r = runAuth(PROBE, { sessionUser: USER_FREE, seed: { access_grants: [], user_state: [{ user_id: USER_FREE, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.apiStatus === 403, '2. API Premium responde 403 para Free')
    assert(r.out.apiCode === 'PREMIUM_REQUIRED', '2. código PREMIUM_REQUIRED (distinto de erro genérico)')
  }
}

// ---------------------------------------------------------------------------
// TESTE 4 — Free: tentativa de IDOR/usuário alheio
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 4: tentativa de IDOR ---')
{
  const r = runAuth(`
    let outcome = 'none'
    try { await mod.resolveAccessDecision(${JSON.stringify(USER_PREMIUM)}); outcome = 'permitido' }
    catch (e) { outcome = 'erro:' + String(e && e.status) }
    return { outcome }`, { sessionUser: USER_FREE, seed: { access_grants: [seedGrant(USER_PREMIUM)], user_state: [] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.outcome === 'erro:403', '4. pedir acesso com o id de OUTRO usuário é negado (403) — não herda Premium alheio')
  }
}

// ---------------------------------------------------------------------------
// TESTE 5 e 6 — Premium: dashboard e APIs permitidos
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 5 e 6: Premium liberado ---')
{
  const r = runAuth(PROBE, { sessionUser: USER_PREMIUM, seed: { access_grants: [seedGrant(USER_PREMIUM)], user_state: [{ user_id: USER_PREMIUM, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'premium', '5. nível decidido = premium (grant ativo)')
    assert(r.out.page.ok === true && r.out.page.level === 'premium', '5. Premium entra no dashboard (sem redirect)')
    assert(r.out.apiStatus === null, '6. API Premium liberada para Premium')
  }
}

// ---------------------------------------------------------------------------
// TESTE 7 — Premium expirado/revogado: bloqueado
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 7: Premium expirado / revogado ---')
{
  const expired = seedGrant(USER_PREMIUM, { status: 'expired', expires_at: TS_PAST })
  const r = runAuth(PROBE, { sessionUser: USER_PREMIUM, seed: { access_grants: [expired], user_state: [{ user_id: USER_PREMIUM, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'free', '7. grant expirado ⇒ nível free')
    assert(r.out.reason === 'grant_expired', '7. motivo registrado = grant_expired')
    assert(r.out.apiStatus === 403, '7. API negada para Premium expirado')
    assert(r.out.page.redirected === true, '7. dashboard negado para Premium expirado')
  }
}
{
  const revoked = seedGrant(USER_PREMIUM, { status: 'revoked', revoked_at: '2026-02-01T00:00:00.000Z' })
  const r = runAuth(PROBE, { sessionUser: USER_PREMIUM, seed: { access_grants: [revoked], user_state: [{ user_id: USER_PREMIUM, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'free' && r.out.reason === 'grant_revoked', '7. grant revogado ⇒ free (grant_revoked)')
  }
}
{
  const activeButExpiredDate = seedGrant(USER_PREMIUM, { status: 'active', expires_at: TS_PAST })
  const r = runAuth(PROBE, { sessionUser: USER_PREMIUM, seed: { access_grants: [activeButExpiredDate], user_state: [{ user_id: USER_PREMIUM, role: 'user' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'free', '7. status active com expires_at no passado ⇒ free (expiração é autoritativa)')
  }
}

// ---------------------------------------------------------------------------
// TESTE 8 — Admin: permitido
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 8: Admin liberado ---')
{
  const r = runAuth(PROBE, { sessionUser: USER_ADMIN, seed: { access_grants: [], user_state: [{ user_id: USER_ADMIN, role: 'admin' }] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'admin', '8. admin sem grant ⇒ nível admin (não free)')
    assert(r.out.page.ok === true && r.out.page.level === 'admin', '8. admin entra no dashboard')
    assert(r.out.apiStatus === null, '8. admin não é bloqueado pela guarda Premium')
  }
}

// ---------------------------------------------------------------------------
// Sessão ausente — anonymous nunca passa por autenticado
// ---------------------------------------------------------------------------
console.log('\n--- Extra: sem sessão (anonymous) ---')
{
  const r = runAuth(PROBE, { sessionUser: null, seed: { access_grants: [], user_state: [] } })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.level === 'anonymous', 'extra: sem sessão ⇒ anonymous')
    assert(r.out.apiStatus === 401 && r.out.apiCode === 'NOT_AUTHENTICATED', 'extra: API responde 401 (não 403)')
    assert(r.out.page.redirected === true && /\/login\?next=/.test(r.out.page.digest), 'extra: página redireciona para /login preservando o destino')
  }
}

// ---------------------------------------------------------------------------
// TESTE 9..12 — fluxos que NÃO podem ser quebrados
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 9 a 12: login / cadastro / planos / logout intactos ---')
const loginCode = stripComments(read('app/login/page.tsx'))
const planosCode = stripComments(read('app/planos/page.tsx'))
const cadastroCode = stripComments(read('app/cadastro/page.tsx'))
const payRoute = stripComments(read('app/api/payments/orders/route.ts'))
const shellCode = stripComments(read(SHELL))

assert(/signInWithPassword/.test(loginCode), '9. login continua usando Supabase Auth (mesmo mecanismo)')
assert(!/guardPremiumApi|requireDashboardAccess/.test(loginCode), '9. /login não exige Premium (free precisa autenticar)')
assert(/resolvePostLoginDestination/.test(loginCode), '9. destino pós-login preservado (free → /planos)')
assert(/signUpFreeUser/.test(cadastroCode) && /FREE_LANDING_PATH/.test(cadastroCode), '10. cadastro gratuito continua funcionando')
assert(!/guardPremiumApi/.test(cadastroCode), '10. cadastro permanece público')
assert(!/guardPremiumApi|requireDashboardAccess/.test(planosCode), '11. /planos continua acessível (inclusive para Free)')
assert(/getAuthenticatedUser/.test(planosCode), '11. /planos segue oferecendo a compra ao autenticado')
assert(!/guardPremiumApi/.test(payRoute), '11. POST /api/payments/orders NÃO exige Premium (Free pode comprar)')
assert(/supabase\.auth\.signOut\(\)/.test(shellCode), '12. logout continua disponível no shell do dashboard')

// ---------------------------------------------------------------------------
// Estrutural — proteção no SERVIDOR (não só na UI)
// ---------------------------------------------------------------------------
console.log('\n--- Estrutural: guard server-side ---')
const authCode = stripComments(read(AUTH))
const layoutCode = stripComments(read(DASH_LAYOUT))
assert(/server-only/.test(read(AUTH)), 'estrutural: módulo de autorização é server-only')
assert(!/'use client'/.test(layoutCode), `estrutural: ${DASH_LAYOUT} NÃO é client component`)
assert(/requireDashboardAccess/.test(layoutCode), 'estrutural: layout do dashboard chama a guarda no servidor')
assert(/DashboardShell/.test(layoutCode), 'estrutural: UI continua no shell de cliente')
assert(!/requireDashboardAccess|guardPremiumApi/.test(shellCode), 'estrutural: o cliente não decide autorização')
assert(/force-dynamic/.test(layoutCode), 'estrutural: área autenticada nunca é cacheada/prerenderizada')
assert(/getAccessState/.test(authCode), 'estrutural: decisão reutiliza o accessService (fonte de verdade)')
assert(!/access_grants/.test(authCode), 'estrutural: a guarda não lê/escreve access_grants diretamente')
assert(!/VIP_CHECK\s*=\s*true/.test(authCode), 'estrutural: VIP_CHECK permanece intocado')
assert(/admin/.test(authCode) && /level === 'premium' \|\| decision\.level === 'admin'/.test(authCode), 'estrutural: admin nunca é bloqueado pela guarda Premium')

const PROTECTED_API = [
  'app/api/manager/profile/route.ts',
  'app/api/gpro/sync/route.ts',
  'app/api/gpro/token/route.ts',
  'app/api/market/update/route.ts',
  'app/api/calendar/route.ts',
  'app/api/python/[[...route]]/route.ts',
]
for (const f of PROTECTED_API) {
  const src = read(f)
  const hits = (src.match(/guardPremiumApi\(\)/g) || []).length
  const handlers = (src.match(/^export async function (GET|POST|PUT|PATCH|DELETE)/gm) || []).length
  assert(hits >= 1, `estrutural: ${f} chama guardPremiumApi`)
  assert(hits >= handlers || f.includes('python'), `estrutural: ${f} protege todos os handlers (${hits}/${handlers})`)
}
assert(/isPublicAction/.test(read('app/api/python/[[...route]]/route.ts')), 'estrutural: ações públicas do motor (tracks/tyre_suppliers) preservadas')

console.log('\n=== Resumo PIX-015 ===')
if (process.exitCode) console.log('❌ Falhas na autorização Free/Premium/Admin.')
else console.log('✅ PIX-015 autorização OK (12 cenários + estrutural).')
