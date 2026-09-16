// app/lib/gpro-token.ts
// SERVER ONLY — proteção do gpro_token em repouso
import 'server-only';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

const PREFIX = 'enc:';
const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.GPRO_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!raw) throw new Error('Chave de criptografia não configurada (GPRO_TOKEN_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY)');
  // Deriva 32 bytes via SHA256 se não for 32 bytes exatos
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptToken(token: string): string {
  if (!token) return token;
  if (token.startsWith(PREFIX)) return token; // já criptografado
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv:tag:enc em hex
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptToken(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) {
    // Token legado em plaintext — retorna como está (migração gradual)
    return stored;
  }
  try {
    const key = getKey();
    const withoutPrefix = stored.slice(PREFIX.length);
    const [ivHex, tagHex, encHex] = withoutPrefix.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    console.error('Falha ao descriptografar gpro_token', e);
    return null;
  }
}

/**
 * Leitura server-only do gpro_token (descriptografado)
 * Nunca chamar no cliente
 */
export async function getGproToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('user_state')
    .select('gpro_token')
    .eq('user_id', userId)
    .single();
  if (error || !data?.gpro_token) return null;
  return decryptToken(data.gpro_token);
}

/**
 * Gravação server-only com criptografia
 */
export async function setGproToken(userId: string, token: string | null): Promise<void> {
  const value = token ? encryptToken(token) : null;
  const { error } = await supabaseAdmin
    .from('user_state')
    .update({ gpro_token: value })
    .eq('user_id', userId);
  if (error) throw new Error(`Falha ao salvar gpro_token: ${error.message}`);
}

/**
 * Verifica se usuário tem token configurado (sem expor valor)
 */
export async function hasGproToken(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('user_state')
    .select('gpro_token')
    .eq('user_id', userId)
    .single();
  return !!data?.gpro_token;
}
