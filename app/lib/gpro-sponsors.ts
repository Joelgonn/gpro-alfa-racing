// app/lib/gpro-sponsors.ts
// ============================================
// CATÁLOGO DE PATROCINADORES — LÓGICA PURA
// ============================================
// Regras de decisão para sincronização do catálogo
// `gpro_sponsors`, extraídas da rota de sync para
// permitir teste isolado e reduzir consumo de API.
//
// Sem chamadas externas e sem persistência:
// apenas funções puras de seleção e montagem de linha.
// ============================================

/**
 * Limite de enriquecimentos (NegotiateSponsor) por sincronização.
 *
 * O enriquecimento individual só ocorre para patrocinadores que
 * ainda NÃO possuem categoria e país persistidos. Em regime
 * estável o custo tende a zero; o limite existe apenas para
 * absorver a entrada de novos patrocinadores em uma única sync.
 */
export const MAX_SPONSOR_ENRICHMENTS_PER_SYNC = 20;

/**
 * Tempo de vida (TTL) de um claim de sincronização de AvailSponsors.
 *
 * Se um processo detentor do claim for interrompido (ex.: timeout de
 * função serverless) sem liberá-lo, outro processo pode assumir o claim
 * após este intervalo. 5 minutos é folgado para um sync completo.
 */
export const AVAIL_SPONSORS_CLAIM_TTL_MS = 5 * 60 * 1000;

/**
 * Indica se um claim (identificado por `claimed_at`) pode ser assumido
 * por outro processo por estar expirado.
 *
 * Retorna true (assumível) quando a data é ausente ou inválida.
 */
export function isAvailSponsorsClaimExpired(
  claimedAtIso: string | null | undefined,
  nowMs: number,
  ttlMs: number = AVAIL_SPONSORS_CLAIM_TTL_MS
): boolean {
  if (!claimedAtIso) return true;
  const claimedAtMs = new Date(claimedAtIso).getTime();
  if (!Number.isFinite(claimedAtMs)) return true;
  return nowMs - claimedAtMs > ttlMs;
}

/**
 * Patrocinador retornado pelo endpoint AvailSponsors.
 * O payload da GPRO é livre; os campos conhecidos são declarados
 * e os demais ficam preservados via index signature.
 */
export interface GproSponsor {
  sponsorId: number | string;
  name?: string | null;
  natCode?: string | null;
  finances?: number | null;
  expectations?: number | null;
  patience?: number | null;
  reputation?: number | null;
  image?: number | null;
  negotiation?: number | null;
  [key: string]: unknown;
}

/** Detalhe retornado pelo endpoint NegotiateSponsor. */
export interface GproSponsorDetail {
  name?: string | null;
  country?: string | null;
  category?: string | null;
  finances?: number | null;
  expectations?: number | null;
  patience?: number | null;
  reputation?: number | null;
  image?: number | null;
  negotiation?: number | null;
  [key: string]: unknown;
}

export interface ExistingSponsor {
  sponsor_id: number;
  name?: string | null;
  country?: string | null;
  category?: string | null;
  finances?: number | null;
  expectations?: number | null;
  patience?: number | null;
  reputation?: number | null;
  image?: number | null;
  negotiation?: number | null;
}

export interface SponsorRow {
  sponsor_id: number;
  name: string;
  country: string | null;
  category: string | null;
  finances: number;
  expectations: number;
  patience: number;
  reputation: number;
  image: number;
  negotiation: number;
  raw_data: GproSponsor;
  last_sync_at: string;
}

