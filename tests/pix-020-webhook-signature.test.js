// tests/pix-020-webhook-signature.test.js
// PIX-020 — Webhook Mercado Pago Production: manifesto oficial, lowercase, query param, granular reasons
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }

const ROOT = path.join(__dirname, '..')
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8') }

console.log('=== PIX-020 — Webhook Signature Oficial ===\n')

const SIG = 'app/lib/payments/mercadopago-signature.ts'
const ROUTE = 'app/api/payments/webhooks/mercadopago/route.ts'
const sig = read(SIG)
const route = read(ROUTE)

function stripComments(src){ return src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'') }
const routeCode = stripComments(route)
const sigCode = stripComments(sig)

// Helper exec pure module
function runPure(code){
  const fileUrl = 'file:///' + path.join(ROOT, SIG).replace(/\\/g,'/')
  const boot = [`const mod = await import(${JSON.stringify(fileUrl)});`, `const out = await (async () => { ${code} })();`, `console.log('__R__' + JSON.stringify(out));`].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types','--input-type=module','-e', boot], { cwd: ROOT, encoding:'utf8', timeout:8000 })
  const full = (res.stdout||'')+(res.stderr||'')
  const idx = full.indexOf('__R__')
  if(idx===-1) return { ok:false, reason: full.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0,300) }
  try{ return { ok:true, out: JSON.parse(full.slice(idx+5).split(/\r?\n/)[0]) } } catch(e){ return { ok:false, reason:'parse '+e.message } }
}

// A. Manifest correto
console.log('--- A. Manifest correto ---')
{
  const r = runPure(`
    const m = mod.buildManifest('id:{data_id};request-id:{request_id};ts:{ts};', { dataId: 'ORD01ABC', requestId: '550e8400-e29b-41d4-a716-446655440000', ts: '1690000000' });
    return m;
  `)
  assert(r.ok && r.out === 'id:ord01abc;request-id:550e8400-e29b-41d4-a716-446655440000;ts:1690000000;', 'A: manifesto oficial com lowercase e ponto-e-vírgula final: '+JSON.stringify(r.out))
}

// B. data.id uppercase -> lowercase
console.log('\n--- B. data.id lowercase ---')
{
  const r = runPure(`
    const m1 = mod.buildManifest('id:{data_id};request-id:{request_id};ts:{ts};', { dataId: 'ORD01M2ZENM73MDGYVW0HYFF9J982', requestId: 'req-1', ts: '123' });
    const m2 = mod.buildManifest('id:{data_id};request-id:{request_id};ts:{ts};', { dataId: 'ord01m2zenm73mdgyvw0hyff9j982', requestId: 'req-1', ts: '123' });
    return { m1, m2, eq: m1===m2 };
  `)
  assert(r.ok && r.out.eq === true && r.out.m1.includes('ord01m2'), 'B: data.id uppercase normalizado para lowercase: '+JSON.stringify(r.out.m1).slice(0,80))
}

// C. data.id do body diferente do query não altera manifesto (verifica via query)
{
  const r = runPure(`
    const q = 'ORD01M2ZENM73MDGYVW0HYFF9J982';
    const b = 'ORD01M2ZEEEVC9BEWH10AJQ9SBSK3';
    const template='id:{data_id};request-id:{request_id};ts:{ts};';
    const mQuery = mod.buildManifest(template, { dataId: q, requestId: 'req-xyz', ts: '999' });
    const mBody = mod.buildManifest(template, { dataId: b, requestId: 'req-xyz', ts: '999' });
    return { mQuery, mBody, different: mQuery !== mBody };
  `)
  assert(r.ok && r.out.different === true, 'C: query vs body geram manifestos diferentes (prova que fonte importa)')
  // Route deve usar query
  assert(route.includes("request.nextUrl.searchParams.get('data.id')") || route.includes('searchParams.get("data.id")'), 'C: route.ts obtém data.id do query param')
  assert(!routeCode.includes("verifySignature({ headers, dataId: bodyDataId") || routeCode.includes('signatureDataId'), 'C: verify usa signatureDataId (query), não bodyDataId')
}

// D. assinatura válida -> verified
console.log('\n--- D. Assinatura válida ---')
{
  const r = runPure(`
    const crypto = await import('node:crypto');
    const secret='test_secret_123456';
    const template='id:{data_id};request-id:{request_id};ts:{ts};';
    const dataId='ORD01M2ZENM73MDGYVW0HYFF9J982';
    const requestId='550e8400-e29b-41d4-a716-446655440000';
    const ts=String(Date.now());
    const manifest=mod.buildManifest(template,{ dataId, requestId, ts });
    const v1=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
    const sig='ts='+ts+',v1='+v1;
    const res=mod.verifySignature({ headers:{ signature:sig, requestId }, dataId, secret, template });
    return res;
  `)
  assert(r.ok && r.out.status==='verified', 'D: assinatura válida com query data.id lowercase -> verified: '+JSON.stringify(r.out))
}

// E. assinatura inválida -> hmac_mismatch
console.log('\n--- E. HMAC inválido ---')
{
  const r = runPure(`
    const ts=String(Date.now());
    return mod.verifySignature({ headers:{ signature:'ts='+ts+',v1=0000000000000000000000000000000000000000000000000000000000000000', requestId:'req-1' }, dataId:'ORD01ABC', secret:'secret', template:'id:{data_id};request-id:{request_id};ts:{ts};' });
  `)
  assert(r.ok && r.out.status==='invalid' && r.out.reason==='hmac_mismatch', 'E: HMAC divergente -> hmac_mismatch: '+JSON.stringify(r.out))
}

