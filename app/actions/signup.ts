'use server'

import { createClient } from '@supabase/supabase-js'

// Cria cliente ADMIN (Service Role) para pular restrições e checar convites
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function signUpWithInviteCode(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const inviteCode = formData.get('inviteCode') as string

  if (!email || !password || !inviteCode) {
    return { success: false, message: 'Preencha todos os campos.' }
  }

  try {
    // 1. Verifica se o código existe e NÃO foi usado
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('code', inviteCode)
      .eq('is_used', false)
      .single()

    if (codeError || !codeData) {
      return { success: false, message: 'Código de convite inválido ou já utilizado.' }
    }

    // 2. Cria o usuário no Auth
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { invite_code: inviteCode }
    })

    if (authError) {
      return { success: false, message: authError.message }
    }

    // 3. Marca o código como USADO
    await supabaseAdmin
      .from('invite_codes')
      .update({ is_used: true })
      .eq('id', codeData.id)

    // 4. Cria o estado inicial do usuário (Evita tela de carregamento eterno no dashboard)
    if (userData.user) {
        await supabaseAdmin.from('user_state').insert({
            user_id: userData.user.id,
            track: 'Interlagos', // Pista padrão
            // Outros campos assumirão o default do banco
        })
    }

    return { success: true, message: 'Conta criada com sucesso!' }

  } catch (error) {
    console.error('Erro no cadastro:', error)
    return { success: false, message: 'Erro interno no servidor.' }
  }
}