'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { useGame } from '@/app/context/GameContext';
import {
  type AnalysisInfo,
  type CatalogoType,
  type CategoriaEndpoint,
  type CategoriasType,
  CATEGORIAS_VALIDAS,
  STATUS_VALIDOS,
  MATURIDADE_VALIDA,
  autoCategorizar,
  detectarParametro,
  calcularConfianca,
  calcularMaturidade,
} from '@/app/lib/knowledge-base';
import { endpoints, exploreGproEndpoint } from '@/app/lib/gpro-api';
import {
  getCatalogo,
  saveCatalogo,
  deleteCatalogo
} from '@/app/lib/knowledge-base-api';
import { type EndpointInfo } from '@/app/lib/knowledge-base';
import { processEndpointScan } from '@/app/lib/endpoint-scan-service';
import { persistEndpointKnowledge } from '@/app/lib/knowledge-persistence-service';
import { analyzeLegacyEndpoint } from '@/app/lib/legacy-knowledge-adapter';
import { createKnowledgeScanSession } from '@/app/lib/knowledge-scan-session';
import { runDiscovery } from '@/app/lib/discovery-service';
import { runKnowledgeScan } from '@/app/lib/knowledge-scan-service';
import { runKnowledgeEndpointScan } from '@/app/lib/knowledge-endpoint-scan-service';
import type { DiscoveryReadModel } from '@/app/lib/discovery-read-model';
import { Loader2, Database, Sparkles, Crown, Shield, Rocket, Zap, Brain, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import he from 'he';

export default function GproKbPage() {
  const { isGlobalLoading } = useGame();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Estados do Explorer
  const [endpoint, setEndpoint] = useState('Menu');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscaCampos, setBuscaCampos] = useState('');
  const [paramKey, setParamKey] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [hasParams, setHasParams] = useState(false);
  const [detectedParams, setDetectedParams] = useState<string[]>([]);

  // Estados da Knowledge Base
  const [catalogo, setCatalogo] = useState<CatalogoType>({});
  const [categorias, setCategorias] = useState<CategoriasType>({});
  const [scanning, setScanning] = useState(false);
  const cancelScanRef = useRef(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentEndpoint: '' });
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [lastDiscovery, setLastDiscovery] = useState<DiscoveryReadModel | null>(null);
  const [lastScanDurationMs, setLastScanDurationMs] = useState<number | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [compareEndpoint1, setCompareEndpoint1] = useState('');
  const [compareEndpoint2, setCompareEndpoint2] = useState('');
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(null);

  // Obter User ID
  useEffect(() => {
    async function getUserId() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
        }
      } catch (error) {
        console.error('Erro ao obter userId:', error);
      } finally {
        setIsLoadingAuth(false);
      }
    }
    getUserId();
  }, []);

  // Carregar catálogo do Supabase
  useEffect(() => {
    async function loadCatalogo() {
      if (!userId) {
        setIsLoadingCatalog(false);
        return;
      }

      try {
        const data = await getCatalogo(userId);
        setCatalogo(data);
        
        try {
          const savedCategorias = localStorage.getItem('gpro-categorias');
          if (savedCategorias) {
            setCategorias(JSON.parse(savedCategorias));
          }
        } catch (error) {
          console.error('Erro ao carregar categorias:', error);
        }
      } catch (error) {
        console.error('Erro ao carregar catálogo:', error);
        setError('Erro ao carregar catálogo. Tente recarregar a página.');
      } finally {
        setIsLoadingCatalog(false);
      }
    }

    loadCatalogo();
  }, [userId]);

  // Salvar categorias locais
  useEffect(() => {
    try {
      localStorage.setItem('gpro-categorias', JSON.stringify(categorias));
    } catch (error) {
      console.error('Erro ao salvar categorias:', error);
    }
  }, [categorias]);

  // Executar Endpoint
  async function executar() {
    if (!userId) {
      setError('Usuário não autenticado. Faça login primeiro.');
      return;
    }

    setError(null);
    setAnalysis(null);
    setDetectedParams([]);
    setLoading(true);

    try {
      let data: any;
      if (hasParams && paramKey && paramValue) {
        data = await exploreGproEndpoint(endpoint, { [paramKey]: paramValue }, userId);
      } else {
        data = await exploreGproEndpoint(endpoint, undefined, userId);
      }

      setResponse(data);
      await analisarResposta(data, endpoint);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao executar requisição');

      const paramDetectado = detectarParametro(err.message || '');
      if (paramDetectado) {
        setDetectedParams(prev => [...prev, paramDetectado]);
        setError(`⚠️ Endpoint requer parâmetro: ${paramDetectado}`);
        setHasParams(true);
        setParamKey(paramDetectado);
        setParamValue('');
      }
    } finally {
      setLoading(false);
    }
  }

  // Analisar e Salvar Resposta no Supabase
  async function analisarResposta(data: any, endpointName: string) {
    if (!data) {
      setAnalysis(null);
      return;
    }

    const result = analyzeLegacyEndpoint(data, endpointName, catalogo);
    if (!result) {
      setAnalysis(null);
      return;
    }

    setAnalysis(result.analysis);

    try {
      await persistEndpointKnowledge(endpointName, result.endpointInfo, userId!);
      setCatalogo(prev => ({
        ...prev,
        [endpointName]: result.endpointInfo
      }));
    } catch (error) {
      console.error('Erro ao salvar endpoint no Supabase:', error);
      setError(`Erro ao salvar ${endpointName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  // Scan Completo Sequencial Persistente
  async function scanAllEndpoints() {
    if (!userId) {
      alert('Usuário não autenticado');
      return;
    }

    if (scanning) return;

    setScanning(true);
    cancelScanRef.current = false;
    const novosLogs: string[] = [];
    let salvosComSucesso = 0;
    let falhas = 0;
    const discoverySession = createKnowledgeScanSession();
    const scanStartedAt = performance.now();
    await runKnowledgeScan(
      {
        userId: userId!,
        endpoints,
        catalogo,
        categorias,
        cancelRequested: () => cancelScanRef.current,
      },
      {
        onProgress: progress => {
          setScanProgress(progress);
        },
        onEndpoint: async (ep) => {
          novosLogs.push(`⏳ Escaneando ${ep}...`);
          const endpointResult = await runKnowledgeEndpointScan({
            userId: userId!,
            endpoint: ep,
            catalogo,
            categorias,
            session: discoverySession.build(),
          });

          if (endpointResult.requiresParameter) {
            if (endpointResult.saved && endpointResult.endpointInfo) {
              salvosComSucesso++;
              setCatalogo(prev => ({
                ...prev,
                [ep]: endpointResult.endpointInfo!
              }));
              if (!categorias[ep]) {
                const categoriaSugerida = autoCategorizar(ep);
                if (categoriaSugerida) {
                  setCategorias(prev => ({ ...prev, [ep]: categoriaSugerida }));
                }
              }
            } else {
              falhas++;
            }
          } else if (endpointResult.success && endpointResult.endpointInfo) {
            salvosComSucesso++;
            setCatalogo(prev => ({
              ...prev,
              [ep]: endpointResult.endpointInfo!
            }));
            if (!categorias[ep]) {
              const categoriaSugerida = autoCategorizar(ep);
              if (categoriaSugerida) {
                setCategorias(prev => ({ ...prev, [ep]: categoriaSugerida }));
              }
            }
          } else {
            falhas++;
          }

          novosLogs.push(endpointResult.logMessage);
          setScanLog([...novosLogs]);
          await new Promise(r => setTimeout(r, 300));
        },
      }
    );

    if (!cancelScanRef.current) {
      const discoveryReadModel = runDiscovery(discoverySession.build());
      setLastDiscovery(discoveryReadModel);
      setLastScanDurationMs(performance.now() - scanStartedAt);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DiscoveryEngine][shadow]', discoveryReadModel);
      }
      novosLogs.push(`✅ Scan concluído! ${salvosComSucesso} salvos, ${falhas} falhas`);
      setScanLog([...novosLogs]);
    }

    setScanProgress({ current: 0, total: 0, currentEndpoint: '' });
    setScanning(false);
  }

  function cancelarScan() {
    cancelScanRef.current = true;
      setScanLog(prev => [...prev, '⛔ Cancelando scan...']);
  }

  // Funções de Gerenciamento da KB
  function toggleFavorito(endpointName: string) {
    setCategorias(prev => {
      const novo = { ...prev };
      if (novo[endpointName] === '⭐ Favorito') {
        delete novo[endpointName];
      } else {
        novo[endpointName] = '⭐ Favorito';
      }
      return novo;
    });
  }

  function setCategoria(endpointName: string, categoria: CategoriaEndpoint) {
    setCategorias(prev => {
      const novo = { ...prev };
      if (categoria === '📋 Geral') {
        delete novo[endpointName];
      } else {
        novo[endpointName] = categoria;
      }
      return novo;
    });
  }

  async function persistAndSyncEndpoint(endpointName: string, endpointInfo: EndpointInfo) {
    if (!userId) return;

    await persistEndpointKnowledge(endpointName, endpointInfo, userId);

    setCatalogo(prev => ({
      ...prev,
      [endpointName]: endpointInfo
    }));

    if (analysis && analysis.endpoint === endpointName) {
      setAnalysis(prev => prev ? {
        ...prev,
        status: endpointInfo.status ?? prev.status,
        maturidade: endpointInfo.maturidade ?? prev.maturidade,
        confianca: endpointInfo.confianca ?? prev.confianca,
        observacoes: endpointInfo.observacoes ?? prev.observacoes,
        utilidade: endpointInfo.utilidade ?? prev.utilidade,
        parametros: endpointInfo.parametros ?? prev.parametros,
        ultimoHash: endpointInfo.ultimoHash ?? prev.ultimoHash,
        ultimoScan: endpointInfo.ultimoScan ?? prev.ultimoScan,
        scansRealizados: endpointInfo.scansRealizados ?? prev.scansRealizados,
      } : null);
    }
  }

  async function setStatus(endpointName: string, status: string) {
    if (!userId) return;

    const existing = catalogo[endpointName];
    if (!existing) return;

    const confianca = calcularConfianca(existing.historico, status);
    const maturidade = calcularMaturidade(existing.historico, status, existing.parametros || []);
    const novo = { ...existing, status: status as any, confianca, maturidade };

    try {
      await persistAndSyncEndpoint(endpointName, novo);
    } catch (err) {
      console.error('Erro ao salvar status:', err);
    }
  }

  async function setMaturidade(endpointName: string, maturidade: string) {
    if (!userId) return;

    const existing = catalogo[endpointName];
    if (!existing) return;

    const novo = { ...existing, maturidade: maturidade as any };

    try {
      await persistAndSyncEndpoint(endpointName, novo);
    } catch (err) {
      console.error('Erro ao salvar maturidade:', err);
    }
  }

  function setObservacao(endpointName: string, observacao: string) {
    if (!userId) return;

    const existing = catalogo[endpointName];
    if (!existing) return;

    const novo = { ...existing, observacoes: observacao };

    persistAndSyncEndpoint(endpointName, novo).catch(err =>
      console.error('Erro ao salvar observação:', err)
    );
  }

  function setUtilidade(endpointName: string, utilidade: 1 | 2 | 3 | 4 | 5) {
    if (!userId) return;

    const existing = catalogo[endpointName];
    if (!existing) return;

    const novo = { ...existing, utilidade };

    persistAndSyncEndpoint(endpointName, novo).catch(err =>
      console.error('Erro ao salvar utilidade:', err)
    );
  }

  function toggleExpand(endpointName: string) {
    setExpandedEndpoints(prev => {
      const novo = new Set(prev);
      if (novo.has(endpointName)) {
        novo.delete(endpointName);
      } else {
        novo.add(endpointName);
      }
      return novo;
    });
  }

  // Documentação e Backup
  function gerarDocumentacao() {
    if (Object.keys(catalogo).length === 0) {
      alert('Catálogo vazio. Execute algumas requisições primeiro.');
      return;
    }

    let docs = '# GPRO API - Knowledge Base\n\n';
    docs += `Gerado em: ${new Date().toISOString()}\n\n`;
    docs += `Total de endpoints: ${Object.keys(catalogo).length}\n`;
    docs += `Total de campos únicos: ${estatisticas.totalCampos}\n\n`;

    docs += '## Estatísticas por Categoria\n\n';
    Object.entries(estatisticas.camposPorCategoria).forEach(([categoria, total]) => {
      docs += `- **${categoria}:** ${total} campos\n`;
    });
    docs += '\n';

    docs += '## Status dos Endpoints\n\n';
    Object.entries(estatisticas.endpointsPorStatus).forEach(([status, total]) => {
      docs += `- **${status}:** ${total} endpoints\n`;
    });
    docs += '\n';

    docs += '## Maturidade dos Endpoints\n\n';
    Object.entries(estatisticas.endpointsPorMaturidade).forEach(([maturidade, total]) => {
      const labels: Record<string, string> = {
        descoberto: '🔍 Descoberto',
        parcial: '⚠️ Parcial',
        completo: '✅ Completo',
        instavel: '🔄 Instável',
        descontinuado: '🚫 Descontinuado'
      };
      docs += `- **${labels[maturidade] || maturidade}:** ${total} endpoints\n`;
    });
    docs += '\n';

    docs += '## Endpoints Mapeados\n\n';
    const endpointsOrdenados = Object.keys(catalogo).sort((a, b) => {
      const aCat = categorias[a] || '📋 Geral';
      const bCat = categorias[b] || '📋 Geral';
      return aCat.localeCompare(bCat);
    });

    for (const ep of endpointsOrdenados) {
      const info = catalogo[ep];
      const categoria = categorias[ep] || '?? Geral';
      const status = info.status || '?? Pendente';
      const maturidade = info.maturidade || 'descoberto';
      const utilidade = info.utilidade
        ? `${'?'.repeat(info.utilidade)}${'?'.repeat(5 - info.utilidade)}`
        : 'N?o avaliado';
      const confianca = info.confianca || 0;
      const labels: Record<string, string> = {
        descoberto: '?? Descoberto',
        parcial: '?? Parcial',
        completo: '? Completo',
        instavel: '?? Inst?vel',
        descontinuado: '?? Descontinuado'
      };
      docs += `### ${ep} (${categoria}) - ${status}\n\n`;
      docs += `- **Campos:** ${info.totalCampos}\n`;
      docs += `- **Maturidade:** ${labels[maturidade] || maturidade}\n`;
      docs += `- **Utilidade:** ${utilidade}\n`;
      docs += `- **Confiança:** ${confianca}%\n`;
      docs += `- **Scans realizados:** ${info.scansRealizados || 0}\n`;
      docs += `- **Último scan:** ${info.ultimoScan}\n`;
      docs += `- **Hash do Schema:** ${info.ultimoHash || 'N/A'}\n`;

      if (info.parametros && info.parametros.length > 0) {
        docs += `- **Parâmetros requeridos:** ${info.parametros.join(', ')}\n`;
      }

      if (info.observacoes) {
        docs += `- **Observações:** ${info.observacoes}\n`;
      }

      if (info.historico && info.historico.length > 0) {
        docs += '- **Histórico de descoberta:**\n';
        info.historico.slice(-5).forEach(h => {
        docs += `  - ${h.data}: ${h.campos} campos${h.hash ? ` (${h.hash})` : ''}\n`;
        });
        if (info.historico.length >= 50) {
          docs += '  - (últimos 50 registros mostrados)\n';
        }
      }

      docs += '\n**Schema:**\n\n```json\n';
      const schema: Record<string, string> = {};
      if (info.tipos) {
        Object.entries(info.tipos).forEach(([campo, tipo]) => {
          schema[campo] = tipo;
        });
      }
      docs += JSON.stringify(schema, null, 2);
      docs += '\n```\n\n---\n\n';
    }

    const blob = new Blob([docs], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpro-knowledge-base-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarCatalogo() {
    if (Object.keys(catalogo).length === 0) {
      alert('Catálogo vazio. Execute algumas requisições primeiro.');
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const dadosExport = {
      catalogo,
      categorias,
      estatisticas,
      data: now.toISOString()
    };

    const blob = new Blob([JSON.stringify(dadosExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpro-knowledge-base-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function limparKnowledgeBase() {
    if (!userId) {
      alert('Usuário não autenticado');
      return;
    }

    if (confirm('Tem certeza que deseja limpar toda a Knowledge Base')) {
      try {
        await deleteCatalogo(userId);
        setCatalogo({});
        setCategorias({});
        setAnalysis(null);
        localStorage.removeItem('gpro-categorias');
        alert('Knowledge Base removida com sucesso!');
      } catch (error) {
        console.error('Erro ao limpar Knowledge Base:', error);
        alert('Erro ao limpar Knowledge Base. Tente novamente.');
      }
    }
  }

  // Helpers de Exportação
  async function copiarJSON() {
    if (!response) {
      alert('Nenhum JSON para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      alert('JSON copiado para a área de transferência');
    } catch (error) {
      console.error('Erro ao copiar JSON:', error);
      alert('Erro ao copiar JSON');
    }
  }

  function baixarJSON() {
    if (!response) {
      alert('Nenhum JSON para baixar');
      return;
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint}-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiarCampos() {
    if (!analysis || !analysis.campos || analysis.campos.length === 0) {
      alert('Nenhum campo para copiar');
      return;
    }
    const camposTexto = analysis.campos.join('\n');
    try {
      await navigator.clipboard.writeText(camposTexto);
      alert(`${analysis.campos.length} campos copiados`);
    } catch (error) {
      console.error('Erro ao copiar campos:', error);
      alert('Erro ao copiar campos');
    }
  }

  function limparResposta() {
    setResponse(null);
    setAnalysis(null);
    setError(null);
    setDetectedParams([]);
  }

  // Estatísticas Memoizadas
  const estatisticas = useMemo(() => {
    const totalEndpoints = Object.keys(catalogo).length;
    const todosCampos = new Set(Object.values(catalogo).flatMap(info => info.campos));
    const totalCampos = todosCampos.size;

    let maiorEndpoint = { nome: '', campos: 0 };
    let menorEndpoint = { nome: '', campos: Infinity };

    Object.entries(catalogo).forEach(([nome, info]) => {
      const count = info.campos.length;
      if (count > maiorEndpoint.campos) {
        maiorEndpoint = { nome, campos: count };
      }
      if (count < menorEndpoint.campos && count > 0) {
        menorEndpoint = { nome, campos: count };
      }
    });

    const ranking = Object.entries(catalogo)
      .map(([nome, info]) => ({
        nome,
        campos: info.campos.length,
        parametros: info.parametros.length || 0,
        confianca: info.confianca || 0,
        maturidade: info.maturidade || 'descoberto'
      }))
      .sort((a, b) => b.campos - a.campos);

    const camposPorCategoria: Record<string, number> = {};
    Object.entries(categorias).forEach(([endpoint, categoria]) => {
      if (!camposPorCategoria[categoria]) {
        camposPorCategoria[categoria] = 0;
      }
      camposPorCategoria[categoria] += catalogo[endpoint].campos.length || 0;
    });

    const endpointsPorStatus: Record<string, number> = {};
    Object.values(catalogo).forEach(info => {
      const status = info.status || '🔍 Pendente';
      endpointsPorStatus[status] = (endpointsPorStatus[status] || 0) + 1;
    });

    const endpointsPorMaturidade: Record<string, number> = {};
    Object.values(catalogo).forEach(info => {
      const maturidade = info.maturidade || 'descoberto';
      endpointsPorMaturidade[maturidade] = (endpointsPorMaturidade[maturidade] || 0) + 1;
    });

    return {
      totalEndpoints,
      totalCampos,
      maiorEndpoint,
      menorEndpoint: menorEndpoint.campos === Infinity ? { nome: '', campos: 0 } : menorEndpoint,
      ranking,
      camposPorCategoria,
      endpointsPorStatus,
      endpointsPorMaturidade
    };
  }, [catalogo, categorias]);

  // Comparador de Schemas
  const comparacao = useMemo(() => {
    if (!compareEndpoint1 || !compareEndpoint2) return null;
    if (!catalogo[compareEndpoint1] || !catalogo[compareEndpoint2]) return null;

    const campos1 = new Set(catalogo[compareEndpoint1].campos);
    const campos2 = new Set(catalogo[compareEndpoint2].campos);

    const emComum = [...campos1].filter(c => campos2.has(c));
    const somente1 = [...campos1].filter(c => !campos2.has(c));
    const somente2 = [...campos2].filter(c => !campos1.has(c));

    return {
      emComum,
      somente1,
      somente2,
      totalComum: emComum.length,
      totalSomente1: somente1.length,
      totalSomente2: somente2.length
    };
  }, [catalogo, compareEndpoint1, compareEndpoint2]);

  // Filtro de Busca de Campos de Resposta
  const camposFiltrados = useMemo(() => {
    if (!analysis?.campos) return [];
    if (!buscaCampos) return analysis.campos;
    return analysis.campos.filter(campo =>
      campo.toLowerCase().includes(buscaCampos.toLowerCase())
    );
  }, [analysis?.campos, buscaCampos]);

  const maturidadeLabels: Record<string, { label: string; color: string }> = {
    descoberto: { label: '🔍 Descoberto', color: 'bg-slate-100 border-slate-200 text-slate-600' },
    parcial: { label: '⚠️ Parcial', color: 'bg-amber-50 border-amber-200 text-amber-600 font-bold' },
    completo: { label: '✅ Completo', color: 'bg-emerald-50 border-emerald-300 text-emerald-600 font-black shadow-sm' },
    instavel: { label: '🔄 Instável', color: 'bg-orange-50 border-orange-200 text-orange-600' },
    descontinuado: { label: '🚫 Descontinuado', color: 'bg-rose-50 border-rose-200 text-rose-600' },
  };

  const mappedEndpoints = Object.keys(catalogo).length;
  const discoverySummary = lastDiscovery?.summary ?? {
    totalEvents: 0,
    infoCount: 0,
    noticeCount: 0,
    warningCount: 0,
  };
  const discoveryTotals = lastDiscovery?.totals ?? {
    endpointCount: 0,
    schemaChanges: 0,
    newEndpoints: 0,
    newFields: 0,
  };
  const discoveryEvents = lastDiscovery?.events ?? [];
  const selectedEndpointInfo = selectedEndpoint ? catalogo[selectedEndpoint] : null;
  const selectedEndpointAnalysis =
    analysis && selectedEndpoint && analysis.endpoint === selectedEndpoint ? analysis : null;
  const selectedTimelineEvents = discoveryEvents
    .filter(event => !selectedEndpoint || event.description.includes(selectedEndpoint))
    .slice(0, 5);
  const coveragePercent = endpoints.length ? Math.round((mappedEndpoints / endpoints.length) * 100) : 0;
  const averageConfidence = mappedEndpoints
    ? Math.round(Object.values(catalogo).reduce((sum, info) => sum + (info.confianca || 0), 0) / mappedEndpoints)
    : 0;
  const stableEndpoints = Object.values(catalogo).filter(info => info.maturidade !== 'instavel').length;
  const schemaStability = mappedEndpoints ? Math.round((stableEndpoints / mappedEndpoints) * 100) : 0;
  const discoveryRate = endpoints.length ? Math.round((discoveryTotals.newEndpoints / endpoints.length) * 100) : 0;
  const healthScore = Math.round((coveragePercent + schemaStability + discoveryRate + averageConfidence) / 4);
  const progressPercent = scanProgress.total ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0;
  const endpointsPorCategoria = useMemo(() => {
    const grupos: Record<string, string[]> = {};

    endpoints.forEach(endpointName => {
      const categoria = categorias[endpointName] || autoCategorizar(endpointName) || '📋 Geral';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(endpointName);
    });

    return grupos;
  }, [categorias]);

  const isAuthenticated = !!userId;
  const isReady = !isLoadingAuth && !isLoadingCatalog && !isGlobalLoading;

  if (isLoadingAuth || isLoadingCatalog || isGlobalLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-600 shadow-sm">
          Carregando Knowledge Center...
        </div>
      </div>
    );
  }

  const knowledgeCenter = (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8 pb-24">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[650px] h-[650px] bg-emerald-500/[0.05] blur-[140px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-12%] w-[520px] h-[520px] bg-sky-500/[0.04] blur-[140px] rounded-full" />
        </div>

        <header className="relative z-10 overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">
                <Sparkles size={12} />
                Knowledge Center
              </div>
              <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-tight text-slate-950">
                Knowledge Platform
              </h1>
              <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-600 leading-relaxed">
                O Explorer agora lê o conhecimento, a saúde da base e o que a plataforma descobriu hoje.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Último scan</p>
                <p className="mt-2 text-sm font-black text-slate-900">{lastScanDurationMs ? `${Math.round(lastScanDurationMs / 1000)}s` : ''}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endpoints</p>
                <p className="mt-2 text-sm font-black text-slate-900">{mappedEndpoints}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duração</p>
                <p className="mt-2 text-sm font-black text-slate-900">{lastScanDurationMs ? `${Math.round(lastScanDurationMs)}ms` : ''}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status geral</p>
                <p className="mt-2 text-sm font-black text-emerald-700">{scanning ? 'Scanning' : 'Ready'}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="relative z-10 mt-6 grid gap-6 md:grid-cols-2">
          <Link href="/dashboard/admin/research/tyres" className="group rounded-[1.75rem] border border-emerald-200 bg-white/90 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">
              <Brain size={12} />
              Research Center
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">Tyre Research Lab</h2>
            <p className="mt-2 text-sm text-slate-600">Acesse a primeira ?rea funcional de pesquisa da Knowledge Platform.</p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
              Abrir laborat?rio <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        </section>

        <main className="relative z-10 mt-6 grid gap-6">
          <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Knowledge Insights</p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">O que a plataforma descobriu</h2>
                </div>
                <button
                  onClick={scanAllEndpoints}
                  className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50"
                  disabled={scanning || loading || !isAuthenticated}
                >
                  {scanning ? 'Escaneando...' : 'Rodar scan'}
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'Novos endpoints', value: discoveryTotals.newEndpoints, tone: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Novos campos', value: discoveryTotals.newFields, tone: 'text-amber-700', bg: 'bg-amber-50' },
                  { label: 'Mudanças estruturais', value: discoveryTotals.schemaChanges, tone: 'text-rose-700', bg: 'bg-rose-50' },
                  { label: 'Eventos totais', value: discoverySummary.totalEvents, tone: 'text-slate-900', bg: 'bg-slate-50' },
                  { label: 'INFO', value: discoverySummary.infoCount, tone: 'text-sky-700', bg: 'bg-sky-50' },
                  { label: 'WARNING', value: discoverySummary.warningCount, tone: 'text-orange-700', bg: 'bg-orange-50' },
                ].map(card => (
                  <div key={card.label} className={`rounded-2xl border border-slate-200 ${card.bg} p-4`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</p>
                    <p className={`mt-2 text-3xl font-black ${card.tone}`}>{card.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Knowledge Health</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Saúde da base</h2>
                  <p className="mt-1 text-sm text-slate-500">Coverage, estabilidade, discovery rate e confidence.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Score geral</p>
                  <p className="text-4xl font-black text-emerald-700">{healthScore}%</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  { label: 'Coverage', value: coveragePercent },
                  { label: 'Schema Stability', value: schemaStability },
                  { label: 'Discovery Rate', value: discoveryRate },
                  { label: 'Confidence', value: averageConfidence },
                ].map(metric => (
                  <div key={metric.label}>
                    <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-500">
                      <span>{metric.label}</span>
                      <span>{metric.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all" style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Activity</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Timeline da plataforma</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {discoveryEvents.length} eventos
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {(discoveryEvents.length > 0 ? discoveryEvents : [{ severity: 'INFO', title: 'Sem descobertas ainda', description: 'Execute um scan para gerar eventos.' }]).map((event, index) => (
                <div key={index} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <div className={`mt-0.5 h-3 w-3 rounded-full ${event.severity === 'WARNING' ? 'bg-rose-500' : event.severity === 'NOTICE' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{event.severity}</span>
                      <span className="text-sm font-black text-slate-950">{event.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Controls</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Scan, filtros e ações</h2>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{endpoints.length} endpoints</span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2.5">
                  <select
                    className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-800 outline-none focus:border-emerald-500"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    disabled={loading || scanning || !isAuthenticated}
                  >
                    {Object.entries(endpointsPorCategoria).map(([categoria, eps]) => (
                      <optgroup key={categoria} label={categoria}>
                        {eps.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <button
                    onClick={executar}
                    className="rounded-xl border border-emerald-500 bg-emerald-600 px-5 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    disabled={loading || scanning || !isAuthenticated}
                  >
                    {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Executando...</span> : 'Executar'}
                  </button>

                  <button
                    onClick={scanAllEndpoints}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                    disabled={scanning || loading || !isAuthenticated}
                  >
                    {scanning ? `? ${scanProgress.current}/${scanProgress.total}` : 'Scan Todos'}
                  </button>

                  {scanning && (
                    <button
                      onClick={cancelarScan}
                      className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-100"
                    >
                      Cancelar
                    </button>
                  )}

                  <button
                    onClick={limparResposta}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:border-slate-300"
                    disabled={!response && !error}
                  >
                    Limpar
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-4 flex-wrap border-t border-slate-200 pt-3">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                    <input
                      type="checkbox"
                      checked={hasParams}
                      onChange={(e) => setHasParams(e.target.checked)}
                      className="accent-emerald-500"
                      disabled={!isAuthenticated}
                    />
                    Parâmetros
                  </label>
                  {hasParams && (
                    <div className="flex gap-2 flex-1 animate-fadeIn">
                      <input
                        className="flex-1 min-w-[120px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                        placeholder="Ex: driverId"
                        value={paramKey}
                        onChange={(e) => setParamKey(e.target.value)}
                        disabled={!isAuthenticated}
                      />
                      <input
                        className="flex-1 min-w-[120px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                        placeholder="Valor"
                        value={paramValue}
                        onChange={(e) => setParamValue(e.target.value)}
                        disabled={!isAuthenticated}
                      />
                      {detectedParams.length > 0 && (
                        <span className="flex items-center text-[10px] font-bold text-amber-600">⚠️ Parâmetros sugeridos: {detectedParams.join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Knowledge Status</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Total endpoints</span><strong>{mappedEndpoints}</strong></div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Scanning</span><strong>{scanning ? 'Yes' : 'No'}</strong></div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Discovery events</span><strong>{discoverySummary.totalEvents}</strong></div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>Coverage</span><strong>{coveragePercent}%</strong></div>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 relative z-10">
              ⚠️ {error}
            </div>
          )}

          {scanProgress.total > 0 && scanning && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-black">
                    <span className="text-amber-700">Escaneando: {scanProgress.currentEndpoint}</span>
                    <span className="text-amber-600">{scanProgress.current}/{scanProgress.total}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-slate-300/30 bg-slate-200">
                    <div className="h-2 rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {scanLog.length > 0 && (
            <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <strong className="mb-2 block text-xs font-black uppercase flex items-center gap-2 text-slate-800">
                <Database size={14} className="text-emerald-600" />
                ?? Log do Scan: {scanning ? '? Em andamento...' : 'Conclu?do'}
              </strong>
              <div className="space-y-1">
                {scanLog.map((log, index) => <div key={index} className="text-xs font-mono text-slate-500">{log}</div>)}
              </div>
            </div>
          )}

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Endpoints</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Cards da base</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {mappedEndpoints} cards
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Object.entries(catalogo)
                .sort(([, a], [, b]) => (b.totalCampos || 0) - (a.totalCampos || 0))
                .map(([endpointName, info]) => {
                  const categoria = categorias[endpointName] || '📋 Geral';
                  const maturityLabel = maturidadeLabels[info.maturidade || 'descoberto'].label || '🔍 Descoberto';
                  return (
                    <button
                      key={endpointName}
                      onClick={() => setSelectedEndpoint(endpointName)}
                      className="group rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-950">{endpointName}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">{categoria}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{maturityLabel}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 transition group-hover:text-emerald-600" />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campos</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{info.totalCampos}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Confiança</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{info.confianca || 0}%</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fingerprint</p>
                          <p className="mt-1 truncate font-mono text-[10px] font-bold text-slate-700">{info.ultimoHash || 'N/A'}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Última mudança</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{info.ultimoScan ? new Date(info.ultimoScan).toLocaleTimeString('pt-BR') : 'N/A'}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-700">Open →</p>
                    </button>
                  );
                })}
            </div>
          </section>
        </main>

        <aside className={`fixed right-0 top-0 z-50 h-full w-full max-w-[460px] border-l border-slate-200 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-transform duration-300 ${selectedEndpoint ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Drawer</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Detalhes do endpoint</h2>
              </div>
              <button onClick={() => setSelectedEndpoint(null)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500">Fechar</button>
            </div>

            <div className="flex-1 overflow-y-auto py-5">
              {selectedEndpointInfo ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">{selectedEndpoint}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedEndpointAnalysis?.status || selectedEndpointInfo.status || 'Dispon?vel em pr?xima fase'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Schema</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedEndpointAnalysis?.totalCampos ?? selectedEndpointInfo.totalCampos}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fingerprint</p>
                      <p className="mt-1 truncate font-mono text-[10px] font-bold text-slate-700">{selectedEndpointInfo.ultimoHash || 'Dispon?vel em pr?xima fase'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campos</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedEndpointAnalysis?.campos.length ?? selectedEndpointInfo.campos.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipos</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedEndpointAnalysis?.tipos ? Object.keys(selectedEndpointAnalysis.tipos).length : 'N/A'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observações</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedEndpointAnalysis?.observacoes || selectedEndpointInfo.observacoes || 'Dispon?vel em pr?xima fase'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Confiança</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{selectedEndpointInfo.confianca || 0}%</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline disponível</p>
                    <div className="mt-3 space-y-2">
                      {selectedTimelineEvents.length > 0 ? selectedTimelineEvents.map((event, index) => (
                        <div key={index} className="rounded-xl bg-slate-50 p-3 text-xs">
                          <p className="font-black text-slate-900">{event.title}</p>
                          <p className="mt-1 text-slate-600">{event.description}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-slate-500">Disponível em próxima fase</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Observation, Evidence e detalhes de histórico temporal estão prontos para a próxima fase.
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">Selecione um card para abrir o painel lateral.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
  return knowledgeCenter;
}
