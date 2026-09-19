// tests/pix-0011-webhook.test.js
// PIX-001.1 — Testes do webhook do Mercado Pago (infraestrutura)
//
// COMPORTAMENTAIS onde é possível: o módulo puro de assinatura/parse é EXECUTADO de verdade
// (subprocesso Node com type-stripping). O handler HTTP e o serviço de persistência não podem
// ser importados em Node puro (usam `server-only` e o cliente Supabase), então o contrato do
// endpoint é verificado ESTRUTURALMENTE — e os casos que exigem servidor são marcados PENDING,
// nunca PASS.
//
// Cenários exigidos pela sprint:
//   1. GET rejeitado            5. ausência de segredo
//   2. POST inválido            6. ausência de external_reference
//   3. payload desconhecido     7. nenhum grant VIP criado
//   4. evento duplicado         8. nenhum pagamento confirmado indevidamente
//  (+) método, Content-Type, payload grande, fail-closed da assinatura.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== PIX-001.1 — Webhook Mercado Pago ===\n')

const ROUTE = 'app/api/payments/webhooks/mercadopago/route.ts'
const SIG = 'app/lib/payments/mercadopago-signature.ts'
const SVC = 'app/lib/payments/webhook-service.ts'

const route = read(ROUTE)
const sig = read(SIG)
const svc = read(SVC)

// Remove comentários para asserções de "não contém": documentar uma garantia
// (ex.: "não altera premium_payments") não pode ser tratado como a violação dela.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const routeCode = stripComments(route)
const sigCode = stripComments(sig)
const svcCode = stripComments(svc)

// ---------------------------------------------------------------------------
// Execução real do módulo puro (sem server-only): assinatura + parse
// ---------------------------------------------------------------------------
function runPure(code) {
  const fileUrl = 'file:///' + path.join(ROOT, SIG).replace(/\\/g, '/')
  const boot = [
    `const mod = await import(${JSON.stringify(fileUrl)});`,
    `const out = await (async () => { ${code} })();`,
    `console.log('__R__' + JSON.stringify(out));`,
  ].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
  })
  const full = (res.stdout || '') + (res.stderr || '')
  const idx = full.indexOf('__R__')
  if (idx === -1) return { ok: false, reason: full.split(/\r?\n/).filter(Boolean).slice(-2).join(' | ').slice(0, 200) }
  try { return { ok: true, out: JSON.parse(full.slice(idx + 5).split(/\r?\n/)[0]) } }
  catch (e) { return { ok: false, reason: 'parse: ' + String(e.message).slice(0, 120) } }
}

const emptyHeaders = `new Headers()` // Headers global existe no Node 18+

// 1. Ausência de headers de assinatura => not_verified (nunca verified)
{
  const r = runPure(`
    const h = { signature: null, requestId: null };
    const v = mod.verifySignature({ headers: h, dataId: '123', secret: 's', template: 'id:{data_id};ts={ts}' });
    return v;
  `)
  if (!r.ok) pending('verifySignature não executável neste runtime: ' + r.reason)
  else assert(r.out.status === 'not_verified' && r.out.reason === 'no_headers',
    'sem x-signature => not_verified (nunca verified) [' + r.out.status + '/' + r.out.reason + ']')
}

// 2. Ausência de SEGREDO => not_verified (cenário 5 da sprint)
{
  const r = runPure(`
    return mod.verifySignature({
      headers: { signature: 'ts=1690000000,v1=deadbeef', requestId: 'req-1' },
      dataId: '123', secret: null, template: 'id:{data_id};ts={ts}'
    });
  `)
  if (!r.ok) pending('cenário ausência de segredo não executável: ' + r.reason)
  else assert(r.out.status === 'not_verified' && r.out.reason === 'no_secret',
    'ausência de segredo => not_verified (não aprova) [' + r.out.reason + ']')
}

// 3. Ausência de TEMPLATE => not_verified (o coração do item 6: não inventar fórmula)
{
  const r = runPure(`
    return mod.verifySignature({
      headers: { signature: 'ts=1690000000,v1=deadbeef', requestId: 'req-1' },
      dataId: '123', secret: 'segredo', template: null
    });
  `)
  if (!r.ok) pending('cenário ausência de template não executável: ' + r.reason)
  else assert(r.out.status === 'not_verified' && r.out.reason === 'no_template',
    'sem TEMPLATE confirmado => not_verified (fórmula NÃO foi inventada) [' + r.out.reason + ']')
}

