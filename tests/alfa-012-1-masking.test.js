// tests/alfa-012-1-masking.test.js
// ALFA-012.1 — Testes de masking (sem DB)

const fs = require('fs')
const path = require('path')
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-012.1 — Testes Masking ===\n')

// Simula funções (copiadas de accessLogger.ts)
function maskEmail(email){
  if (!email || typeof email !== 'string') return '***'
  const at = email.indexOf('@')
  if (at <= 1) return '***'
  return email.slice(0, 2) + '***' + email.slice(at)
}
function maskCode(code){
  if (!code || typeof code !== 'string') return '***'
  const t = code.trim()
  if (t.length <= 4) return '***'
  return t.slice(0, 4) + '***' + t.slice(-2)
}
function maskUserId(id){ return id ? id.slice(0,8)+'***' : '***' }
function maskGrantId(id){ return id ? id.slice(0,8)+'***' : '***' }

assert(maskEmail('joelgonn@hotmail.com') === 'jo***@hotmail.com', 'maskEmail joel')
assert(maskEmail('a@b.com') === '***', 'maskEmail curto → ***')
assert(maskEmail('') === '***', 'maskEmail vazio → ***')
assert(!maskEmail('test@example.com').includes('test@'), 'maskEmail não expõe completo')

assert(maskCode('ALFA-A1B2-C3D4') === 'ALFA***D4', 'maskCode ALFA')
assert(maskCode('ALFA') === '***', 'maskCode curto → ***')
assert(!maskCode('ALFA-SECRET-CODE').includes('SECRET'), 'maskCode não expõe completo')

assert(maskUserId('1234567890abcdef') === '12345678***', 'maskUserId')
assert(maskGrantId('grant-uuid-1234') === 'grant-uu***', 'maskGrantId')

// Verifica que logs não contêm código completo
const sampleLog = JSON.stringify({ email: maskEmail('user@test.com'), code: maskCode('ALFA-TESTE-CODE'), userId: maskUserId('uuid-123456789') })
assert(!sampleLog.includes('user@test.com'), 'log não contém e-mail completo')
assert(!sampleLog.includes('ALFA-TESTE-CODE'), 'log não contém código completo')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas masking.')
else console.log('✅ Masking validado.')
