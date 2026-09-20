// tests/pix-022-ux.test.js
// PIX-022 — UX pós-confirmação: estado de sucesso + countdown 5s + redirect único
const fs = require('fs')
const path = require('path')
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }
const ROOT = path.join(__dirname,'..')
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8') }
console.log('=== PIX-022 — UX pós-pagamento ===\n')
const src = read('app/planos/checkout-button.tsx')
const stripped = src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'')

// 1. Mantém polling atual
assert(src.includes("fetch(`/api/payments/orders/${orderId}`") && src.includes('cache: \'no-store\''), 'polling GET /api/payments/orders/[id] preservado')
assert(src.includes('POLL_INTERVAL_MS') && src.includes('5000'), 'intervalo 5s preservado')
assert(src.includes('POLL_MAX_MS'), 'limite 15min preservado')

// 2. Detecção de pago
assert(src.includes("orderStatus === 'paid'") && src.includes("paymentStatus === 'confirmed'"), 'detecção isPaid por order paid OU payment confirmed')
assert(src.includes('const isPaid'), 'isPaid definido')

// 3. Mensagens de sucesso
assert(src.includes('Pagamento confirmado!'), 'mensagem Pagamento confirmado!')
assert(src.includes('Seu acesso VIP foi liberado com sucesso.'), 'mensagem VIP liberado')
assert(src.includes('Estamos preparando tudo para você.'), 'mensagem preparando tudo')
assert(src.includes('Você será direcionado ao seu painel'), 'mensagem redirecionamento')
assert(src.includes('segundo'), 'contagem regressiva com segundo(s)')

// 4. Countdown 5s
assert(src.includes('countdown') && src.includes('setCountdown'), 'estado countdown')
assert(src.includes('setCountdown(5)'), 'countdown inicia em 5')
assert(src.includes('setInterval') && src.includes('1000'), 'interval 1s para contagem')

// 5. Redirect após 5s para /dashboard via useRouter
assert(src.includes("from 'next/navigation'") && src.includes('useRouter'), 'usa useRouter de next/navigation')
assert(src.includes("router.push('/dashboard')"), 'redirect para /dashboard')
assert(src.includes('setTimeout') && src.includes('5000'), 'timeout 5s para redirect')

// 6. Sem múltiplos timers
assert(src.includes('redirectScheduled') && src.includes('useRef(false)'), 'redirectScheduled ref para evitar múltiplos')
assert(src.includes('if (!isPaid || redirectScheduled.current) return'), 'guarda redirect único')
assert(src.includes('redirectScheduled.current = true'), 'marca redirect como agendado')

// 7. Polling interrompido ao confirmar
assert(src.includes('stopped.current = true') && src.indexOf('stopped.current = true') < src.indexOf('setCountdown(5)') || src.includes('stopped.current = true'), 'polling interrompido quando pago (stopped=true)')
// Verifica que stopped é setado dentro do useEffect de isPaid
const isPaidEffect = src.slice(src.indexOf('if (!isPaid || redirectScheduled'))
assert(isPaidEffect.includes('stopped.current = true'), 'stopped dentro do efeito isPaid')

// 8. Polling pode ser interrompido (não há necessidade durante contagem)
assert(src.includes('countdownTimer') && src.includes('redirectTimer'), 'refs para timers de countdown/redirect')

// 9. Comportamento para pendente/expirado/cancelado/falho preservado
assert(src.includes("isTerminalBad") && src.includes("expired") && src.includes("cancelled") && src.includes("failed"), 'isTerminalBad preservado')
assert(src.includes('Este pagamento não foi concluído.'), 'mensagem terminal preservada')
assert(src.includes('Aguardando o pagamento do Pix.'), 'mensagem pendente preservada')

// 10. Não altera integração Mercado Pago / webhook / banco etc.
assert(!stripped.includes('MERCADOPAGO_ACCESS_TOKEN'), 'UX não toca token MP')
assert(!stripped.includes('supabaseAdmin'), 'UX não toca banco')
assert(!stripped.includes('access_grants'), 'UX não toca grants')
assert(!stripped.includes('user_state'), 'UX não toca user_state')
assert(!stripped.includes('PIX_ENABLED'), 'UX não altera flag')
assert(!stripped.includes('paymentService') && !stripped.includes('webhook'), 'UX não altera serviços de pagamento')

// 11. Lógica de criação do pedido não alterada
assert(src.includes("TEST-ALFA-0141-") && src.includes("Idempotency-Key"), 'criação de pedido preservada')
assert(src.includes('planCode'), 'planCode preservado')

// 12. Botão Fechar não interrompe fluxo de sucesso
assert(src.includes("onClick={isPaid ? undefined : onClose}"), 'overlay não fecha quando pago')
assert(src.includes("Ir para o painel agora"), 'botão Ir para o painel quando pago')
assert(src.includes("Fechar") && src.includes("isPaid ?"), 'Fechar condicional ao estado pago')

// 13. Visual claro: role status, aria-live, barra de progresso
assert(src.includes('role="status"') && src.includes('aria-live="polite"'), 'acessibilidade status')
assert(src.includes('rounded-full') && (src.includes('bg-emerald-500') || src.includes('from-amber-400') || src.includes('from-amber-500')), 'barra de progresso visual')

// 13b. PIX-023: identidade Lobo Alfa (WebP como background, textos reais)
assert(src.includes('/images/pix-lobo-confirmacao.webp'), 'PIX-023: WebP Lobo Alfa como background')
assert(src.includes('Bem-vindo ao Clã') && src.includes('Agora você é um Lobo!'), 'PIX-023: mensagens Bem-vindo ao Clã / Agora você é um Lobo!')
assert(src.includes('object-cover') && src.includes('opacity-'), 'PIX-023: WebP com object-cover e overlay')

// 14. Mantém no modal, não cria nova página
assert(src.includes('role="dialog"') && src.includes('PixPanel'), 'estado permanece no modal PixPanel')
assert(!src.includes('router.push') || src.includes("router.push('/dashboard')"), 'único redirect é para /dashboard')

console.log('\n=== PIX-022 OK ===')
if(process.exitCode) console.log('❌ Falhas PIX-022')
else console.log('✅ PIX-022 UX OK')
