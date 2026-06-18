'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  analisarEstrutura,
  criarHistorico,
  calcularConfianca,
  calcularMaturidade,
  calcularHashSchema,
  compactarExemplo
} from '@/app/lib/knowledge-base';
import { endpoints, exploreGproEndpoint } from '@/app/lib/gpro-api';
import {
  getCatalogo,
  saveCatalogo,
  deleteCatalogo,
  saveEndpoint
} from '@/app/lib/knowledge-base-api';

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
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [compareEndpoint1, setCompareEndpoint1] = useState('');
  const [compareEndpoint2, setCompareEndpoint2] = useState('');
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(null);

  // ============================================
  // OBTER USER ID DA SESSÃO
  // ============================================
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

  // ============================================
  // CARREGAR CATÁLOGO DO SUPABASE
  // ============================================
  useEffect(() => {
    async function loadCatalogo() {
      if (!userId) {
        setIsLoadingCatalog(false);
        return;
      }

      try {
        const data = await getCatalogo(userId);
        setCatalogo(data);
        
        // Carregar categorias do localStorage (mantido para preferências)
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

  // ============================================
  // SALVAR CATEGORIAS (mantido localStorage - Sprint 2.5)
  // ============================================
  useEffect(() => {
    try {
      localStorage.setItem('gpro-categorias', JSON.stringify(categorias));
    } catch (error) {
      console.error('Erro ao salvar categorias:', error);
    }
  }, [categorias]);

  // ============================================
  // EXECUTAR UM ENDPOINT
  // ============================================
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

  // ============================================
  // ANALISAR RESPOSTA E SALVAR NO SUPABASE
  // ============================================
  async function analisarResposta(data: any, endpointName: string) {
    if (!data) {
      setAnalysis(null);
      return;
    }

    const camposSet = new Set<string>();
    const tipos: Record<string, string> = {};
    let totalObjetosAninhados = 0;
    let totalArrays = 0;

    function analisarObjeto(obj: any, prefixo: string = '') {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        totalArrays++;
        const sample = obj.find(item => item && typeof item === 'object');
        if (sample) {
          analisarObjeto(sample, prefixo);
        }
        return;
      }

      if (prefixo) {
        totalObjetosAninhados++;
      }

      Object.keys(obj).forEach(key => {
        const valor = obj[key];
        const nomeCompleto = prefixo ? `${prefixo}.${key}` : key;

        if (!camposSet.has(nomeCompleto)) {
          camposSet.add(nomeCompleto);
        }

        if (valor !== null && typeof valor === 'object') {
          if (Array.isArray(valor)) {
            totalArrays++;
            if (valor.length > 0) {
              tipos[nomeCompleto] = `Array[${valor.length}]`;
              const sample = valor.find(item => item && typeof item === 'object');
              if (sample) {
                analisarObjeto(sample, nomeCompleto);
              }
            } else {
              tipos[nomeCompleto] = 'Array(vazio)';
            }
          } else {
            tipos[nomeCompleto] = 'Objeto';
            analisarObjeto(valor, nomeCompleto);
          }
        } else {
          tipos[nomeCompleto] = typeof valor;
        }
      });
    }

    analisarObjeto(data);

    const hash = calcularHashSchema(tipos);
    const historico = [{ data: new Date().toISOString(), campos: camposSet.size, hash }];
    const confianca = calcularConfianca(historico);
    const maturidade = calcularMaturidade(historico);

    const analysisResult: AnalysisInfo = {
      endpoint: endpointName,
      totalCampos: camposSet.size,
      objetos: totalObjetosAninhados,
      arrays: totalArrays,
      campos: [...camposSet],
      tipos: tipos,
      hash: hash,
      status: '🔍 Pendente',
      maturidade: maturidade,
      confianca: confianca,
    };

    setAnalysis(analysisResult);

    // Atualizar catálogo local e salvar no Supabase
    const existing = catalogo[endpointName] || {
      campos: [],
      parametros: [],
      totalCampos: 0,
      ultimoScan: '',
      historico: [],
      status: '🔍 Pendente' as const,
      observacoes: '',
      exemplo: compactarExemplo(data)
    };

    const endpointInfo = {
      campos: [...camposSet],
      parametros: existing.parametros || [],
      totalCampos: camposSet.size,
      ultimoScan: new Date().toISOString(),
      tipos: tipos,
      historico: historico,
      status: existing.status || '🔍 Pendente',
      maturidade: maturidade,
      observacoes: existing.observacoes || '',
      utilidade: existing.utilidade,
      exemplo: existing.exemplo || compactarExemplo(data),
      exemploHash: hash,
      confianca: confianca,
      scansRealizados: (existing.scansRealizados || 0) + 1,
      ultimoHash: hash,
      hashHistory: [...(existing.hashHistory || []), hash].slice(-10)
    };

    try {
      await saveEndpoint(endpointName, endpointInfo, userId!);
      setCatalogo(prev => ({
        ...prev,
        [endpointName]: endpointInfo
      }));
    } catch (error) {
      console.error('Erro ao salvar endpoint no Supabase:', error);
      setError(`Erro ao salvar ${endpointName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  // ============================================
  // SCAN DE TODOS OS ENDPOINTS - PERSISTENTE
  // ============================================
  async function scanAllEndpoints() {
    if (!userId) {
      alert('Usuário não autenticado');
      return;
    }

    if (scanning) return;

    setScanning(true);
    cancelScanRef.current = false;
    const novosLogs: string[] = [];
    // ✅ Já usa o catálogo atualizado conforme cada endpoint é salvo
    let currentProgress = 0;
    let salvosComSucesso = 0;
    let falhas = 0;

    for (let i = 0; i < endpoints.length; i++) {
      if (cancelScanRef.current) {
        novosLogs.push('⛔ Scan cancelado pelo usuário');
        break;
      }

      const ep = endpoints[i];
      currentProgress = i + 1;
      setScanProgress({ current: currentProgress, total: endpoints.length, currentEndpoint: ep });
      novosLogs.push(`⏳ Escaneando ${ep}...`);

      try {
        const data = await exploreGproEndpoint(ep, undefined, userId);

        if (data) {
          const camposSet = new Set<string>();
          const tipos: Record<string, string> = {};
          analisarEstrutura(data, camposSet, tipos);

          const hash = calcularHashSchema(tipos);

          // ✅ Busca a versão mais recente do catálogo
          const existing = catalogo[ep] || {
            campos: [],
            parametros: [],
            totalCampos: 0,
            ultimoScan: '',
            historico: [],
            status: '🔍 Pendente' as const,
            observacoes: '',
            exemplo: compactarExemplo(data)
          };

          const historico = criarHistorico(existing.historico, camposSet.size, hash);
          const confianca = calcularConfianca(historico, existing.status);
          const maturidade = calcularMaturidade(historico, existing.status, existing.parametros || []);

          if (!categorias[ep]) {
            const categoriaSugerida = autoCategorizar(ep);
            if (categoriaSugerida) {
              setCategorias(prev => ({ ...prev, [ep]: categoriaSugerida }));
            }
          }

          const endpointInfo = {
            campos: [...camposSet],
            parametros: existing.parametros || [],
            totalCampos: camposSet.size,
            ultimoScan: new Date().toISOString(),
            tipos: tipos,
            historico: historico,
            status: existing.status || '🔍 Pendente',
            maturidade: maturidade,
            observacoes: existing.observacoes || '',
            utilidade: existing.utilidade,
            exemplo: existing.exemplo || compactarExemplo(data),
            exemploHash: hash,
            confianca: confianca,
            scansRealizados: (existing.scansRealizados || 0) + 1,
            ultimoHash: hash,
            hashHistory: [...(existing.hashHistory || []), hash].slice(-10)
          };

          // ✅ SALVA IMEDIATAMENTE CADA ENDPOINT
          try {
            await saveEndpoint(ep, endpointInfo, userId!);
            salvosComSucesso++;
            
            // ✅ ATUALIZA O CATÁLOGO LOCAL
            setCatalogo(prev => ({
              ...prev,
              [ep]: endpointInfo
            }));
            
            novosLogs.push(`✅ ${ep} - ${camposSet.size} campos | ${maturidade} | conf: ${confianca}% (salvo)`);
          } catch (saveError) {
            falhas++;
            novosLogs.push(`❌ ${ep} - Analisado mas falhou ao salvar: ${saveError instanceof Error ? saveError.message : 'Erro desconhecido'}`);
          }
        } else {
          novosLogs.push(`⚠️ ${ep} - Resposta vazia`);
        }
      } catch (error: any) {
        console.error(`Erro em ${ep}:`, error);
        const paramDetectado = detectarParametro(error.message || '');
        if (paramDetectado) {
          // ✅ Mesmo com erro de parâmetro, salva o endpoint com os parâmetros detectados
          const existing = catalogo[ep] || {
            campos: [],
            parametros: [],
            totalCampos: 0,
            ultimoScan: '',
            historico: [],
            status: '🔍 Pendente' as const,
            observacoes: ''
          };
          const parametrosSet = new Set([...(existing.parametros || []), paramDetectado]);
          const historico = criarHistorico(existing.historico, 0);
          const confianca = calcularConfianca(historico, existing.status);
          const maturidade = calcularMaturidade(historico, existing.status, [...parametrosSet]);

          const endpointInfo = {
            ...existing,
            parametros: [...parametrosSet],
            ultimoScan: new Date().toISOString(),
            historico: historico,
            confianca: confianca,
            maturidade: maturidade,
            scansRealizados: (existing.scansRealizados || 0) + 1
          };

          try {
            await saveEndpoint(ep, endpointInfo, userId!);
            setCatalogo(prev => ({
              ...prev,
              [ep]: endpointInfo
            }));
            salvosComSucesso++;
            novosLogs.push(`⚠️ ${ep} - Requer parâmetro: ${paramDetectado} | ${maturidade} (salvo)`);
          } catch (saveError) {
            falhas++;
            novosLogs.push(`❌ ${ep} - Parâmetro detectado mas falhou ao salvar: ${saveError instanceof Error ? saveError.message : 'Erro desconhecido'}`);
          }
        } else {
          falhas++;
          novosLogs.push(`❌ ${ep} - ${error.message || 'Erro desconhecido'}`);
        }
      }

      // Atualiza o log e progresso a cada iteração
      setScanLog([...novosLogs]);
      await new Promise(r => setTimeout(r, 300)); // Reduzido para 300ms
    }

    if (!cancelScanRef.current) {
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

  // ============================================
  // FUNÇÕES DE CATEGORIA E STATUS
  // ============================================
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

  function setStatus(endpointName: string, status: string) {
    if (!userId) return;

    setCatalogo(prev => {
      const existing = prev[endpointName];
      if (!existing) return prev;
      const confianca = calcularConfianca(existing.historico, status);
      const maturidade = calcularMaturidade(existing.historico, status, existing.parametros || []);
      const novo = { ...prev, [endpointName]: { ...existing, status: status as any, confianca, maturidade } };
      
      saveEndpoint(endpointName, novo[endpointName], userId!).catch(err => 
        console.error('Erro ao salvar status:', err)
      );
      
      if (analysis && analysis.endpoint === endpointName) {
        setAnalysis(prev => prev ? { ...prev, status: status as any, confianca, maturidade } : null);
      }
      return novo;
    });
  }

  function setMaturidade(endpointName: string, maturidade: string) {
    if (!userId) return;

    setCatalogo(prev => {
      const existing = prev[endpointName];
      if (!existing) return prev;
      const novo = { ...prev, [endpointName]: { ...existing, maturidade: maturidade as any } };
      
      saveEndpoint(endpointName, novo[endpointName], userId!).catch(err => 
        console.error('Erro ao salvar maturidade:', err)
      );
      
      if (analysis && analysis.endpoint === endpointName) {
        setAnalysis(prev => prev ? { ...prev, maturidade: maturidade as any } : null);
      }
      return novo;
    });
  }

  function setObservacao(endpointName: string, observacao: string) {
    if (!userId) return;

    setCatalogo(prev => {
      const existing = prev[endpointName];
      if (!existing) return prev;
      const novo = { ...prev, [endpointName]: { ...existing, observacoes: observacao } };
      
      saveEndpoint(endpointName, novo[endpointName], userId!).catch(err => 
        console.error('Erro ao salvar observação:', err)
      );
      
      if (analysis && analysis.endpoint === endpointName) {
        setAnalysis(prev => prev ? { ...prev, observacoes: observacao } : null);
      }
      return novo;
    });
  }

  function setUtilidade(endpointName: string, utilidade: 1 | 2 | 3 | 4 | 5) {
    if (!userId) return;

    setCatalogo(prev => {
      const existing = prev[endpointName];
      if (!existing) return prev;
      const novo = { ...prev, [endpointName]: { ...existing, utilidade } };
      
      saveEndpoint(endpointName, novo[endpointName], userId!).catch(err => 
        console.error('Erro ao salvar utilidade:', err)
      );
      
      if (analysis && analysis.endpoint === endpointName) {
        setAnalysis(prev => prev ? { ...prev, utilidade } : null);
      }
      return novo;
    });
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

  // ============================================
  // EXPORTAÇÃO E DOCUMENTAÇÃO
  // ============================================
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
      const categoria = categorias[ep] || '📋 Geral';
      const status = info.status || '🔍 Pendente';
      const maturidade = info.maturidade || 'descoberto';
      const utilidade = info.utilidade ? `${'★'.repeat(info.utilidade)}${'☆'.repeat(5 - info.utilidade)}` : 'Não avaliado';
      const confianca = info.confianca || 0;

      const labels: Record<string, string> = {
        descoberto: '🔍 Descoberto',
        parcial: '⚠️ Parcial',
        completo: '✅ Completo',
        instavel: '🔄 Instável',
        descontinuado: '🚫 Descontinuado'
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

    if (confirm('Tem certeza que deseja limpar toda a Knowledge Base?')) {
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

  // ============================================
  // FUNÇÕES AUXILIARES (Copiar, Baixar)
  // ============================================
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

  // ============================================
  // ESTATÍSTICAS (useMemo)
  // ============================================
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
        parametros: info.parametros?.length || 0,
        confianca: info.confianca || 0,
        maturidade: info.maturidade || 'descoberto'
      }))
      .sort((a, b) => b.campos - a.campos);

    const camposPorCategoria: Record<string, number> = {};
    Object.entries(categorias).forEach(([endpoint, categoria]) => {
      if (!camposPorCategoria[categoria]) {
        camposPorCategoria[categoria] = 0;
      }
      camposPorCategoria[categoria] += catalogo[endpoint]?.campos?.length || 0;
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

  // ============================================
  // COMPARAÇÃO DE ENDPOINTS
  // ============================================
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

  // ============================================
  // CAMPOS FILTRADOS
  // ============================================
  const camposFiltrados = useMemo(() => {
    if (!analysis?.campos) return [];
    if (!buscaCampos) return analysis.campos;
    return analysis.campos.filter(campo =>
      campo.toLowerCase().includes(buscaCampos.toLowerCase())
    );
  }, [analysis?.campos, buscaCampos]);

  // ============================================
  // UI: MATURIDADE LABELS
  // ============================================
  const maturidadeLabels: Record<string, { label: string; color: string }> = {
    descoberto: { label: '🔍 Descoberto', color: 'bg-gray-500/20 text-gray-300' },
    parcial: { label: '⚠️ Parcial', color: 'bg-yellow-500/20 text-yellow-300' },
    completo: { label: '✅ Completo', color: 'bg-green-500/20 text-green-300' },
    instavel: { label: '🔄 Instável', color: 'bg-orange-500/20 text-orange-300' },
    descontinuado: { label: '🚫 Descontinuado', color: 'bg-red-500/20 text-red-300' },
  };

  const isAuthenticated = !!userId;
  const isReady = !isLoadingAuth && !isLoadingCatalog && !isGlobalLoading;

  // ============================================
  // RENDER
  // ============================================
  if (isLoadingAuth || isLoadingCatalog || isGlobalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">
            {isLoadingAuth ? 'Autenticando...' : 
             isLoadingCatalog ? 'Carregando catálogo...' : 
             'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  const progressPercent = scanProgress.total > 0
    ? (scanProgress.current / scanProgress.total) * 100
    : 0;

  // ============================================
  // AGRUPAR ENDPOINTS POR CATEGORIA
  // ============================================
  const endpointsPorCategoria: Record<string, string[]> = {};
  endpoints.forEach(ep => {
    const cat = autoCategorizar(ep) || '📋 Geral';
    if (!endpointsPorCategoria[cat]) {
      endpointsPorCategoria[cat] = [];
    }
    endpointsPorCategoria[cat].push(ep);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ==========================================
          HEADER
          ========================================== */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-white">
            🧪 GPRO API Knowledge Base
          </h1>
          <p className="text-slate-400 mt-1">
            Explore, analise e catalogue a estrutura da API GPRO
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
            ⚡ Explorer V2
          </span>
          <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
            {endpoints.length} endpoints
          </span>
          {isAuthenticated && (
            <span className="text-xs px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">
              ✅ Autenticado
            </span>
          )}
          {Object.keys(catalogo).length > 0 && (
            <span className="text-xs px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              📚 {Object.keys(catalogo).length} mapeados
            </span>
          )}
        </div>
      </div>

      {/* ==========================================
          STATUS DO TOKEN
          ========================================== */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-sm text-slate-300">
            {isAuthenticated
              ? '🔑 Token GPRO carregado automaticamente da sua conta'
              : '❌ Usuário não autenticado'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {isAuthenticated
            ? 'O token é obtido automaticamente do seu perfil. Para alterar, vá em Integração GPRO.'
            : 'Faça login para acessar a Knowledge Base.'}
        </p>
      </div>

      {/* ==========================================
          CONTROLES PRINCIPAIS
          ========================================== */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm space-y-3">
        <div className="flex gap-2 flex-wrap">
          <select
            className="flex-1 min-w-[150px] bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
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
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 font-medium"
            disabled={loading || scanning || !isAuthenticated}
          >
            {loading ? '⏳ Executando...' : '▶️ Executar'}
          </button>

          <button
            onClick={scanAllEndpoints}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 font-medium"
            disabled={scanning || loading || !isAuthenticated}
          >
            {scanning ? `⏳ ${scanProgress.current}/${scanProgress.total}` : '🔍 Scan Todos'}
          </button>

          {scanning && (
            <button
              onClick={cancelarScan}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ⛔ Cancelar
            </button>
          )}

          <button
            onClick={limparResposta}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            disabled={!response && !error}
          >
            ✕ Limpar
          </button>
        </div>

        {/* Parâmetros */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={hasParams}
              onChange={(e) => setHasParams(e.target.checked)}
              className="accent-cyan-500"
              disabled={!isAuthenticated}
            />
            Parâmetros
          </label>
          {hasParams && (
            <div className="flex gap-2 flex-1">
              <input
                className="flex-1 min-w-[100px] bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="Ex: driverId"
                value={paramKey}
                onChange={(e) => setParamKey(e.target.value)}
                disabled={!isAuthenticated}
              />
              <input
                className="flex-1 min-w-[100px] bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                placeholder="Valor"
                value={paramValue}
                onChange={(e) => setParamValue(e.target.value)}
                disabled={!isAuthenticated}
              />
              {detectedParams.length > 0 && (
                <span className="text-xs text-yellow-400 flex items-center">
                  ⚠️ Parâmetros sugeridos: {detectedParams.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          BOTÕES DE AÇÃO
          ========================================== */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copiarJSON}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={!response || loading}
        >
          📋 Copiar JSON
        </button>
        <button
          onClick={baixarJSON}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={!response || loading}
        >
          💾 Baixar JSON
        </button>
        <button
          onClick={copiarCampos}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={!analysis || loading}
        >
          📋 Copiar Campos
        </button>
        <button
          onClick={exportarCatalogo}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={Object.keys(catalogo).length === 0 || scanning}
        >
          📦 Exportar KB
        </button>
        <button
          onClick={gerarDocumentacao}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={Object.keys(catalogo).length === 0 || scanning}
        >
          📄 Gerar Docs
        </button>
        <button
          onClick={limparKnowledgeBase}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={Object.keys(catalogo).length === 0}
        >
          🗑️ Limpar KB
        </button>
      </div>

      {/* ==========================================
          ERRO
          ========================================== */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          <p className="font-medium">❌ {error}</p>
        </div>
      )}

      {/* ==========================================
          SCAN PROGRESS
          ========================================== */}
      {scanning && (
        <div className="border border-yellow-500/20 rounded-xl p-4 bg-yellow-500/10 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-yellow-300">Scaneando: {scanProgress.currentEndpoint}</span>
                <span className="text-yellow-300">{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div className="w-full bg-black/50 h-2 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SCAN LOG (atualizado em tempo real)
          ========================================== */}
      {scanLog.length > 0 && (
        <div className="border border-white/10 rounded-xl p-4 bg-black/30 backdrop-blur-sm max-h-60 overflow-y-auto">
          <strong className="block mb-2 text-slate-300">
            📋 Log do Scan: {scanning ? '🔄 Em andamento...' : '✅ Concluído'}
          </strong>
          {scanLog.map((log, index) => (
            <div key={index} className="text-sm font-mono text-slate-400">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* ==========================================
          ESTATÍSTICAS
          ========================================== */}
      {Object.keys(catalogo).length > 0 && (
        <div className="border border-blue-500/20 rounded-xl p-6 bg-blue-500/10 backdrop-blur-sm">
          <h2 className="font-bold text-lg text-white">📊 ESTATÍSTICAS DO KNOWLEDGE BASE</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div>
              <span className="text-slate-400 text-sm">Endpoints mapeados</span>
              <div className="text-2xl font-bold text-white">{estatisticas.totalEndpoints}</div>
            </div>
            <div>
              <span className="text-slate-400 text-sm">Campos únicos</span>
              <div className="text-2xl font-bold text-white">{estatisticas.totalCampos}</div>
            </div>
            <div>
              <span className="text-slate-400 text-sm">Maior endpoint</span>
              <div className="text-sm text-cyan-400">
                {estatisticas.maiorEndpoint.nome} ({estatisticas.maiorEndpoint.campos} campos)
              </div>
            </div>
            <div>
              <span className="text-slate-400 text-sm">Menor endpoint</span>
              <div className="text-sm text-cyan-400">
                {estatisticas.menorEndpoint.nome} ({estatisticas.menorEndpoint.campos} campos)
              </div>
            </div>
          </div>

          {Object.keys(estatisticas.camposPorCategoria).length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-white">📂 Campos por Categoria</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {Object.entries(estatisticas.camposPorCategoria).map(([categoria, total]) => (
                  <div key={categoria} className="text-sm text-slate-300">
                    <span className="text-cyan-400">{categoria}:</span> {total} campos
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(estatisticas.endpointsPorStatus).length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-white">📌 Status dos Endpoints</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                {Object.entries(estatisticas.endpointsPorStatus).map(([status, total]) => (
                  <div key={status} className="text-sm text-slate-300">
                    <span className="text-cyan-400">{status}:</span> {total}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(estatisticas.endpointsPorMaturidade).length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-white">🧬 Maturidade dos Endpoints</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {Object.entries(estatisticas.endpointsPorMaturidade).map(([maturidade, total]) => {
                  const labels: Record<string, string> = {
                    descoberto: '🔍 Descoberto',
                    parcial: '⚠️ Parcial',
                    completo: '✅ Completo',
                    instavel: '🔄 Instável',
                    descontinuado: '🚫 Descontinuado'
                  };
                  return (
                    <div key={maturidade} className="text-sm text-slate-300">
                      <span className="text-cyan-400">{labels[maturidade] || maturidade}:</span> {total}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {estatisticas.ranking.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-white">🏆 TOP ENDPOINTS</h3>
              <ol className="list-decimal pl-5 mt-1">
                {estatisticas.ranking.slice(0, 5).map((item, index) => {
                  const labels: Record<string, string> = {
                    descoberto: '🔍',
                    parcial: '⚠️',
                    completo: '✅',
                    instavel: '🔄',
                    descontinuado: '🚫'
                  };
                  return (
                    <li key={item.nome} className="text-sm text-slate-300">
                      <span className="text-cyan-400">{item.nome}</span> - {item.campos} campos
                      {item.parametros > 0 && ` (${item.parametros} params)`}
                      {item.confianca > 0 && ` | conf: ${item.confianca}%`}
                      {item.maturidade && ` | ${labels[item.maturidade] || ''}`}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          COMPARADOR DE ENDPOINTS
          ========================================== */}
      {Object.keys(catalogo).length >= 2 && (
        <div className="border border-white/10 rounded-xl p-6 bg-white/5 backdrop-blur-sm">
          <h2 className="font-bold text-lg text-white">🔄 COMPARADOR DE ENDPOINTS</h2>
          <div className="flex gap-4 mt-2 flex-wrap">
            <select
              className="border border-white/10 rounded-lg px-4 py-2 bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
              value={compareEndpoint1}
              onChange={(e) => setCompareEndpoint1(e.target.value)}
            >
              <option value="">Selecione endpoint 1</option>
              {Object.keys(catalogo).map((ep) => (
                <option key={ep} value={ep}>{ep} {categorias[ep] ? categorias[ep] : ''}</option>
              ))}
            </select>
            <select
              className="border border-white/10 rounded-lg px-4 py-2 bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
              value={compareEndpoint2}
              onChange={(e) => setCompareEndpoint2(e.target.value)}
            >
              <option value="">Selecione endpoint 2</option>
              {Object.keys(catalogo).map((ep) => (
                <option key={ep} value={ep}>{ep} {categorias[ep] ? categorias[ep] : ''}</option>
              ))}
            </select>
          </div>

          {comparacao && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-green-500/20 rounded-lg p-3 bg-green-500/10">
                  <span className="text-slate-400 text-sm">Em comum</span>
                  <div className="text-2xl font-bold text-green-400">{comparacao.totalComum}</div>
                </div>
                <div className="border border-blue-500/20 rounded-lg p-3 bg-blue-500/10">
                  <span className="text-slate-400 text-sm">Somente {compareEndpoint1}</span>
                  <div className="text-2xl font-bold text-blue-400">{comparacao.totalSomente1}</div>
                </div>
                <div className="border border-orange-500/20 rounded-lg p-3 bg-orange-500/10">
                  <span className="text-slate-400 text-sm">Somente {compareEndpoint2}</span>
                  <div className="text-2xl font-bold text-orange-400">{comparacao.totalSomente2}</div>
                </div>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-slate-300 hover:text-white transition-colors">Ver detalhes</summary>
                <div className="grid grid-cols-3 gap-4 mt-2 max-h-60 overflow-y-auto">
                  <div>
                    <strong className="text-slate-300">Em comum:</strong>
                    <ul className="list-disc pl-4 text-slate-400">
                      {comparacao.emComum.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.emComum.length > 10 && (
                        <li className="text-slate-500">+ {comparacao.emComum.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-slate-300">Somente {compareEndpoint1}:</strong>
                    <ul className="list-disc pl-4 text-slate-400">
                      {comparacao.somente1.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.somente1.length > 10 && (
                        <li className="text-slate-500">+ {comparacao.somente1.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-slate-300">Somente {compareEndpoint2}:</strong>
                    <ul className="list-disc pl-4 text-slate-400">
                      {comparacao.somente2.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.somente2.length > 10 && (
                        <li className="text-slate-500">+ {comparacao.somente2.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          ANÁLISE DO ENDPOINT ATUAL
          ========================================== */}
      {analysis && (
        <div className="border border-white/10 rounded-xl p-6 bg-white/5 backdrop-blur-sm">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-bold text-lg text-white">🔍 ANÁLISE: {analysis.endpoint}</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => toggleFavorito(analysis.endpoint)}
                className="text-2xl"
                title="Favorito"
              >
                {categorias[analysis.endpoint] === '⭐ Favorito' ? '⭐' : '☆'}
              </button>
              <select
                className="border border-white/10 rounded-lg px-2 py-1 text-sm bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
                value={categorias[analysis.endpoint] || '📋 Geral'}
                onChange={(e) => setCategoria(analysis.endpoint, e.target.value as CategoriaEndpoint)}
              >
                {CATEGORIAS_VALIDAS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                className="border border-white/10 rounded-lg px-2 py-1 text-sm bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
                value={analysis.status || '🔍 Pendente'}
                onChange={(e) => setStatus(analysis.endpoint, e.target.value)}
              >
                {STATUS_VALIDOS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                className="border border-white/10 rounded-lg px-2 py-1 text-sm bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
                value={analysis.maturidade || 'descoberto'}
                onChange={(e) => setMaturidade(analysis.endpoint, e.target.value)}
              >
                {MATURIDADE_VALIDA.map(m => {
                  const labels: Record<string, string> = {
                    descoberto: '🔍 Descoberto',
                    parcial: '⚠️ Parcial',
                    completo: '✅ Completo',
                    instavel: '🔄 Instável',
                    descontinuado: '🚫 Descontinuado'
                  };
                  return (
                    <option key={m} value={m}>{labels[m] || m}</option>
                  );
                })}
              </select>
              <select
                className="border border-white/10 rounded-lg px-2 py-1 text-sm bg-black/50 text-white focus:outline-none focus:border-cyan-500/50"
                value={analysis.utilidade || 0}
                onChange={(e) => setUtilidade(analysis.endpoint, Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
              >
                <option value={0}>⭐ Utilidade</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <div><span className="text-slate-400 text-sm">Campos</span><p className="text-white font-bold">{analysis.totalCampos}</p></div>
            <div><span className="text-slate-400 text-sm">Objetos</span><p className="text-white font-bold">{analysis.objetos}</p></div>
            <div><span className="text-slate-400 text-sm">Arrays</span><p className="text-white font-bold">{analysis.arrays}</p></div>
            <div><span className="text-slate-400 text-sm">Status</span><p className="text-yellow-400 font-bold">{analysis.status || '🔍 Pendente'}</p></div>
            <div><span className="text-slate-400 text-sm">Maturidade</span><p className="text-cyan-400 font-bold">{maturidadeLabels[analysis.maturidade || 'descoberto']?.label || '🔍 Descoberto'}</p></div>
            <div><span className="text-slate-400 text-sm">Confiança</span><p className="text-white font-bold">{analysis.confianca || 0}%</p></div>
            <div><span className="text-slate-400 text-sm">Scans</span><p className="text-white font-bold">{analysis.scansRealizados || 0}</p></div>
            <div><span className="text-slate-400 text-sm">Hash</span><p className="font-mono text-xs text-cyan-400">{analysis.ultimoHash || 'N/A'}</p></div>
            {analysis.parametros && analysis.parametros.length > 0 && (
              <div className="col-span-2 md:col-span-4">
                <span className="text-slate-400 text-sm">Parâmetros requeridos</span>
                <p className="text-yellow-400 font-medium">{analysis.parametros.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Busca de Campos */}
          <div className="mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">Campos detectados ({analysis.campos.length})</span>
              <input
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-48"
                placeholder="Buscar campo..."
                value={buscaCampos}
                onChange={(e) => setBuscaCampos(e.target.value)}
              />
            </div>
            <ul className="list-disc pl-5 mt-1 max-h-40 overflow-y-auto text-slate-300">
              {camposFiltrados.slice(0, 30).map((campo: string) => (
                <li key={campo} className="text-sm">
                  <span className="font-medium text-white">{campo}</span>
                  <span className="text-slate-500 text-xs ml-2">
                    ({analysis.tipos?.[campo] || 'desconhecido'})
                  </span>
                </li>
              ))}
              {camposFiltrados.length > 30 && (
                <li className="text-slate-500">... e mais {camposFiltrados.length - 30} campos</li>
              )}
              {buscaCampos && camposFiltrados.length === 0 && (
                <li className="text-slate-500">Nenhum campo encontrado</li>
              )}
            </ul>
          </div>

          {/* Observações */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-300">Observações</span>
              {observacaoEditando === analysis.endpoint ? (
                <div className="flex-1 flex gap-2">
                  <input
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    value={analysis.observacoes || ''}
                    onChange={(e) => setObservacao(analysis.endpoint, e.target.value)}
                    placeholder="Adicione observações sobre este endpoint..."
                  />
                  <button
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
                    onClick={() => setObservacaoEditando(null)}
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {analysis.observacoes || 'Clique para adicionar observações'}
                  </span>
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={() => setObservacaoEditando(analysis.endpoint)}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Histórico - CORRIGIDO */}
          {analysis.historico && analysis.historico.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-sm text-slate-300 hover:text-white transition-colors">
                📜 Histórico de Descoberta ({analysis.historico.length} registros)
              </summary>
              <div className="text-xs mt-2 p-3 bg-black/50 border border-white/10 rounded-lg max-h-40 overflow-y-auto">
                {analysis.historico.map((h, idx) => (
                  <div key={idx} className="font-mono text-slate-300">
                    {new Date(h.data).toLocaleString()}: {h.campos} campos
                    {h.hash && ` [${h.hash}]`}
                    {idx > 0 && h.hash !== analysis.historico?.[idx - 1]?.hash && (
                      <span className="text-yellow-400 ml-2">⚠️ schema mudou</span>
                    )}
                  </div>
                ))}
                {analysis.historico.length === 50 && (
                  <div className="text-slate-500 italic mt-1">(últimos 50 registros)</div>
                )}
              </div>
            </details>
          )}

          {/* Schema */}
          {analysis.tipos && (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-sm text-slate-300 hover:text-white transition-colors">
                📑 Ver Schema
              </summary>
              <pre className="text-xs mt-2 p-3 bg-black/50 border border-white/10 rounded-lg overflow-auto max-h-40 text-slate-300 font-mono">
                {JSON.stringify(analysis.tipos, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ==========================================
          KNOWLEDGE BASE - MAPA DA API
          ========================================== */}
      {Object.keys(catalogo).length > 0 && (
        <div className="border border-green-500/20 rounded-xl p-6 bg-green-500/10 backdrop-blur-sm">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-bold text-lg text-white">🧠 KNOWLEDGE BASE - MAPA DA API</h2>
            <div className="space-x-2 text-sm">
              <button
                onClick={gerarDocumentacao}
                className="text-teal-400 hover:text-teal-300 transition-colors hover:underline"
              >
                📄 Gerar Docs
              </button>
              <button
                onClick={exportarCatalogo}
                className="text-orange-400 hover:text-orange-300 transition-colors hover:underline"
              >
                📦 Exportar KB
              </button>
              <button
                onClick={limparKnowledgeBase}
                className="text-red-400 hover:text-red-300 transition-colors hover:underline"
              >
                🗑️ Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto mt-2">
            {Object.entries(catalogo)
              .sort((a, b) => {
                const catA = categorias[a[0]] || '📋 Geral';
                const catB = categorias[b[0]] || '📋 Geral';
                return catA.localeCompare(catB);
              })
              .map(([endpointName, info]) => {
                const categoria = categorias[endpointName] || '📋 Geral';
                const isExpanded = expandedEndpoints.has(endpointName);
                const isFavorito = categoria === '⭐ Favorito';
                const status = info.status || '🔍 Pendente';
                const maturidade = info.maturidade || 'descoberto';
                const utilidade = info.utilidade || 0;
                const confianca = info.confianca || 0;

                const maturidadeLabelsLocal: Record<string, { label: string; color: string }> = {
                  descoberto: { label: '🔍 Descoberto', color: 'bg-gray-500/20 text-gray-300' },
                  parcial: { label: '⚠️ Parcial', color: 'bg-yellow-500/20 text-yellow-300' },
                  completo: { label: '✅ Completo', color: 'bg-green-500/20 text-green-300' },
                  instavel: { label: '🔄 Instável', color: 'bg-orange-500/20 text-orange-300' },
                  descontinuado: { label: '🚫 Descontinuado', color: 'bg-red-500/20 text-red-300' }
                };

                const statusColors: Record<string, string> = {
                  '✔ Validado': 'bg-green-500/20 text-green-300 border-green-500/20',
                  '⚠️ Em análise': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/20',
                  '❌ Inativo': 'bg-red-500/20 text-red-300 border-red-500/20',
                  '🔍 Pendente': 'bg-gray-500/20 text-gray-300 border-gray-500/20',
                };

                return (
                  <div
                    key={endpointName}
                    className={`border rounded-lg p-3 bg-black/30 backdrop-blur-sm transition-colors ${
                      isFavorito ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => toggleExpand(endpointName)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <strong className="text-cyan-400 truncate">{endpointName}</strong>
                          {isFavorito && <span className="text-yellow-400">⭐</span>}
                          {utilidade > 0 && (
                            <span className="text-xs text-yellow-500">
                              {'★'.repeat(utilidade)}{'☆'.repeat(5 - utilidade)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-slate-400">{categoria}</span>
                          <span className={`px-2 py-0.5 rounded-full border ${statusColors[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/20'}`}>
                            {status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border ${maturidadeLabelsLocal[maturidade]?.color || 'bg-gray-500/20 text-gray-300'}`}>
                            {maturidadeLabelsLocal[maturidade]?.label || maturidade}
                          </span>
                          <span className="text-slate-500">{confianca}%</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {info.campos.length} campos
                          {info.parametros && info.parametros.length > 0 &&
                            ` | ${info.parametros.length} params`}
                        </div>
                      </div>
                      <span className="text-slate-500 ml-2">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                    {isExpanded && (
                      <>
                        <ul className="text-xs list-disc pl-4 mt-2 max-h-32 overflow-y-auto text-slate-300">
                          {info.campos.slice(0, 10).map(campo => (
                            <li key={campo} className="text-slate-300">{campo}</li>
                          ))}
                          {info.campos.length > 10 && (
                            <li className="text-slate-500">+ {info.campos.length - 10} mais</li>
                          )}
                          {info.parametros && info.parametros.length > 0 && (
                            <li className="text-yellow-400 mt-1">📌 {info.parametros.join(', ')}</li>
                          )}
                        </ul>
                        {info.observacoes && (
                          <div className="text-xs text-slate-400 mt-2 italic truncate">
                            💭 {info.observacoes}
                          </div>
                        )}
                        {info.historico && info.historico.length > 0 && (
                          <div className="text-xs text-slate-500 mt-1">
                            Último scan: {new Date(info.historico[info.historico.length - 1].data).toLocaleDateString()}
                            {info.historico.length >= 50 && ' (50 regs)'}
                            {info.ultimoHash && ` | hash: ${info.ultimoHash}`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ==========================================
          RESPOSTA JSON
          ========================================== */}
      {response && (
        <div className="border border-white/10 rounded-xl p-6 bg-black/30 backdrop-blur-sm">
          <h3 className="font-bold text-lg text-white mb-3">📄 Resposta JSON</h3>
          <pre className="border border-white/10 rounded-lg p-4 overflow-auto max-h-96 bg-black/50 text-slate-300 text-sm font-mono">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {/* ==========================================
          ESTADO VAZIO
          ========================================== */}
      {!response && !loading && !error && !scanning && (
        <div className="border border-white/10 rounded-xl p-12 bg-white/5 backdrop-blur-sm text-center">
          <div className="text-6xl mb-4">🔬</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAuthenticated ? 'Pronto para explorar a API GPRO' : 'Faça login para acessar'}
          </h2>
          <p className="text-slate-400 max-w-md mx-auto">
            {isAuthenticated
              ? 'Selecione um endpoint e clique em Executar para analisar a estrutura da resposta. Use "Scan Todos" para mapear toda a API de uma vez.'
              : 'Você precisa estar autenticado para usar a Knowledge Base. Faça login no Alfa Racing.'}
          </p>
          {isAuthenticated && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                {endpoints.length} endpoints
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                Análise automática
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                Hash do Schema
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                Token automático
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                Catálogo persistente
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}