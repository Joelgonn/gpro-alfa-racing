import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verifica papel admin via user_state (server only, service role)
  const { data: userState } = await supabaseAdmin
    .from('user_state')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!userState || userState.role !== 'admin') {
    redirect('/dashboard?error=admin_required')
  }

  return <>{children}</>
}
