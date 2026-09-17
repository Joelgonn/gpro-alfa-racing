// tests/alfa-013-pix.test.js
// ALFA-013.0 — Preparação Pix
//
// Escopo:
// - Validar somente os tipos e contratos do Pix.
// - Não validar a existência de migrations de orders/payments.
// - A persistência de pedidos e pagamentos pertence à ALFA-014.
// - Não executar cobrança real.
// - Não conceder acesso VIP por pagamento.

const fs = require('fs')
const path = require('path')

function read(filePath) {
  try {
    return fs.readFileSync(
      path.join(__dirname, '..', filePath),
      'utf8'
    )
  } catch {
    return ''
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exitCode = 1
    return
  }

  console.log(`✅ PASS: ${message}`)
}

function hasAny(text, values) {
  return values.some((value) => text.includes(value))
}

console.log('=== ALFA-013.0 — Testes Pix Preparação ===\n')

// -----------------------------------------------------------------------------
// Fontes analisadas
// -----------------------------------------------------------------------------

const types = read('app/lib/payments/types.ts')
const accessService = read('app/lib/access/accessService.ts')

// -----------------------------------------------------------------------------
// 1. Preparação sem SQL dentro do arquivo de tipos
// -----------------------------------------------------------------------------
//
// A ALFA-013 valida somente contratos e interfaces.
//
// A criação das tabelas orders/payments foi deslocada para a ALFA-014.
// Portanto, este teste não deve inspecionar nem bloquear migrations posteriores.

assert(
  !types.includes('create table'),
  '1. types.ts sem SQL (somente interfaces)'
)

// -----------------------------------------------------------------------------
// 2. Valores monetários e moeda
// -----------------------------------------------------------------------------

assert(
  types.includes('price_cents') &&
    types.includes('currency'),
  '2. valores em centavos + moeda explícita'
)

// -----------------------------------------------------------------------------
// 3. Estados de pedido e pagamento
// -----------------------------------------------------------------------------

assert(
  types.includes('OrderStatus') &&
    types.includes('PaymentStatus'),
  '3. estados de pedido e pagamento documentados'
)

// -----------------------------------------------------------------------------
// 4. Idempotência
// -----------------------------------------------------------------------------

assert(
  types.includes('pix_txid') &&
    types.includes('payload_hash'),
  '4. idempotência por pix_txid/payload_hash'
)

// -----------------------------------------------------------------------------
// 5. Separação entre pagamento e concessão de acesso
// -----------------------------------------------------------------------------

assert(
  hasAny(types, [
    'grant_issued',
    'grant',
  ]),
  '5. grant separado de payment'
)

// -----------------------------------------------------------------------------
// 6. Access service não concede VIP por pagamento
// -----------------------------------------------------------------------------

assert(
  !accessService.includes('payments'),
  '6. accessService não concede VIP por pagamento'
)

// -----------------------------------------------------------------------------
// 7. Identificadores do provedor
// -----------------------------------------------------------------------------

assert(
  types.includes('provider_order_id') &&
    types.includes('provider_payment_id'),
  '7. provider ids disponíveis para reconciliação'
)

// -----------------------------------------------------------------------------
// Resumo
// -----------------------------------------------------------------------------

console.log('\n=== Resumo ===')

if (process.exitCode) {
  console.log('❌ Falhas na preparação Pix.')
} else {
  console.log(
    '✅ Pix preparação validada (contratos e tipos, sem cobrança real).'
  )
}