// F. timestamp expirado -> timestamp_expired
console.log('\n--- F. Timestamp expirado ---')
{
  const r = runPure(`
    const crypto = await import('node:crypto');
    const secret='s'; const template='id:{data_id};request-id:{request_id};ts:{ts};';
    const dataId='ORD01ABC'; const requestId='req-1';
    const tsOld=String(Date.now()-20*60*1000); // 20 min atrás (>10min janela)
    const manifest=mod.buildManifest(template,{ dataId, requestId, ts:tsOld });
    const v1=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
    return mod.verifySignature({ headers:{ signature:'ts='+tsOld+',v1='+v1, requestId }, dataId, secret, template });
  `)
  assert(r.ok && r.out.status==='invalid' && r.out.reason==='timestamp_expired', 'F: ts expirado (>10min) -> timestamp_expired: '+JSON.stringify(r.out))
}

// G. ausência de x-request-id
console.log('\n--- G. Ausência de x-request-id ---')
{
  const r = runPure(`
    const crypto = await import('node:crypto');
    const secret='s2'; const template='id:{data_id};request-id:{request_id};ts:{ts};';
    const dataId='ORD01ABC';
    const ts=String(Date.now());
    const manifest=mod.buildManifest(template,{ dataId, requestId: null, ts });
    const v1=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
    // Verifica com requestId null (header ausente) — deve dar verified se manifest usou '' 
    const res=mod.verifySignature({ headers:{ signature:'ts='+ts+',v1='+v1, requestId: null }, dataId, secret, template });
    return { manifest, res };
  `)
  assert(r.ok && r.out.manifest === 'id:ord01abc;request-id:;ts:'+r.out.manifest.split('ts:')[1], 'G: manifest com request-id vazio quando header ausente')
  assert(r.ok && r.out.res.status==='verified', 'G: ausência de x-request-id com manifesto vazio -> verified (segue regra oficial: request-id vazio)')
}

// H. webhook order realista
console.log('\n--- H. Webhook realista ---')
{
  const r = runPure(`
    const crypto = await import('node:crypto');
    const secret='prod_secret_test';
    const template='id:{data_id};request-id:{request_id};ts:{ts};';
    const queryDataId='ORD01M2ZENM73MDGYVW0HYFF9J982';
    const bodyDataId='ORD01M2ZENM73MDGYVW0HYFF9J982';
    const requestId='a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const ts=String(Date.now());
    // Simula route: usa queryDataId
    const manifest=mod.buildManifest(template,{ dataId: queryDataId, requestId, ts });
    const v1=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
    const sig='ts='+ts+',v1='+v1;
    const resQuery=mod.verifySignature({ headers:{ signature:sig, requestId }, dataId: queryDataId, secret, template });
    // Se usasse body com mesmo valor, também verified
    const resBody=mod.verifySignature({ headers:{ signature:sig, requestId }, dataId: bodyDataId, secret, template });
    // Se body divergisse (ex: outro order), manifest divergiria mas verificação usa query, então falharia se verificasse com body?
    const resWrongBody=mod.verifySignature({ headers:{ signature:sig, requestId }, dataId: 'ORD01OTHER', secret, template });
    return { resQuery, resBody, resWrongBody };
  `)
  assert(r.ok && r.out.resQuery.status==='verified', 'H: query data.id + body igual -> verified')
  assert(r.ok && r.out.resBody.status==='verified', 'H: body id igual ao query -> também verified')
  assert(r.ok && r.out.resWrongBody.status==='invalid', 'H: body divergente do query -> invalid se verificar com body errado (prova que query é fonte)')
}

// Estrutural: route usa query param e lowercasing
console.log('\n--- Estrutural route.ts ---')
assert(route.includes('queryDataId') && route.includes("searchParams.get('data.id')"), 'route lê data.id do query param')
assert(route.includes('signatureDataId'), 'route usa signatureDataId para HMAC')
assert(route.includes('buildManifest') && route.includes('computeHmacHex'), 'route importa helpers para log mascarado')
assert(route.includes('missing_data_id') && route.includes('timestamp_expired') && route.includes('hmac_mismatch'), 'route tem reasons granulares')
assert(route.includes('dataIdPrefix') && route.includes('requestIdPrefix') && route.includes('driftMs'), 'route loga diagnóstico mascarado')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(routeCode), 'route não expõe Access Token')
assert(route.includes("status !== 'verified'") && route.includes('401'), 'fail-closed preservado')

// Estrutural sig: lowercase
assert(sig.includes('toLowerCase()') && sig.includes('normalizedDataId'), 'sig lowercases dataId para manifesto')
assert(sig.includes("reason: 'timestamp_expired'") && sig.includes("reason: 'hmac_mismatch'") && sig.includes("reason: 'missing_data_id'"), 'sig tem reasons granulares PIX-020')

console.log('\n=== PIX-020 OK ===')
if(process.exitCode) console.log('❌ Falhas PIX-020')
else console.log('✅ PIX-020 webhook signature OK')
