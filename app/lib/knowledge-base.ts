// app/lib/knowledge-base.ts
// ============================================
// BIBLIOTECA PURA DE DOMÍNIO - SEM PERSISTÊNCIA
// ============================================

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface AnalysisInfo {
  endpoint: string;
  totalCampos: number;
  objetos: number;
  arrays: number;
  campos: string[];
  tipos: Record<string, string>;
  hash: string;
  parametros?: string[];
  status?: "✔ Validado" | "⚠️ Em análise" | "❌ Inativo" | "🔍 Pendente";
  maturidade?: "descoberto" | "parcial" | "completo" | "instavel" | "descontinuado";
  confianca?: number;
  ultimoScan?: string;
  historico?: { data: string; campos: number; hash?: string }[];
  observacoes?: string;
  utilidade?: 1 | 2 | 3 | 4 | 5;
  exemplo?: string;
  exemploHash?: string;
  scansRealizados?: number;
  ultimoHash?: string;
  hashHistory?: string[];
}

export interface EndpointInfo {
  campos: string[];
  parametros: string[];
  totalCampos: number;
  ultimoScan: string;
  tipos?: Record<string, string>;
  historico?: {
    data: string;
    campos: number;
    hash?: string;
  }[];
  status?: "✔ Validado" | "⚠️ Em análise" | "❌ Inativo" | "🔍 Pendente";
  maturidade?: "descoberto" | "parcial" | "completo" | "instavel" | "descontinuado";
  observacoes?: string;
  utilidade?: 1 | 2 | 3 | 4 | 5;
  exemplo?: string;
  exemploHash?: string;
  confianca?: number;
  scansRealizados?: number;
  ultimoHash?: string;
  hashHistory?: string[];
}

export interface CatalogoType {
  [key: string]: EndpointInfo;
}

export type CategoriaEndpoint = 
  | "⭐ Favorito" 
  | "🏎️ Estratégia" 
  | "👨‍✈️ Piloto" 
  | "🚗 Carro" 
  | "📊 Corrida" 
  | "🔬 Pesquisa" 
  | "📋 Geral";

export interface CategoriasType {
  [key: string]: CategoriaEndpoint;
}

// ============================================
// INTERFACE PARA LINHA DO BANCO DE DADOS
// ============================================

export interface KnowledgeBaseRow {
  id: string;
  user_id: string;
  endpoint: string;
  campos: string[];
  tipos: Record<string, string>;
  parametros: string[];
  total_campos: number;
  status: string;
  maturidade: string;
  confianca: number;
  ultimo_hash: string | null;
  historico: { data: string; campos: number; hash?: string }[];
  hash_history: string[];
  observacoes: string | null;
  utilidade: number;
  scans_realizados: number;
  ultimo_scan: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// CONSTANTES EXPORTADAS
// ============================================

export const CATEGORIAS_VALIDAS: CategoriaEndpoint[] = [
  "⭐ Favorito",
  "🏎️ Estratégia",
  "👨‍✈️ Piloto",
  "🚗 Carro",
  "📊 Corrida",
  "🔬 Pesquisa",
  "📋 Geral"
];

export const STATUS_VALIDOS = ["✔ Validado", "⚠️ Em análise", "❌ Inativo", "🔍 Pendente"] as const;

export const MATURIDADE_VALIDA = ["descoberto", "parcial", "completo", "instavel", "descontinuado"] as const;

export const UTILIDADE_VALIDA = [1, 2, 3, 4, 5] as const;

// ============================================
// REGRAS DE AUTO-CATEGORIZAÇÃO
// ============================================

export const CATEGORY_RULES: { pattern: RegExp; categoria: CategoriaEndpoint }[] = [
  { pattern: /driver|piloto|manager|profile/i, categoria: "👨‍✈️ Piloto" },
  { pattern: /car|veiculo|setup|tyre|tire|wheel|engine/i, categoria: "🚗 Carro" },
  { pattern: /race|corrida|qualify|practice|qualification|grid|lap/i, categoria: "📊 Corrida" },
  { pattern: /strategy|estrategia|pit|fuel|risk/i, categoria: "🏎️ Estratégia" },
  { pattern: /research|pesquisa|tech|technology|development/i, categoria: "🔬 Pesquisa" },
  { pattern: /favorito|favorite|star/i, categoria: "⭐ Favorito" },
];

// ============================================
// FUNÇÕES DE DOMÍNIO
// ============================================

export function autoCategorizar(endpointName: string): CategoriaEndpoint | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(endpointName)) {
      return rule.categoria;
    }
  }
  return null;
}

