// app/lib/access/routeMatrix.ts
// FASE 5 — Route Matrix: documentação central de autorização (não é middleware global)
// Guards existentes permanecem: requireDashboardAccess, guardPremiumApi, requireAdmin
// VIP_CHECK permanece false.

export type RouteMatrixEntry = {
  route: string
  method: string
  subject: 'public' | 'user' | 'admin'
  permission: 'public' | 'auth' | 'vip' | 'admin'
  guard: 'none' | 'requireDashboardAccess' | 'guardPremiumApi' | 'requireAdmin' | 'verifySignature'
  source: string
  test?: string
}

export const ROUTE_MATRIX: RouteMatrixEntry[] = [
  // Páginas públicas
  { route: '/', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—', test: 'pix-002-plans' },
  { route: '/login', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—' },
  { route: '/cadastro', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—' },
  { route: '/planos', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—' },

  // Dashboard VIP
  { route: '/dashboard/*', method: 'GET', subject: 'user', permission: 'vip', guard: 'requireDashboardAccess', source: 'access_grants', test: 'pix-015-free-premium-access' },
  { route: '/dashboard/admin/*', method: 'GET', subject: 'admin', permission: 'admin', guard: 'requireAdmin', source: 'role' },

  // APIs públicas
  { route: '/api/test-calculator', method: 'POST', subject: 'public', permission: 'public', guard: 'none', source: '—' },
  { route: '/api/manual', method: 'POST', subject: 'public', permission: 'public', guard: 'none', source: '—' },
  { route: '/api/python?action=tracks', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—' },
  { route: '/api/python?action=tyre_suppliers', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: '—' },

  // APIs autenticadas (sem VIP) — funil
  { route: '/api/payments/orders', method: 'POST', subject: 'user', permission: 'auth', guard: 'none', source: 'auth.getUser', test: 'pix-009' },
  { route: '/api/payments/orders/[id]', method: 'GET', subject: 'user', permission: 'auth', guard: 'none', source: 'auth.getUser' },

  // Webhook
  { route: '/api/payments/webhooks/mercadopago', method: 'POST', subject: 'public', permission: 'public', guard: 'verifySignature', source: 'HMAC' },

  // APIs VIP
  { route: '/api/gpro/sync', method: 'POST', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },
  { route: '/api/gpro/token', method: 'GET|POST|DELETE', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },
  { route: '/api/manager/profile', method: 'GET', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },
  { route: '/api/market/update', method: 'GET|POST', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },
  { route: '/api/calendar', method: 'GET', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },
  { route: '/api/python', method: 'GET|POST', subject: 'user', permission: 'vip', guard: 'guardPremiumApi', source: 'access_grants' },

  // ADMIN
  { route: '/api/admin/*', method: '*', subject: 'admin', permission: 'admin', guard: 'requireAdmin', source: 'role' },
  // gpro-kb/explore permanece ADMIN provisoriamente — TODO futuro avaliar VIP
  { route: '/api/gpro-kb/explore', method: 'POST', subject: 'admin', permission: 'admin', guard: 'requireAdmin', source: 'role' },

  // Cron
  { route: '/api/cron/expire', method: 'GET', subject: 'public', permission: 'public', guard: 'none', source: 'CRON_SECRET' },
]

// TODO FUTURO: avaliar eventual disponibilização de /api/gpro-kb/explore para VIP
