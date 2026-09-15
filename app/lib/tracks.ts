// app/lib/tracks.ts
// Fonte única para constantes GPRO — centralização ALFA-002
// Não alterar valores de negócio sem justificar no relatório

// ============================================================
// TRACK_FLAGS — 63 pistas canônicas (mesmo mapa usado em 5 páginas gerente)
// Chaves em PascalCase exatamente como retornadas pela GPRO/Excel
// ============================================================
export const TRACK_FLAGS: Record<string, string> = {
  "A1-Ring": "at",
  "Adelaide": "au",
  "Ahvenisto": "fi",
  "Anderstorp": "se",
  "Austin": "us",
  "Avus": "de",
  "Baku City": "az",
  "Barcelona": "es",
  "Brands Hatch": "gb",
  "Brasilia": "br",
  "Bremgarten": "ch",
  "Brno": "cz",
  "Bucharest Ring": "ro",
  "Buenos Aires": "ar",
  "Catalunya": "es",
  "Dijon-Prenois": "fr",
  "Donington": "gb",
  "Estoril": "pt",
  "Fiorano": "it",
  "Fuji": "jp",
  "Grobnik": "hr",
  "Hockenheim": "de",
  "Hungaroring": "hu",
  "Imola": "sm",
  "Indianapolis oval": "us",
  "Indianapolis": "us",
  "Interlagos": "br",
  "Istanbul": "tr",
  "Irungattukottai": "in",
  "Jarama": "es",
  "Jeddah": "sa",
  "Jerez": "es",
  "Kyalami": "za",
  "Jyllands-Ringen": "dk",
  "Kaunas": "lt",
  "Laguna Seca": "us",
  "Las Vegas": "us",
  "Le Mans": "fr",
  "Long Beach": "us",
  "Losail": "qa",
  "Magny Cours": "fr",
  "Melbourne": "au",
  "Mexico City": "mx",
  "Miami": "us",
  "Misano": "it",
  "Monte Carlo": "mc",
  "Montreal": "ca",
  "Monza": "it",
  "Mugello": "it",
  "Nurburgring": "de",
  "Oschersleben": "de",
  "New Delhi": "in",
  "Oesterreichring": "at",
  "Paul Ricard": "fr",
  "Portimao": "pt",
  "Poznan": "pl",
  "Red Bull Ring": "at",
  "Rio de Janeiro": "br",
  "Rafaela Oval": "ar",
  "Sakhir": "bh",
  "Sepang": "my",
  "Shanghai": "cn",
  "Silverstone": "gb",
  "Singapore": "sg",
  "Sochi": "ru",
  "Spa": "be",
  "Suzuka": "jp",
  "Serres": "gr",
  "Slovakiaring": "sk",
  "Valencia": "es",
  "Vallelunga": "it",
  "Yas Marina": "ae",
  "Yeongam": "kr",
  "Zandvoort": "nl",
  "Zolder": "be",
};

// Aliases em lowercase para casos como calendar (ex: "a1 ring", "magny-cours", "monaco" -> "monte carlo")
const TRACK_FLAG_ALIASES: Record<string, string> = {
  "a1 ring": "at",
  "a1ring": "at",
  "baku": "az",
  "magny-cours": "fr",
  "monaco": "mc",
  "oesterreichring": "at",
  "osterreichring": "at",
};

/**
 * Retorna código de bandeira para uma pista (case-insensitive, com aliases).
 * Uso: `getTrackFlag("Interlagos")` -> "br"
 */
export function getTrackFlag(trackName: string | null | undefined): string | null {
  if (!trackName) return null;
  const direct = TRACK_FLAGS[trackName];
  if (direct) return direct;
  const lower = trackName.trim().toLowerCase();
  if (TRACK_FLAGS[trackName.trim()]) return TRACK_FLAGS[trackName.trim()]!;
  // Tenta lowercase exato
  for (const [key, code] of Object.entries(TRACK_FLAGS)) {
    if (key.toLowerCase() === lower) return code;
  }
  // Aliases
  if (TRACK_FLAG_ALIASES[lower]) return TRACK_FLAG_ALIASES[lower];
  return null;
}

// ============================================================
// TYRE SUPPLIERS — canônico para conta gerente (7 fornecedores)
// Fonte: GameContext.ts + app/lib/db.ts (DEFAULT_TYRE_SUPPLIERS)
// Este é o source of truth para Visão Geral, Setup, GameContext
// ============================================================
export const TYRE_SUPPLIERS: string[] = [
  "Pipirelli",
  "Hantook",
  "Dunlop",
  "Michelin",
  "Pirelli",
  "Goodyear",
  "Bridgestone",
];

// Alias para compatibilidade com código que importava DEFAULT_TYRE_SUPPLIERS
export const DEFAULT_TYRE_SUPPLIERS = TYRE_SUPPLIERS;

// ============================================================
// TYRE SUPPLIERS LEGADO — usado em Strategy/Tests (9 fornecedores + GIFs)
// Preservado para não alterar comportamento de cálculo/UX dessas páginas
// TODO ALFA-003: unificar com TYRE_SUPPLIERS após validação com planilha Excel Tyres
// ============================================================
export const TYRE_SUPPLIERS_LEGACY: string[] = [
  "Pipirelli",
  "Avonn",
  "Yokomama",
  "Dunnolop",
  "Contimental",
  "Hancock",
  "Badyear",
  "Michelini",
  "Bridgerock",
];

export const TYRE_SUPPLIER_IMAGES: Record<string, string> = {
  "Pipirelli": "pipirelli.gif",
  "Avonn": "avonn.gif",
  "Yokomama": "yokomama.gif",
  "Dunnolop": "dunnolop.gif",
  "Contimental": "contimental.gif",
  "Hancock": "hancock.gif",
  "Badyear": "badyear.gif",
  "Michelini": "michelini.gif",
  "Bridgerock": "bridgerock.gif",
};

// Helper para obter lista por contexto
export function getTyreSuppliers(context: 'gerente' | 'strategy' | 'tests' = 'gerente'): string[] {
  if (context === 'gerente') return TYRE_SUPPLIERS;
  return TYRE_SUPPLIERS_LEGACY;
}
