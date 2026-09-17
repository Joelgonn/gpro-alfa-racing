'use server'

import { createClient } from '@supabase/supabase-js'
import { accessLogger, maskUserId, maskInviteId, nextCorrelationId } from '@/app/lib/access/accessLogger'

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
  const emailRaw = formData.get('email') as string
  const password = formData.get('password') as string
  const inviteCodeRaw = formData.get('inviteCode') as string

  if (!emailRaw || !password || !inviteCodeRaw) {
    return { success: false, message: 'Preencha todos os campos.', code: 'INVITE_INVALID' }
  }

  // Normalização server-side: trim, uppercase, remove espaços internos, limite 64
  const inviteCode = inviteCodeRaw.trim().toUpperCase().replace(/\s+/g, '')
  if (!inviteCode || inviteCode.length < 4 || inviteCode.length > 64) {
    return { success: false, message: 'Código de convite inválido.', code: 'INVITE_INVALID' }
  }

  const email = emailRaw.trim().toLowerCase()

  // Helpers para log sem expor dados sensíveis (sem e-mail completo, sem código completo)
  const maskEmail = (e: string) => {
    const at = e.indexOf('@')
    if (at <= 1) return '***'
    return e.slice(0, 2) + '***' + e.slice(at)
  }
  const maskCode = (c: string) => (c.length <= 4 ? '***' : c.slice(0, 4) + '***' + c.slice(-2))

  const correlationId = nextCorrelationId()
  const t0 = Date.now()
  accessLogger.info('vip.signup.started', {
    correlationId,
    emailMasked: maskEmail(email),
    code: maskCode(inviteCode),
    meta: { inviteLength: inviteCode.length },
  })

  try {
    // 1. Validação prévia (sem consumir) — para feedback rápido; decisão final é no UPDATE atômico
    const { data: preCheck, error: preError } = await supabaseAdmin
      .from('invite_codes')
      .select('id, code, is_used, created_at, expires_at, revoked_at, invite_type')
      .eq('code', inviteCode)
      .maybeSingle()

    if (preError) {
      console.error('Erro ao verificar convite:', { code: 'INVITE_PRECHECK_FAILED', maskedCode: maskCode(inviteCode), err: (preError as any).message?.slice(0, 80) })
      return { success: false, message: 'Erro ao verificar convite.', code: 'INVITE_INVALID' }
    }

    if (!preCheck) {
      return { success: false, message: 'Código de convite não encontrado.', code: 'INVITE_NOT_FOUND' }
    }

    if ((preCheck as any).revoked_at) {
      return { success: false, message: 'Convite revogado.', code: 'INVITE_REVOKED' }
    }

    if ((preCheck as any).is_used) {
      return { success: false, message: 'Convite já utilizado.', code: 'INVITE_ALREADY_USED' }
    }

    const expiresAtRaw = (preCheck as any).expires_at as string | null
    if (expiresAtRaw) {
      const exp = new Date(expiresAtRaw)
      if (!isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
        return { success: false, message: 'Convite expirado.', code: 'INVITE_EXPIRED' }
      }
    }

    // 2. Cria o usuário no Auth (antes de consumir para não inutilizar convite em caso de falha de criação)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { invite_code: inviteCode }
    })

    if (authError) {
      return { success: false, message: authError.message, code: 'USER_CREATE_FAILED' }
    }

    if (!userData.user) {
      return { success: false, message: 'Falha ao criar usuário.', code: 'USER_CREATE_FAILED' }
    }

    const newUserId = userData.user.id
    accessLogger.info('vip.signup.auth_created', {
      correlationId,
      userIdMasked: maskUserId(newUserId),
      emailMasked: maskEmail(email),
      durationMs: Date.now() - t0,
    })

    // 3. Consumo atômico do convite — protege contra concorrência (duas requisições simultâneas)
    //    UPDATE ... WHERE is_used=false AND revoked_at IS NULL AND (expires_at IS NULL OR > now())
    //    Equivalente à RPC consume_invite_code, mas com used_by explícito (service_role não tem auth.uid())
    accessLogger.info('vip.invite.consume.started', {
      correlationId,
      inviteIdMasked: maskInviteId((preCheck as any).id),
      userIdMasked: maskUserId(newUserId),
    })
    const nowIso = new Date().toISOString()
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from('invite_codes')
      .update({ is_used: true, used_at: nowIso, used_by: newUserId })
      .eq('id', (preCheck as any).id)
      .eq('is_used', false)
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .select('id')
      .maybeSingle()

    if (!consumeError && consumed) {
      accessLogger.info('vip.invite.consume.succeeded', {
        correlationId,
        inviteIdMasked: maskInviteId((preCheck as any).id),
        userIdMasked: maskUserId(newUserId),
        durationMs: Date.now() - t0,
      })
      accessLogger.info('vip.signup.invite_consumed', {
        correlationId,
        inviteIdMasked: maskInviteId((preCheck as any).id),
        userIdMasked: maskUserId(newUserId),
      })
    }
    // Fallback: se a sintaxe .or não for suportada como acima, tentar segunda checagem com select
    // Mas a tentativa acima já é atômica; se não retornou linha, convite foi tomado concorrentemente ou expirou entre preCheck e agora
    if (consumeError || !consumed) {
      accessLogger.warn('vip.invite.consume.failed', {
        correlationId,
        inviteIdMasked: maskInviteId((preCheck as any).id),
        userIdMasked: maskUserId(newUserId),
        reason: (consumeError as any)?.message?.slice(0, 80) || 'concorrencia/expirado',
        durationMs: Date.now() - t0,
      })
      // Compensação (Estratégia B): remover APENAS o usuário recém-criado (newUserId), nunca preexistente
      // Falha da compensação é incidente explícito e deve ser logada sem dados sensíveis
      accessLogger.info('vip.signup.compensation.started', {
        correlationId,
        userIdMasked: maskUserId(newUserId),
      })
      let compensationFailed = false
      try {
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(newUserId)
        if (delErr) {
          compensationFailed = true
          accessLogger.error('vip.signup.compensation.failed', {
            correlationId,
            userIdMasked: maskUserId(newUserId),
            emailMasked: maskEmail(email),
            reason: delErr.message?.slice(0, 80),
          })
          console.error('Incidente compensacao deleteUser falhou:', { maskedEmail: maskEmail(email), newUserId: newUserId.slice(0, 8) + '***', err: delErr.message?.slice(0, 80) })
        } else {
          accessLogger.info('vip.signup.compensation.succeeded', { correlationId, userIdMasked: maskUserId(newUserId) })
        }
      } catch (e: any) {
        compensationFailed = true
        accessLogger.error('vip.signup.compensation.failed', {
          correlationId,
          userIdMasked: maskUserId(newUserId),
          reason: String(e).slice(0, 80),
        })
        console.error('Incidente compensacao deleteUser excecao:', { maskedEmail: maskEmail(email), newUserId: newUserId.slice(0, 8) + '***', err: String(e).slice(0, 80) })
      }
      if (compensationFailed) {
        // Não ocultar inconsistência: loga incidente e retorna erro; user órfão exigirá cleanup manual
        accessLogger.error('vip.signup.compensation.failed', {
          correlationId,
          inviteIdMasked: maskInviteId((preCheck as any).id),
          reason: 'compensacao falhou - inconsistencia',
        })
        console.error('Inconsistencia signup: usuario criado mas convite nao consumido e compensacao falhou', { maskedCode: maskCode(inviteCode) })
      }

      // Re-verificar motivo específico para mensagem distinta
      const { data: recheck } = await supabaseAdmin
        .from('invite_codes')
        .select('is_used, revoked_at, expires_at')
        .eq('id', (preCheck as any).id)
        .maybeSingle()

      if (recheck) {
        if ((recheck as any).revoked_at) {
          return { success: false, message: 'Convite revogado.', code: 'INVITE_REVOKED' }
        }
        if ((recheck as any).is_used) {
          return { success: false, message: 'Convite já utilizado (concorrência).', code: 'INVITE_ALREADY_USED' }
        }
        const reExp = (recheck as any).expires_at as string | null
        if (reExp && !isNaN(new Date(reExp).getTime()) && new Date(reExp).getTime() <= Date.now()) {
          return { success: false, message: 'Convite expirado.', code: 'INVITE_EXPIRED' }
        }
      }

      return { success: false, message: 'Convite já utilizado ou expirado (tentativa concorrente).', code: 'INVITE_ALREADY_USED' }
    }

    // 4. Cria o estado inicial do usuário (Evita tela de carregamento eterno no dashboard)
    const { error: stateError } = await supabaseAdmin.from('user_state').insert({
      user_id: newUserId,
      track: 'Interlagos', // Pista padrão
      // Outros campos assumirão o default do banco
    })

    if (stateError) {
      // Falha em user_state: convite já consumido é correto (não reverter is_used), mas usuário ficaria sem perfil
      // Tentar recuperação idempotente; falha aqui não apaga usuário (evita perder convite)
      console.error('Falha ao criar user_state após consumo:', { maskedEmail: maskEmail(email), newUserId: newUserId.slice(0, 8) + '***', err: (stateError as any).message?.slice(0, 80) })
      // Tentar novamente com upsert para casos de race em user_state
      const { error: retryError } = await supabaseAdmin.from('user_state').upsert(
        { user_id: newUserId, track: 'Interlagos' },
        { onConflict: 'user_id' }
      )
      if (retryError) {
        console.error('Retry user_state falhou:', { maskedEmail: maskEmail(email), err: (retryError as any).message?.slice(0, 80) })
        return { success: false, message: 'Conta criada, mas falha ao inicializar perfil. Tente fazer login.', code: 'USER_STATE_FAILED' }
      }
    }

    // 5. ALFA-011.8: concessão VIP por convite (idempotente, sem VIP_CHECK)
    //    Fonte primária: access_grants; user_state é apenas resumo
    //    Regra: vip_lifetime→expires_at null (vitalício), vip_custom→expires_at do convite, vip_30_days ou antigo null→30d
    //    Não aceita validade do cliente — usa invite_type/expires_at do DB (preCheck)
    //    Não cria para convite não-VIP? preCheck já garantiu invite existente e consumido; invite_type null (antigo) é tratado como 30d por compatibilidade (documentado)
    try {
      // Lazy import para evitar ciclo e manter server-only
      const { ensureVipGrantForInvite, recordAccessEvent, syncUserStateWithGrant } = await import('@/app/lib/access/accessService')
      const inviteForGrant = {
        id: (preCheck as any).id as string,
        invite_type: (preCheck as any).invite_type as string | null,
        expires_at: (preCheck as any).expires_at as string | null,
      }

      // Só concede se invite_type é VIP (ou null legado); se fosse comum não-VIP, skip — aqui todos vip_* ou null legado concedem
      // Regra explícita: convite antigo com invite_type null → 30d (compatibilidade, não presumir não-VIP sem regra)
      const { grant, isNew } = await ensureVipGrantForInvite(newUserId, inviteForGrant)
      accessLogger.info(isNew ? 'vip.grant.created' : 'vip.grant.reprocessed', {
        correlationId,
        userIdMasked: maskUserId(newUserId),
        grantIdMasked: grant.id.slice(0, 8) + '***',
        inviteIdMasked: maskInviteId(inviteForGrant.id),
        result: isNew ? 'created' : 'already_exists',
        meta: { invite_type: inviteForGrant.invite_type, isNew },
      })
      if (!isNew) {
        accessLogger.info('vip.signup.grant_failed', {
          correlationId,
          userIdMasked: maskUserId(newUserId),
          reason: 'grant already exists (idempotente)',
        })
      }

      if (isNew) {
        await recordAccessEvent({
          userId: newUserId,
          accessGrantId: grant.id,
          eventType: 'granted',
          source: 'invite',
          actorUserId: null,
          metadata: { invite_code_id: inviteForGrant.id, invite_type: inviteForGrant.invite_type },
        })
        accessLogger.info('vip.grant.created', {
          correlationId,
          grantIdMasked: grant.id.slice(0, 8) + '***',
          userIdMasked: maskUserId(newUserId),
          result: 'event granted',
        })
      }

      accessLogger.info('vip.grant.sync.started', {
        correlationId,
        grantIdMasked: grant.id.slice(0, 8) + '***',
        userIdMasked: maskUserId(newUserId),
      })
      try {
        await syncUserStateWithGrant(newUserId, grant)
        accessLogger.info('vip.grant.sync.succeeded', {
          correlationId,
          grantIdMasked: grant.id.slice(0, 8) + '***',
          userIdMasked: maskUserId(newUserId),
        })
      } catch (syncErr: any) {
        accessLogger.error('vip.grant.sync.failed', {
          correlationId,
          grantIdMasked: grant.id.slice(0, 8) + '***',
          userIdMasked: maskUserId(newUserId),
          reason: String(syncErr?.message || syncErr).slice(0, 80),
        })
        console.error('Falha ao sincronizar user_state com grant:', { userId: newUserId.slice(0, 8) + '***', grantId: grant.id.slice(0, 8) + '***', err: String(syncErr?.message || syncErr).slice(0, 80) })
        // Não oculta falha — loga, mas não falha cadastro (usuário criado, convite consumido, grant criado; sync pode ser refeito)
      }
      accessLogger.info('vip.signup.grant_created', {
        correlationId,
        grantIdMasked: grant.id.slice(0, 8) + '***',
        userIdMasked: maskUserId(newUserId),
        result: isNew ? 'created' : 'reused',
      })
    } catch (grantErr: any) {
      accessLogger.error('vip.signup.grant_failed', {
        correlationId,
        userIdMasked: maskUserId(newUserId),
        inviteIdMasked: maskInviteId((preCheck as any).id),
        reason: String(grantErr?.message || grantErr).slice(0, 80),
      })
      // Falha na concessão: não ocultar, registrar server-side sem dados sensíveis, usuário permanece criado sem VIP
      console.error('Falha ao criar concessão VIP:', { userId: newUserId.slice(0, 8) + '***', inviteId: (preCheck as any).id.slice(0, 8) + '***', err: String(grantErr?.message || grantErr).slice(0, 80) })
      // Não marcar como concedida, não excluir usuário (já confirmado), não simular transação
      // Grant pode ser criado manualmente via retry/admin; evento não duplica
    }

    return { success: true, message: 'Conta criada com sucesso!' }

  } catch (error: any) {
    console.error('Erro no cadastro:', { maskedCode: inviteCode ? maskCode(inviteCode) : '***', err: String(error?.message || error).slice(0, 80) })
    return { success: false, message: 'Erro interno no servidor.', code: 'INVITE_INVALID' }
  }
}