export function detectarParametro(mensagem: string): string | null {
  const patterns = [
    /missing\s+(\w+)/i,
    /required\s+(\w+)/i,
    /parameter\s+(\w+)/i,
    /param\s+(\w+)/i,
    /(\w+)\s+required/i,
    /(\w+)\s+missing/i,
    /(\w+)\s+not\s+found/i,
    /invalid\s+(\w+)/i
  ];

  for (const pattern of patterns) {
    const match = mensagem.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function calcularHashSchema(tipos: Record<string, string>): string {
  const sortedKeys = Object.keys(tipos).sort();
  const schemaString = sortedKeys.map(key => `${key}:${tipos[key]}`).join("|");
  let hash = 0;
  for (let i = 0; i < schemaString.length; i++) {
    const char = schemaString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function analisarEstrutura(
  data: any,
  camposSet: Set<string>,
  tipos: Record<string, string>,
  prefixo: string = ""
) {
  if (!data || typeof data !== "object") return;

  if (Array.isArray(data)) {
    const sample = data.find(item => item && typeof item === "object");
    if (sample) {
      analisarEstrutura(sample, camposSet, tipos, prefixo);
    }
    return;
  }

  Object.keys(data).forEach(key => {
    const valor = data[key];
    const nomeCompleto = prefixo ? `${prefixo}.${key}` : key;

    if (!camposSet.has(nomeCompleto)) {
      camposSet.add(nomeCompleto);
    }

    if (valor !== null && typeof valor === "object") {
      if (Array.isArray(valor)) {
        tipos[nomeCompleto] = `Array[${valor.length}]`;
        const sample = valor.find(item => item && typeof item === "object");
        if (sample) {
          analisarEstrutura(sample, camposSet, tipos, nomeCompleto);
        }
      } else {
        tipos[nomeCompleto] = "Objeto";
        analisarEstrutura(valor, camposSet, tipos, nomeCompleto);
      }
    } else {
      tipos[nomeCompleto] = typeof valor;
    }
  });
}

export function criarHistorico(
  historicoExistente: { data: string; campos: number; hash?: string }[] = [],
  novosCampos: number,
  hash?: string
): { data: string; campos: number; hash?: string }[] {
  const maxHistorico = 50;
  const novoHistorico = [
    ...historicoExistente,
    {
      data: new Date().toISOString(),
      campos: novosCampos,
      ...(hash ? { hash } : {})
    }
  ];
  return novoHistorico.slice(-maxHistorico);
}

export function calcularConfianca(
  historico: { data: string; campos: number; hash?: string }[] = [],
  status?: string,
  maturidade?: string
): number {
  if (!historico || historico.length === 0) return 10;
  if (status === "✔ Validado") return 90;
  if (maturidade === "completo") return 85;

  const totalScans = historico.length;
  if (totalScans < 3) return 30 + (totalScans * 10);

  const hashes = historico.map(h => h.hash).filter(Boolean);
  if (hashes.length >= 2) {
    const hashSet = new Set(hashes);
    if (hashSet.size === 1) return Math.min(70 + (totalScans - 3) * 2, 85);
    if (hashSet.size <= 2) return Math.min(50 + (totalScans - 3) * 2, 65);
    return Math.min(30 + (totalScans - 3) * 2, 45);
  }

  const ultimosCampos = historico.map(h => h.campos);
  const ultimo = ultimosCampos[ultimosCampos.length - 1];
  const penultimo = ultimosCampos[ultimosCampos.length - 2];
  if (Math.abs(ultimo - penultimo) <= 5) {
    return Math.min(60 + (totalScans - 3) * 2, 75);
  }

  return 50;
}

export function calcularMaturidade(
  historico: { data: string; campos: number; hash?: string }[] = [],
  status?: string,
  parametros: string[] = []
): "descoberto" | "parcial" | "completo" | "instavel" | "descontinuado" {
  if (status === "❌ Inativo") return "descontinuado";
  if (status === "✔ Validado") return "completo";
  if (!historico || historico.length === 0) return "descoberto";
  if (historico.length < 2) return "descoberto";

  const hashes = historico.map(h => h.hash).filter(Boolean);
  if (hashes.length >= 3) {
    const hashSet = new Set(hashes);
    if (hashSet.size === 1) return "completo";
    if (hashSet.size <= 2) return "parcial";
    return "instavel";
  }

  const ultimosCampos = historico.map(h => h.campos);
  if (ultimosCampos.length >= 3) {
    const ultimo = ultimosCampos[ultimosCampos.length - 1];
    const penultimo = ultimosCampos[ultimosCampos.length - 2];
    const antepenultimo = ultimosCampos[ultimosCampos.length - 3];
    if (ultimo === penultimo && penultimo === antepenultimo) return "completo";
    if (Math.abs(ultimo - penultimo) <= 3 && Math.abs(penultimo - antepenultimo) <= 3) return "parcial";
    return "instavel";
  }

  return "descoberto";
}

export function compactarExemplo(data: any, maxSize: number = 5000): string {
  try {
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length <= maxSize) {
      return jsonStr;
    }
    const estrutura = extrairEstrutura(data);
    const estruturaStr = JSON.stringify(estrutura);
    if (estruturaStr.length <= maxSize) {
      return estruturaStr;
    }
    return jsonStr.slice(0, maxSize) + '...';
  } catch {
    return '{}';
  }
}

function extrairEstrutura(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return typeof obj;

  if (Array.isArray(obj)) {
    if (obj.length === 0) return [];
    return [extrairEstrutura(obj[0])];
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[key] = extrairEstrutura(obj[key]);
  }
  return result;
}

// ============================================
// FUNÇÕES DE MAPEAMENTO PARA BANCO DE DADOS
// ============================================

/**
 * Valida se um valor é um status válido
 */
function validarStatus(value: string): "✔ Validado" | "⚠️ Em análise" | "❌ Inativo" | "🔍 Pendente" {
  const validStatus = ["✔ Validado", "⚠️ Em análise", "❌ Inativo", "🔍 Pendente"];
  return validStatus.includes(value) ? (value as any) : "🔍 Pendente";
}

/**
 * Valida se um valor é uma maturidade válida
 */
function validarMaturidade(value: string): "descoberto" | "parcial" | "completo" | "instavel" | "descontinuado" {
  const validMaturidade = ["descoberto", "parcial", "completo", "instavel", "descontinuado"];
  return validMaturidade.includes(value) ? (value as any) : "descoberto";
}

/**
 * Valida se um valor é uma utilidade válida
 */
function validarUtilidade(value: number): 1 | 2 | 3 | 4 | 5 {
  const validUtilidade = [1, 2, 3, 4, 5];
  return validUtilidade.includes(value) ? (value as 1 | 2 | 3 | 4 | 5) : 3;
}

export function endpointInfoToDb(endpointInfo: EndpointInfo) {
  return {
    campos: endpointInfo.campos,
    tipos: endpointInfo.tipos || {},
    parametros: endpointInfo.parametros || [],
    total_campos: endpointInfo.totalCampos,
    status: endpointInfo.status || '🔍 Pendente',
    maturidade: endpointInfo.maturidade || 'descoberto',
    confianca: endpointInfo.confianca || 10,
    ultimo_hash: endpointInfo.ultimoHash || null,
    historico: endpointInfo.historico || [],
    hash_history: endpointInfo.hashHistory || [],
    observacoes: endpointInfo.observacoes || '',
    utilidade: endpointInfo.utilidade || 3,
    scans_realizados: endpointInfo.scansRealizados || 0,
    ultimo_scan: endpointInfo.ultimoScan || new Date().toISOString()
  };
}

export function dbToEndpointInfo(dbData: KnowledgeBaseRow): EndpointInfo {
  return {
    campos: dbData.campos || [],
    parametros: dbData.parametros || [],
    totalCampos: dbData.total_campos || 0,
    ultimoScan: dbData.ultimo_scan || new Date().toISOString(),
    tipos: dbData.tipos || {},
    historico: dbData.historico || [],
    status: validarStatus(dbData.status || '🔍 Pendente'),
    maturidade: validarMaturidade(dbData.maturidade || 'descoberto'),
    observacoes: dbData.observacoes || '',
    utilidade: validarUtilidade(dbData.utilidade || 3),
    confianca: dbData.confianca || 10,
    scansRealizados: dbData.scans_realizados || 0,
    ultimoHash: dbData.ultimo_hash || undefined,
    hashHistory: dbData.hash_history || []
  };
}

// ============================================
// EXPORTAÇÕES PARA COMPATIBILIDADE
// ============================================

export type { EndpointInfo as EndpointInfoType };
export type { CatalogoType as CatalogoTypeType };
export type { CategoriasType as CategoriasTypeType };
export type { CategoriaEndpoint as CategoriaEndpointType };
export type { AnalysisInfo as AnalysisInfoType };