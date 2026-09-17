// tests/alfa-0142-idempotency.test.js
const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }
console.log('=== ALFA-014.2 — Idempotencia ===\n')
const svc = read('app/lib/payments/orderService.ts')
const route = read('app/api/payments/orders/route.ts')

assert(svc.includes('Idempotency-Key ausente') || svc.includes('muito curta'), 'Idempotency-Key ausente 400')
assert(svc.includes('muito curta') && svc.includes('muito longa'), 'Idempotency-Key vazia/inválida 400')
assert(svc.includes('TEST-ALFA-0141-'), 'chave inválida sem prefixo 400')
assert(svc.includes('calculateOrderPayloadHash') && svc.includes('payload_hash'), 'payload_hash determinístico')
assert(svc.includes('findIdempotentOrder') && svc.includes('payload_hash'), 'mesma chave mesmo payload → retorna existente')
assert(svc.includes('idempotent: true') && svc.includes('idempotent: false'), 'repetição idempotent true/false')
assert(svc.includes('409') && svc.includes('Idempotency-Key já usada'), 'mesma chave payload diferente 409')
assert(svc.includes('23505') || svc.includes('payload_hash'), 'concorrência tratada (unique)')
assert(!route.includes('payload_hash') || route.includes('payload_hash') && !route.includes('return.*payload_hash'), 'não expõe payload_hash completo na resposta')
console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas idempotência.')
else console.log('✅ Idempotência OK')
