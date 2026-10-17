// app/lib/gpro-sync-claim.ts
// ============================================
// ALFA-010 - CLAIM DE SINCRONIZAÇÃO DE PATROCINADORES
// ============================================
// Exclusão mútua PERSISTENTE (Supabase) para o refresh de AvailSponsors.
// Garante no máximo um refresh por (user_id, season, race) mesmo sob
// requisições concorrentes em várias instâncias serverless.
//
// Princípios:
//  - fail-open APENAS para erros de infraestrutura (tabela ausente, banco
//    indisponível, permissão): nunca bloquear o sync por causa do lock;
//  - takeover atômico por TTL (comparação do claim_token lido);
//  - release restrito ao PRÓPRIO token (não apaga claim assumido por outro
//    processo após o TTL).
// ============================================

import { supabaseAdmin } from './supabase-admin';
import { isAvailSponsorsClaimExpired } from './gpro-sponsors';

const TABLE = 'gpro_sponsor_sync_state';

export type AvailSponsorsClaimStatus = 'acquired' | 'busy';

export interface AvailSponsorsClaim {
  status: AvailSponsorsClaimStatus;
  /** Presente somente quando o claim foi efetivamente adquirido. */
  token: string | null;
}

function randomToken(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback apenas como identificador de claim (não é segredo).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Tenta adquirir o claim de refresh de AvailSponsors.
 *
 * - `acquired` (+ token): este processo deve executar o refresh e, ao final,
 *   chamar `releaseAvailSponsorsClaim` com o mesmo token;
 * - `busy`: outro processo já está sincronizando a mesma corrida; NÃO chamar
 *   a API GPRO;
 * - `acquired` com `token: null`: chave indisponível ou erro de infraestrutura
 *   (fail-open) — executar o refresh sem deduplicação.
 */
export async function acquireAvailSponsorsClaim(
  userId: string,
  season: number,
  race: number
): Promise<AvailSponsorsClaim> {
  if (!(season > 0) || !(race > 0)) {
    return { status: 'acquired', token: null };
  }

  const token = randomToken();

  const { error: insertError } = await supabaseAdmin
    .from(TABLE)
    .insert({
      user_id: userId,
      season,
      race,
      claim_token: token,
      claimed_at: new Date().toISOString(),
    });

  if (!insertError) {
    return { status: 'acquired', token };
  }

  // Código 23505 = violação de unicidade (alguém já detém o claim).
  if (insertError.code !== '23505') {
    console.warn(
      `⚠️ Claim AvailSponsors indisponível (fail-open, sem dedup): ${insertError.code ?? '?'} ${insertError.message}`
    );
    return { status: 'acquired', token: null };
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from(TABLE)
    .select('claim_token, claimed_at')
    .eq('user_id', userId)
    .eq('season', season)
    .eq('race', race)
    .maybeSingle();

  if (readError || !existing) {
    if (readError) console.warn(`⚠️ Falha ao ler claim AvailSponsors: ${readError.message}`);
    return { status: 'busy', token: null };
  }

  if (!isAvailSponsorsClaimExpired(existing.claimed_at, Date.now())) {
    return { status: 'busy', token: null };
  }

  // Takeover atômico: assume apenas se o token lido ainda for o atual.
  const takeoverToken = randomToken();
  const { data: taken, error: takeError } = await supabaseAdmin
    .from(TABLE)
    .update({ claim_token: takeoverToken, claimed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('season', season)
    .eq('race', race)
    .eq('claim_token', existing.claim_token)
    .select('claim_token');

  if (!takeError && Array.isArray(taken) && taken.length === 1) {
    return { status: 'acquired', token: takeoverToken };
  }

  if (takeError) console.warn(`⚠️ Falha no takeover do claim AvailSponsors: ${takeError.message}`);
  return { status: 'busy', token: null };
}

/**
 * Libera o claim. Best-effort e restrito ao token informado: nunca apaga um
 * claim que já tenha sido assumido por outro processo (token diferente).
 */
export async function releaseAvailSponsorsClaim(
  userId: string,
  season: number,
  race: number,
  token: string | null
): Promise<void> {
  if (!token) return;
  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('season', season)
      .eq('race', race)
      .eq('claim_token', token);
    if (error) console.warn(`⚠️ Falha ao liberar claim AvailSponsors: ${error.message}`);
  } catch (e) {
    console.warn('⚠️ Falha ao liberar claim AvailSponsors:', e instanceof Error ? e.message : e);
  }
}
