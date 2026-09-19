// app/dashboard/layout.tsx
// ============================================================
// PIX-015 — GUARD SERVER-SIDE DA ÁREA /dashboard (FREE / PREMIUM / ADMIN)
// ============================================================
// Antes: este arquivo era 100% cliente e NÃO havia nenhuma autorização — qualquer
// usuário autenticado (inclusive o usuário GRATUITO do ALFA-015) abria
// /dashboard/manager por URL direta, por refresh ou pelo botão "Painel".
//
// Agora a autorização acontece NO SERVIDOR, antes de qualquer HTML da área ser
// renderizado, usando a regra única de app/lib/access/authorization.ts:
//   - anonymous → /login?next=<destino>
//   - free      → /planos?motivo=premium  (mantém /planos funcionando)
//   - premium   → liberado
//   - admin     → liberado (user_state.role = 'admin')
//
// A UI (sidebar, GameProvider, menu mobile) continua no componente cliente
// DashboardShell, que recebe os children já autorizados.
//
// Não há checagem de privilégio no cliente aqui de propósito: o cliente não é
// autoridade. Se um dia o shell precisar saber o nível de acesso para a UI, ele
// deve receber isso por prop deste server component — nunca recalcular sozinho.
// ============================================================

import { requireDashboardAccess } from '@/app/lib/access/authorization'
import { DashboardShell } from './DashboardShell'

// Acesso depende da sessão (cookies) e do estado no banco: nunca cachear/prerenderizar.
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Redireciona anonymous → /login e free → /planos. Premium/admin seguem.
  await requireDashboardAccess('/dashboard')

  return <DashboardShell>{children}</DashboardShell>
}
