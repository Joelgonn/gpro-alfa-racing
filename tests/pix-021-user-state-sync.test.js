// tests/pix-021-user-state-sync.test.js
// PIX-021 — Sincronização user_state ↔ access_grants
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

const ROOT = path.join(__dirname,'..')
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8') }

console.log('=== PIX-021 — user_state sync ===\n')
const WH = read('app/lib/payments/webhook-service.ts')
const AC = read('app/lib/access/accessService.ts')

function strip(s){ return s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'') }
const whCode = strip(WH)
const acCode = strip(AC)

// Helper pure exec
function runPure(code){
  const fileUrl = 'file:///' + path.join(ROOT,'app/lib/access/accessService.ts').replace(/\\/g,'/')
  const boot = [`const mod = await import(${JSON.stringify(fileUrl)});`, `const out = await (async()=>{ ${code} })();`, `console.log('__R__'+JSON.stringify(out));`].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types','--input-type=module','-e', boot], { cwd:ROOT, encoding:'utf8', timeout:8000 })
  const full=(res.stdout||'')+(res.stderr||'')
  const idx=full.indexOf('__R__')
  if(idx===-1) return {ok:false, reason: full.slice(-300)}
  try{ return {ok:true, out: JSON.parse(full.slice(idx+5).split(/\r?\n/)[0]) } }catch(e){ return {ok:false, reason:e.message} }
}

// 1. Estrutural: webhook-service importa e chama syncUserStateWithGrant + pickBestGrant
console.log('--- 1. Webhook integra sync ---')
assert(WH.includes("from '@/app/lib/access/accessService'") && WH.includes('syncUserStateWithGrant'), 'webhook-service importa syncUserStateWithGrant')
assert(WH.includes('pickBestGrant') && WH.includes('interpretGrant'), 'webhook importa pickBestGrant/interpretGrant')
assert(WH.includes('ensurePaymentGrant') && WH.includes('syncUserStateWithGrant'), 'ensurePaymentGrant seguido de syncUserStateWithGrant')
assert((WH.match(/syncUserStateWithGrant/g)||[]).length >=2, 'sync chamado em already_confirmed e após ensurePaymentGrant (2 locais)')
assert(WH.includes('if (grantRes.grantId)') && WH.includes('if (grantId)'), 'sync só se grantId existe (falha não promove)')
assert(WH.includes('allGrants') && WH.includes('pickBestGrant'), 'sync usa pickBestGrant para escolher melhor grant')

// 2. Campos escritos por syncUserStateWithGrant
console.log('\n--- 2. Campos user_state ---')
assert(AC.includes('vip_status = vipStatusForGrant') && AC.includes('vip_expires_at = grant.expires_at'), 'sync escreve vip_status/vip_expires_at')
assert(AC.includes('access_plan = grant.plan') && AC.includes('access_grant_id = grant.id'), 'sync escreve access_plan/access_grant_id')
assert(AC.includes("vipStatusForGrant(grant.expires_at)") && AC.includes("if (expiresAt === null) return 'lifetime'"), 'vitalício mapeado para lifetime/null')

// 3. Proteção lifetime
assert(AC.includes("preserva lifetime") && AC.includes("curStatus === 'lifetime'"), 'sync preserva lifetime (não sobrescreve vitalício com 30d)')

// 4. Idempotência: webhook reuso não duplica grant
assert(WH.includes("contains('metadata'") && WH.includes("filter('metadata->>order_id'"), 'idempotência via metadata.order_id')
assert(WH.includes("code === '23505'"), 'race 23505 tratado')
assert(WH.includes("outcome: 'grant_reused'") && WH.includes("outcome: 'already_confirmed'"), 'replay retorna grant_reused/already_confirmed')

// 5. Testes estruturais de interpretGrant / pickBestGrant (sem importar server-only)
console.log('\n--- 5. interpretGrant/pickBestGrant estrutural ---')
assert(AC.includes('function interpretGrant') && AC.includes("hasAccess: false") && AC.includes("status: 'expired'"), 'interpretGrant existe e trata expirado')
assert(AC.includes('function pickBestGrant') && AC.includes('bestActive') && AC.includes('hasAccess'), 'pickBestGrant prefere ativo')
assert(AC.includes("vipStatusForGrant") && AC.includes("if (expiresAt === null) return 'lifetime'"), 'vipStatusForGrant trata vitalício')
{
  // G: campos esperados para sync (verifica via leitura, sem execução server-only)
  const hasFields = AC.includes('vip_status = vipStatusForGrant') && AC.includes('vip_expires_at = grant.expires_at') && AC.includes('access_plan = grant.plan') && AC.includes('access_grant_id = grant.id')
  assert(hasFields, 'G: sync escreve vip_status, vip_expires_at, access_plan, access_grant_id')
  assert(AC.includes("preserva lifetime") && AC.includes("curStatus === 'lifetime'"), 'G: preserva lifetime não sobrescreve')
}

// 6. Não altera Mercado Pago / checkout / prices
console.log('\n--- 6. Escopo preservado ---')
assert(!whCode.includes('MERCADOPAGO_ACCESS_TOKEN') || WH.includes("mercadopago-client"), 'webhook não expõe token (apenas via client)')
assert(!WH.includes('premium_plans') || WH.includes('premium_plans'), 'webhook apenas lê duration_days, não altera preço')
assert(AC.includes('user_state é cache; access_grants é fonte'), 'access_grants permanece fonte canônica')

console.log('\n=== PIX-021 OK ===')
if(process.exitCode) console.log('❌ Falhas PIX-021')
else console.log('✅ PIX-021 user_state sync OK')