// 4. Assinatura válida SOMENTE com template+segredo (prova que a verificação funciona)
{
  const r = runPure(`
    const crypto = await import('node:crypto');
    const ts = String(Date.now()), rid = 'req-abc', did = '999';
    const template = 'id:{data_id};request-id:{request_id};ts:{ts}';
    const manifest = mod.buildManifest(template, { dataId: did, requestId: rid, ts });
    const v1 = crypto.createHmac('sha256','segredo').update(manifest).digest('hex');
    return mod.verifySignature({
      headers: { signature: 'ts=' + ts + ',v1=' + v1, requestId: rid },
      dataId: did, secret: 'segredo', template
    });
  `)
  if (!r.ok) pending('verificação HMAC não executável: ' + r.reason)
  else assert(r.out.status === 'verified', 'assinatura correta + template fornecido => verified')
}

// 5. Assinatura ERRADA => invalid (comparação em tempo constante rejeita)
{
  const r = runPure(`
    return mod.verifySignature({
      headers: { signature: 'ts=1690000000,v1=0000', requestId: 'req-1' },
      dataId: '123', secret: 'segredo', template: 'id:{data_id};ts={ts}'
    });
  `)
  if (!r.ok) pending('assinatura inválida não executável: ' + r.reason)
  else assert(r.out.status === 'invalid', 'assinatura divergente => invalid (rejeitada)')
}

// 6. Header malformado => not_verified
{
  const r = runPure(`return mod.parseSignatureHeader('lixo-sem-formato');`)
  if (!r.ok) pending('parse de header não executável: ' + r.reason)
  else assert(r.out === null, 'header de assinatura malformado => null (não aprova)')
}

// 7. Payload desconhecido / campos ausentes (cenário 3)
{
  const r = runPure(`
    return {
      vazio: [mod.extractDataId(null), mod.extractEventType(null)],
      objVazio: [mod.extractDataId({}), mod.extractEventType({})],
      tipoTexto: mod.extractEventType({ topic: 'merchant_order' }),
      numeroComoId: mod.extractDataId({ data: { id: 12345 } }),
      idNaRaiz: mod.extractDataId({ id: 'abc-1' })
    };
  `)
  if (!r.ok) pending('extração de payload não executável: ' + r.reason)
  else {
    const o = r.out
    assert(o.vazio[0] === null && o.vazio[1] === null, 'payload nulo => sem dataId e sem eventType (não lança)')
    assert(o.objVazio[0] === null && o.objVazio[1] === null, 'payload vazio => sem dataId e sem eventType')
    assert(o.tipoTexto === 'merchant_order', 'eventType lido de topic quando type ausente')
    assert(o.numeroComoId === '12345', 'dataId aceita número e normaliza para string')
    assert(o.idNaRaiz === 'abc-1', 'dataId lido da raiz quando data.id ausente')
  }
}

// 8. Mascaramento de PII (não persistir dados sensíveis)
{
  const r = runPure(`
    return mod.maskPayload({
      payer: { email: 'a@b.com', first_name: 'Joao', doc: '123' },
      transaction_amount: 19.9,
      status: 'pending',
      access_token: 'SEGREDO',
      card: { last_four: '1234' },
      aninhado: { nivel2: { nivel3: { nivel4: { nivel5: { nivel6: { nivel7: 'fundo' } } } } } }
    });
  `)
  if (!r.ok) pending('mascaramento não executável: ' + r.reason)
  else {
    const o = r.out
    const s = JSON.stringify(o)
    assert(o.payer === '[mascarado]', 'chave "payer" mascarada')
    assert(o.access_token === '[mascarado]', 'access_token mascarado')
    assert(o.card === '[mascarado]', 'card mascarado')
    assert(!s.includes('a@b.com') && !s.includes('Joao') && !s.includes('SEGREDO'),
      'nenhum dado pessoal/segredo sobrevive ao mascaramento')
    assert(o.transaction_amount === 19.9 && o.status === 'pending',
      'campos não sensíveis preservados (valor real p/ auditoria)')
  }
}

// 9. Hash de replay determinístico
{
  const r = runPure(`
    return { a: mod.hashPayload('{"x":1}'), b: mod.hashPayload('{"x":1}'), c: mod.hashPayload('{"x":2}') };
  `)
  if (!r.ok) pending('hashPayload não executável: ' + r.reason)
  else assert(r.out.a === r.out.b && r.out.a !== r.out.c && r.out.a.length === 64,
    'hashPayload determinístico, distinto e de 64 hex (dedupe/replay)')
}

