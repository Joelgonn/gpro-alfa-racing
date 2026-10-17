// app/lib/gpro-gateway.ts
// ============================================
// GPRO API GATEWAY (API pública v2)
// ============================================
// Helper único de leitura da API v2 da GPRO.
// Reutilizado por rotas server-side (sync, testing).
//
// Não contém regra de negócio, mapeamento de domínio
// nem persistência. Apenas transporte HTTP + normalização
// de erro.
// ============================================

export const GPRO_LANG = 'br';
export const GPRO_API_BASE = 'https://gpro.net';

export type GproJson = Record<string, any>;

export async function fetchGproJson(path: string, token: string): Promise<GproJson> {
  const response = await fetch(`${GPRO_API_BASE}/${GPRO_LANG}/backend/api/v2/${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload?.errorMsg || payload?.message || payload?.error || `GPRO ${path} retornou ${response.status}`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`Resposta inválida do endpoint GPRO ${path}`);
  }

  return payload;
}
