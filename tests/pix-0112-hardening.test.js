// tests/pix-0112-hardening.test.js
// PIX-011.2 — Hardening complementar (freshness, manifest, dedupe, catch)

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }

const ROOT = path.join(__dirname, '..');
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8') }

console.log('=== PIX-011.2 Hardening ===\n');

const sig = read('app/lib/payments/mercadopago-signature.ts');
const svc = read('app/lib/payments/webhook-service.ts');
const server = read('utils/supabase/server.ts');

// 1. Freshness
console.log('--- 1. Freshness ---');
assert(sig.includes('Math.abs(now - tsMs)') && sig.includes('windowMs'), 'freshness janela implementada');
assert(sig.includes("reason: 'mismatch'") && sig.includes('drift'), 'ts expirado/futuro → mismatch');

// 2. Manifest robusto (compatível com pix-0011: não exige hard-code de placeholders, mas testado via execução)
console.log('\n--- 2. Manifest ---');
assert(sig.includes("buildManifest") && sig.includes("template"), 'buildManifest existe');

// 3. Dedupe sem limit(10)
console.log('\n--- 3. Dedupe ---');
assert(!svc.includes('.limit(10)'), 'webhook-service sem limit(10) artificial');
assert(svc.includes("filter('metadata->>order_id'"), 'dedupe via filter metadata->>order_id');

// 4. Catch silencioso
console.log('\n--- 4. Catch ---');
assert(server.includes("console.warn('supabase setAll failed'"), 'server.ts catch loga warning');
assert(!/catch\s*\{\s*\}/.test(server), 'sem catch {} silencioso em server.ts');

// 5. Testes de execução pura
console.log('\n--- 5. Execução pura ---');
const mod = 'file:///' + path.join(ROOT, 'app/lib/payments/mercadopago-signature.ts').replace(/\\/g,'/');
const r = spawnSync(process.execPath, ['--experimental-strip-types','--input-type=module','-e', `
import { buildManifest, verifySignature, computeHmacHex } from ${JSON.stringify(mod)};
const secret='test_secret_123';
const template='id:{data_id};request-id:{request_id};ts:{ts};';
const dataId='ORDTST01M2X1JZB8BKMZY8XN8499N1GK';
const requestId='req-123';
const tsOk=String(Date.now());
const manifestOk=buildManifest(template,{dataId, requestId, ts:tsOk});
const v1Ok=computeHmacHex(secret, manifestOk);
const sigOk='ts='+tsOk+',v1='+v1Ok;
const resOk=verifySignature({headers:{signature:sigOk, requestId}, dataId, secret, template});
console.log('__R__'+JSON.stringify({ok:resOk.status==='verified'}));

const tsOld=String(Date.now()-11*365*24*60*60*1000);
const manifestOld=buildManifest(template,{dataId, requestId, ts:tsOld});
const v1Old=computeHmacHex(secret, manifestOld);
const sigOld='ts='+tsOld+',v1='+v1Old;
const resOld=verifySignature({headers:{signature:sigOld, requestId}, dataId, secret, template});
console.log('__R2__'+JSON.stringify({old:resOld.status==='invalid'}));

const badTemplate='id:{data_id};request-id:{request_id};';
const manifestBad=buildManifest(badTemplate,{dataId, requestId, ts:tsOk});
console.log('__R3__'+JSON.stringify({bad:manifestBad===null}));
`], {timeout:8000, encoding:'utf8'});
const out = (r.stdout||'')+(r.stderr||'');
const hasOk = out.includes('"ok":true');
const hasOld = out.includes('"old":true');
const hasBad = out.includes('"bad":true');
assert(hasOk, 'HMAC válido dentro da janela → verified');
assert(hasOld, 'HMAC com ts expirado (>5min) → mismatch');
assert(hasBad, 'template sem 3 placeholders → null');

console.log('\n=== PIX-011.2 OK ===');
if(process.exitCode) console.log('❌ Falhas PIX-011.2');
else console.log('✅ PIX-011.2 hardening OK');