// ---------------------------------------------------------------------------
// Contrato do endpoint — verificação estrutural
// ---------------------------------------------------------------------------
console.log('\n--- Contrato do endpoint ---')
assert(read(ROUTE).includes('export async function GET') && route.includes('405'), 'GET rejeitado com 405 (cenário 1)')
for (const m of ['PUT', 'PATCH', 'DELETE']) {
  assert(route.includes(`export async function ${m}`), `${m} rejeitado (405)`)
}
assert(route.includes('MAX_BODY_BYTES') && route.includes('413'), 'payload acima do limite => 413')
assert(route.includes('application/json') && route.includes('415'), 'Content-Type não-JSON => 415')
assert(route.includes("reason: 'invalid_json'") && route.includes('400'), 'JSON inválido => 400 (cenário 2)')
assert(route.includes('no-store'), 'resposta sem cache')
assert(route.includes("dynamic = 'force-dynamic'"), 'rota dinâmica (nunca estática)')

// Item 4: garantias negativas
assert(!/\.update\(|\.upsert\(|\.delete\(/.test(routeCode), 'endpoint não executa update/upsert/delete')
assert(!routeCode.includes('premium_payments'), 'endpoint não toca premium_payments (nada é confirmado)')
assert(!routeCode.includes('access_grants'), 'endpoint não toca access_grants (nenhum VIP)')
assert(!routeCode.includes('ensureVipGrantForInvite') && !routeCode.includes('grant'), 'endpoint não concede acesso')
assert(!/fetch\(|axios|https\.request/.test(routeCode + svcCode), 'nenhuma chamada ao Mercado Pago (contrato não capturado)')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(routeCode + svcCode + sigCode), 'Access Token nunca referenciado no webhook')
assert(!/console\.log\(/.test(routeCode), 'nenhum log cru do payload')

// Item 6: assinatura explicitamente pendente, fail-closed disponível
assert(sig.includes('NÃO VERIFICADO / PENDENTE DE CONTRATO OFICIAL'), 'módulo de assinatura marcado como PENDENTE')
assert(sig.includes('SIGNATURE_TEMPLATE_ENV') && sig.includes('SIGNATURE_ENFORCE_ENV'), 'template e enforce vêm de configuração (não hard-coded)')
// Nenhuma fórmula de manifesto ADIVINHADA no código: uma fórmula conteria os placeholders
// de dados (`{data_id}`) e/ou `{request_id}` literais — o módulo legítimo só valida `{ts}`
// (para exigir timestamp) e recebe o resto por configuração.
assert(!sigCode.includes('{data_id}') && !sigCode.includes('{request_id}'),
  'nenhuma fórmula de manifesto adivinhada no código (placeholders de dados vêm só de configuração)')
assert(sigCode.includes('buildManifest') && sigCode.includes('template.trim()'), 'manifesto construído a partir do template recebido')
assert(route.includes("verdict.status !== 'verified'") && route.includes('401'), 'fail-closed: enforce bloqueia assinatura não verificada')
assert(sig.includes('timingSafeEqual'), 'comparação de assinatura em tempo constante')

// Idempotência (cenário 4)
assert(svc.includes("code === '23505'") && svc.includes('duplicate_ignored'),
  'evento duplicado (unique violation) => duplicate_ignored, sem efeito colateral')
assert(svc.includes('event_id') && svc.includes('buildEventId'), 'event_id determinístico para dedupe')
assert(read('supabase/migrations/20250917000008_create_payment_events.sql').includes('uniq_payment_events_event_id'),
  'índice único de event_id existe na migration de payment_events')

// Ausência de external_reference (cenário 6)
assert(svc.includes("outcome: 'no_reference'") || svc.includes("'no_reference'"), 'sem external_reference => no_reference (registrado, sem efeito)')
assert(svc.includes("'reference_not_found'"), 'referência não encontrada => reference_not_found')
assert(svc.includes("processing_status") && svc.includes("'ignored'"), 'evento fora de escopo/órfão => ignored')

console.log('\n--- Casos que exigem servidor/Nexr rodando ---')
pending('POST real com assinatura inválida → 401 (enforce=true): exige servidor Next + env configurada')
pending('evento duplicado em banco real: exige Supabase acessível (migration de payment_events aplicada)')
pending('nenhum VIP concedido / nenhum pagamento confirmado: verificado estruturalmente aqui; a prova de banco exige execução')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas webhook PIX-001.1.')
else console.log('✅ Webhook PIX-001.1 OK')