export function hasText(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/** Indexa as linhas existentes por sponsor_id. */
export function indexExistingSponsors(
  rows: ExistingSponsor[] | null | undefined
): Map<number, ExistingSponsor> {
  const map = new Map<number, ExistingSponsor>();
  for (const row of rows ?? []) {
    const id = Number(row?.sponsor_id);
    if (Number.isFinite(id)) {
      map.set(id, row);
    }
  }
  return map;
}

/**
 * Um patrocinador precisa de enriquecimento quando ainda não existe
 * no catálogo OU quando falta categoria/país.
 *
 * Já enriquecido (possui categoria E país) nunca é selecionado,
 * evitando chamadas NegotiateSponsor desnecessárias.
 */
export function needsSponsorEnrichment(
  sponsor: GproSponsor,
  existing?: ExistingSponsor | null
): boolean {
  const id = Number(sponsor?.sponsorId);
  if (!Number.isFinite(id)) return false;
  if (!existing) return true;
  return !hasText(existing.category) || !hasText(existing.country);
}

/**
 * Seleciona, preservando a ordem de entrada, apenas os patrocinadores
 * que precisam de enriquecimento, respeitando o limite por sync.
 */
export function selectSponsorsForEnrichment(
  sponsors: GproSponsor[],
  existingById: Map<number, ExistingSponsor>,
  max: number = MAX_SPONSOR_ENRICHMENTS_PER_SYNC
): GproSponsor[] {
  const selected: GproSponsor[] = [];
  const seen = new Set<number>();

  for (const sponsor of sponsors) {
    const id = Number(sponsor?.sponsorId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);

    if (needsSponsorEnrichment(sponsor, existingById.get(id))) {
      selected.push(sponsor);
      if (selected.length >= max) break;
    }
  }

  return selected;
}

export interface AvailSponsorsRefreshInput {
  /** Temporada da última sincronização (null quando não há snapshot). */
  lastSeason: number | null | undefined;
  /** Corrida da última sincronização (null quando não há snapshot). */
  lastRace: number | null | undefined;
  /** Temporada atual, extraída do Office. */
  season: number;
  /** Corrida atual, extraída do Office. */
  race: number;
  /** Atualização forçada explicitamente (sync manual completo). */
  force?: boolean;
}

/**
 * Decide se o endpoint AvailSponsors precisa ser consultado nesta sincronização.
 *
 * Consulta (true) somente quando:
 *  - a atualização foi forçada explicitamente; OU
 *  - não há snapshot anterior; OU
 *  - a temporada/corrida atual difere da registrada no snapshot.
 *
 * Fora disso retorna false: o catálogo é reutilizado do snapshot,
 * garantindo no máximo 1 chamada AvailSponsors por corrida.
 */
export function shouldRefreshAvailSponsors(input: AvailSponsorsRefreshInput): boolean {
  if (input.force === true) return true;

  const season = Number(input.season);
  const race = Number(input.race);
  if (!Number.isFinite(season) || !Number.isFinite(race) || season <= 0 || race <= 0) {
    return true;
  }

  const lastSeason = input.lastSeason === null || input.lastSeason === undefined ? null : Number(input.lastSeason);
  const lastRace = input.lastRace === null || input.lastRace === undefined ? null : Number(input.lastRace);
  if (lastSeason === null || lastRace === null || !Number.isFinite(lastSeason) || !Number.isFinite(lastRace)) {
    return true;
  }

  return lastSeason !== season || lastRace !== race;
}

function numOr(...values: unknown[]): number {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function strOr(...values: unknown[]): string | null {
  for (const value of values) {
    if (hasText(value)) return String(value);
  }
  return null;
}

/**
 * Monta a linha de upsert de um patrocinador.
 *
 * Precedência: dados novos (lista AvailSponsors / detalhe NegotiateSponsor)
 * e, quando ausentes, preserva o que já existia (`existing`).
 * Nunca substitui um valor válido por vazio/null.
 */
export function buildSponsorRow(
  sponsor: GproSponsor,
  detail?: GproSponsorDetail,
  existing?: ExistingSponsor | null
): SponsorRow {
  return {
    sponsor_id: Number(sponsor.sponsorId),
    name: strOr(sponsor.name, detail?.name, existing?.name) ?? '',
    country: strOr(detail?.country, sponsor.natCode, existing?.country),
    category: strOr(detail?.category, existing?.category),
    finances: numOr(sponsor.finances, detail?.finances, existing?.finances),
    expectations: numOr(sponsor.expectations, detail?.expectations, existing?.expectations),
    patience: numOr(sponsor.patience, detail?.patience, existing?.patience),
    reputation: numOr(sponsor.reputation, detail?.reputation, existing?.reputation),
    image: numOr(sponsor.image, detail?.image, existing?.image),
    negotiation: numOr(sponsor.negotiation, detail?.negotiation, existing?.negotiation),
    raw_data: sponsor,
    last_sync_at: new Date().toISOString(),
  };
}
