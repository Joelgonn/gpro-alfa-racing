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

          try {
            await saveEndpoint(ep, endpointInfo, userId!);
            salvosComSucesso++;
            
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

      setScanLog([...novosLogs]);
      await new Promise(r => setTimeout(r, 300));
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

  const isAuthenticated = !!userId;
  const isReady = !isLoadingAuth && !isLoadingCatalog && !isGlobalLoading;

  if (isLoadingAuth || isLoadingCatalog || isGlobalLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
        <div className="w-12 h-12 border-2 border-emerald-500/10 rounded-full flex items-center justify-center relative">
          <div className="w-12 h-12 border-2 border-t-emerald-600 rounded-full animate-spin absolute" />
          <Loader2 className="animate-spin text-emerald-600 h-8 w-8" />
        </div>
        <p className="text-slate-400 font-bold text-xs uppercase">Carregando API Database...</p>
      </div>
    );
  }

  const progressPercent = scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0;

  const endpointsPorCategoria: Record<string, string[]> = {};
  endpoints.forEach(ep => {
    const cat = autoCategorizar(ep) || '📋 Geral';
    if (!endpointsPorCategoria[cat]) {
      endpointsPorCategoria[cat] = [];
    }
    endpointsPorCategoria[cat].push(ep);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-slate-700 pb-24 relative overflow-hidden">
      
      {/* GLOWS AMBIENTAIS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
      </div>

      {/* HEADER BAR (LIGHT GELO) */}
      <div className="bg-white/90 border border-slate-200 p-4 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center sticky top-4 z-50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.01] blur-2xl rounded-full pointer-events-none" />
        <div className="text-left w-full md:w-auto">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1 flex items-center gap-2">
            GPRO API Database
            <span className="text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">KB</span>
            <Sparkles size={14} className="text-amber-400" />
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Explore, analise e catalogue a estrutura da API GPRO
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-3 py-1 bg-emerald-50 border-emerald-200 text-emerald-600 rounded-full font-black shadow-sm">
            ⚡ Explorer V2
          </span>
          <span className="text-[10px] px-3 py-1 bg-slate-50 border-slate-200 text-slate-600 rounded-full font-black shadow-sm">
            {endpoints.length} endpoints
          </span>
          {isAuthenticated && (
            <span className="text-[10px] px-3 py-1 bg-emerald-50 border-emerald-250 text-emerald-600 rounded-full font-black shadow-sm flex items-center gap-1">
              <Shield size={10} /> Autenticado
            </span>
          )}
          {Object.keys(catalogo).length > 0 && (
            <span className="text-[10px] px-3 py-1 bg-indigo-50 border-indigo-200 text-indigo-600 rounded-full font-black shadow-sm">
              📚 {Object.keys(catalogo).length} mapeados
            </span>
          )}
        </div>
      </div>

      {/* STATUS DO TOKEN */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
          <span className="text-xs text-slate-700 font-bold">
            {isAuthenticated
              ? '🔑 Token GPRO carregado automaticamente da sua conta'
              : '❌ Usuário não autenticado'}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
          {isAuthenticated
            ? 'O token é obtido automaticamente do seu perfil. Para alterar, vá em Integração GPRO.'
            : 'Faça login para acessar a Knowledge Base.'}
        </p>
      </div>

      {/* CONTROLES PRINCIPAIS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 relative z-10">
        <div className="flex gap-2.5 flex-wrap">
          <select
            className="flex-1 min-w-[200px] bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-800 outline-none focus:border-emerald-500 shadow-inner"
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
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all border border-emerald-500 active:scale-[0.98] disabled:opacity-50"
            disabled={loading || scanning || !isAuthenticated}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin h-3 w-3" /> Executando...
              </span>
            ) : (
              '▶️ Executar'
            )}
          </button>

          <button
            onClick={scanAllEndpoints}
            className="bg-[#f8fafc] hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
            disabled={scanning || loading || !isAuthenticated}
          >
            {scanning ? `⏳ ${scanProgress.current}/${scanProgress.total}` : '🔍 Scan Todos'}
          </button>

          {scanning && (
            <button
              onClick={cancelarScan}
              className="bg-rose-50 border border-rose-300 text-rose-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all hover:bg-rose-100"
            >
              ⛔ Cancelar
            </button>
          )}

          <button
            onClick={limparResposta}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 hover:border-slate-300 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
            disabled={!response && !error}
          >
            ✕ Limpar
          </button>
        </div>

        {/* Parâmetros */}
        <div className="flex items-center gap-4 flex-wrap border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
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
                className="flex-1 min-w-[120px] bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 shadow-inner"
                placeholder="Ex: driverId"
                value={paramKey}
                onChange={(e) => setParamKey(e.target.value)}
                disabled={!isAuthenticated}
              />
              <input
                className="flex-1 min-w-[120px] bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 shadow-inner"
                placeholder="Valor"
                value={paramValue}
                onChange={(e) => setParamValue(e.target.value)}
                disabled={!isAuthenticated}
              />
              {detectedParams.length > 0 && (
                <span className="text-[10px] text-amber-600 font-bold flex items-center">
                  ⚠️ Parâmetros sugeridos: {detectedParams.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex flex-wrap gap-2.5 relative z-10">
        <button
          onClick={copiarJSON}
          className="bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={!response || loading}
        >
          📋 Copiar JSON
        </button>
        <button
          onClick={baixarJSON}
          className="bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={!response || loading}
        >
          💾 Baixar JSON
        </button>
        <button
          onClick={copiarCampos}
          className="bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={!analysis || loading}
        >
          📋 Copiar Campos
        </button>
        <button
          onClick={exportarCatalogo}
          className="bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={Object.keys(catalogo).length === 0 || scanning}
        >
          📦 Exportar KB
        </button>
        <button
          onClick={gerarDocumentacao}
          className="bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={Object.keys(catalogo).length === 0 || scanning}
        >
          📄 Gerar Docs
        </button>
        <button
          onClick={limparKnowledgeBase}
          className="bg-rose-50 border border-rose-300 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          disabled={Object.keys(catalogo).length === 0}
        >
          🗑️ Limpar KB
        </button>
      </div>

      {/* ERRO */}
      {error && (
        <div className="bg-rose-50 border border-rose-250 rounded-xl p-4 text-rose-600 relative z-10 font-bold">
          <p className="text-xs">❌ {error}</p>
        </div>
      )}

      {/* SCAN PROGRESS */}
      {scanning && (
        <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 relative z-10 shadow-sm animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs font-black">
                <span className="text-amber-700">Escaneando: {scanProgress.currentEndpoint}</span>
                <span className="text-amber-600">{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 mt-2 rounded-full overflow-hidden border border-slate-300/30">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCAN LOG (atualizado em tempo real) */}
      {scanLog.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm max-h-60 overflow-y-auto relative z-10">
          <strong className="block mb-2 text-xs font-black text-slate-800 uppercase flex items-center gap-2">
            <Database size={14} className="text-emerald-600" />
            📋 Log do Scan: {scanning ? '🔄 Em andamento...' : '✅ Concluído'}
          </strong>
          <div className="space-y-1">
            {scanLog.map((log, index) => (
              <div key={index} className="text-xs font-mono text-slate-500">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ESTATÍSTICAS */}
      {Object.keys(catalogo).length > 0 && (
        <div className="border border-emerald-250 rounded-xl p-6 bg-emerald-50/20 backdrop-blur-sm relative z-10 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={16} className="text-amber-500" />
            <h2 className="font-black text-xs text-emerald-800 uppercase tracking-widest">📊 ESTATÍSTICAS DO KNOWLEDGE BASE</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Endpoints mapeados</span>
              <div className="text-xl font-black text-slate-800">{estatisticas.totalEndpoints}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Campos únicos</span>
              <div className="text-xl font-black text-slate-800">{estatisticas.totalCampos}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Maior endpoint</span>
              <div className="text-xs font-black text-emerald-600 leading-tight">
                {estatisticas.maiorEndpoint.nome} <br/><span className="text-[10px] text-slate-400">({estatisticas.maiorEndpoint.campos} campos)</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-slate-400 text-[10px] font-black uppercase block mb-1">Menor endpoint</span>
              <div className="text-xs font-black text-emerald-600 leading-tight">
                {estatisticas.menorEndpoint.nome} <br/><span className="text-[10px] text-slate-400">({estatisticas.menorEndpoint.campos} campos)</span>
              </div>
            </div>
          </div>

          {Object.keys(estatisticas.camposPorCategoria).length > 0 && (
            <div className="mt-4 pt-3 border-t border-emerald-100">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">📂 Campos por Categoria</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {Object.entries(estatisticas.camposPorCategoria).map(([categoria, total]) => (
                  <div key={categoria} className="text-xs font-bold text-slate-600">
                    <span className="text-emerald-600">{categoria}:</span> {total} campos
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(estatisticas.endpointsPorStatus).length > 0 && (
            <div className="mt-4 pt-3 border-t border-emerald-100">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">📌 Status dos Endpoints</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                {Object.entries(estatisticas.endpointsPorStatus).map(([status, total]) => (
                  <div key={status} className="text-xs font-bold text-slate-600">
                    <span className="text-emerald-600">{status}:</span> {total}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(estatisticas.endpointsPorMaturidade).length > 0 && (
            <div className="mt-4 pt-3 border-t border-emerald-100">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">🧬 Maturidade dos Endpoints</h3>
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
                    <div key={maturidade} className="text-xs font-bold text-slate-600">
                      <span className="text-emerald-600">{labels[maturidade] || maturidade}:</span> {total}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {estatisticas.ranking.length > 0 && (
            <div className="mt-4 pt-3 border-t border-emerald-100">
              <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">🏆 TOP ENDPOINTS</h3>
              <ol className="list-decimal pl-5 mt-1 space-y-0.5">
                {estatisticas.ranking.slice(0, 5).map((item, index) => {
                  const labels: Record<string, string> = {
                    descoberto: '🔍',
                    parcial: '⚠️',
                    completo: '✅',
                    instavel: '🔄',
                    descontinuado: '🚫'
                  };
                  return (
                    <li key={item.nome} className="text-xs font-bold text-slate-600">
                      <span className="text-emerald-600">{item.nome}</span> - {item.campos} campos
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

      {/* COMPARADOR DE ENDPOINTS */}
      {Object.keys(catalogo).length >= 2 && (
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm relative z-10">
          <h2 className="font-black text-xs text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
            <Rocket size={14} className="text-amber-500" />
            🔄 Comparador de Endpoints
          </h2>
          <div className="flex gap-4 mt-4 flex-wrap">
            <select
              className="border border-slate-200 rounded-xl px-4 py-2 bg-[#f8fafc] text-xs font-black text-slate-800 focus:outline-none focus:border-emerald-500 shadow-inner"
              value={compareEndpoint1}
              onChange={(e) => setCompareEndpoint1(e.target.value)}
            >
              <option value="">Selecione endpoint 1</option>
              {Object.keys(catalogo).map((ep) => (
                <option key={ep} value={ep}>{ep} {categorias[ep] ? categorias[ep] : ''}</option>
              ))}
            </select>
            <select
              className="border border-slate-200 rounded-xl px-4 py-2 bg-[#f8fafc] text-xs font-black text-slate-800 focus:outline-none focus:border-emerald-500 shadow-inner"
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
            <div className="mt-4 space-y-3 animate-fadeIn">
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 shadow-sm">
                  <span className="text-slate-400 text-[10px] font-black uppercase">Em comum</span>
                  <div className="text-2xl font-black text-emerald-600">{comparacao.totalComum}</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-[#f8fafc] shadow-sm">
                  <span className="text-slate-400 text-[10px] font-black uppercase">Somente {compareEndpoint1}</span>
                  <div className="text-2xl font-black text-slate-700">{comparacao.totalSomente1}</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-[#f8fafc] shadow-sm">
                  <span className="text-slate-400 text-[10px] font-black uppercase">Somente {compareEndpoint2}</span>
                  <div className="text-2xl font-black text-slate-700">{comparacao.totalSomente2}</div>
                </div>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-1">
                  <ChevronRight size={12} className="text-emerald-500" />
                  Ver detalhes
                </summary>
                <div className="grid grid-cols-3 gap-4 mt-3 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl p-3 shadow-inner">
                  <div>
                    <strong className="text-slate-800 text-[10px] font-black uppercase">Em comum:</strong>
                    <ul className="list-disc pl-4 text-slate-500 mt-1 font-bold space-y-0.5">
                      {comparacao.emComum.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.emComum.length > 10 && (
                        <li className="text-slate-400">+ {comparacao.emComum.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-slate-800 text-[10px] font-black uppercase">Somente {compareEndpoint1}:</strong>
                    <ul className="list-disc pl-4 text-slate-500 mt-1 font-bold space-y-0.5">
                      {comparacao.somente1.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.somente1.length > 10 && (
                        <li className="text-slate-400">+ {comparacao.somente1.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <strong className="text-slate-800 text-[10px] font-black uppercase">Somente {compareEndpoint2}:</strong>
                    <ul className="list-disc pl-4 text-slate-500 mt-1 font-bold space-y-0.5">
                      {comparacao.somente2.slice(0, 10).map(c => (
                        <li key={c}>{c}</li>
                      ))}
                      {comparacao.somente2.length > 10 && (
                        <li className="text-slate-400">+ {comparacao.somente2.length - 10} mais</li>
                      )}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* ANÁLISE DO ENDPOINT ATUAL */}
      {analysis && (
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm relative z-10">
          <div className="flex justify-between items-center flex-wrap gap-2.5 border-b border-slate-200 pb-3">
            <h2 className="font-black text-xs text-slate-800 uppercase flex items-center gap-2">
              <Brain size={14} className="text-amber-500" />
              🔍 ANÁLISE: {analysis.endpoint}
            </h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => toggleFavorito(analysis.endpoint)}
                className="text-2xl active:scale-95 transition-transform"
                title="Favorito"
              >
                {categorias[analysis.endpoint] === '⭐ Favorito' ? '⭐' : '☆'}
              </button>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 bg-[#f8fafc] outline-none shadow-sm focus:border-emerald-500"
                value={categorias[analysis.endpoint] || '📋 Geral'}
                onChange={(e) => setCategoria(analysis.endpoint, e.target.value as CategoriaEndpoint)}
              >
                {CATEGORIAS_VALIDAS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 bg-[#f8fafc] outline-none shadow-sm focus:border-emerald-500"
                value={analysis.status || '🔍 Pendente'}
                onChange={(e) => setStatus(analysis.endpoint, e.target.value)}
              >
                {STATUS_VALIDOS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 bg-[#f8fafc] outline-none shadow-sm focus:border-emerald-500"
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
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-800 bg-[#f8fafc] outline-none shadow-sm focus:border-emerald-500"
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Campos</span>
              <p className="text-slate-800 text-sm font-black">{analysis.totalCampos}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Objetos</span>
              <p className="text-slate-800 text-sm font-black">{analysis.objetos}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Arrays</span>
              <p className="text-slate-800 text-sm font-black">{analysis.arrays}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Status</span>
              <p className="text-emerald-600 text-sm font-black">{analysis.status || '🔍 Pendente'}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Maturidade</span>
              <p className="text-emerald-600 text-sm font-black truncate">{maturidadeLabels[analysis.maturidade || 'descoberto']?.label || '🔍 Descoberto'}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Confiança</span>
              <p className="text-slate-800 text-sm font-black">{analysis.confianca || 0}%</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center">
              <span className="text-slate-400 text-[9px] font-black uppercase">Scans</span>
              <p className="text-slate-800 text-sm font-black">{analysis.scansRealizados || 0}</p>
            </div>
            <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 shadow-inner text-center flex flex-col justify-center">
              <span className="text-slate-400 text-[8px] font-black uppercase mb-0.5">Hash</span>
              <p className="font-mono text-[10px] text-emerald-600 font-bold truncate">{analysis.ultimoHash || 'N/A'}</p>
            </div>
            {analysis.parametros && analysis.parametros.length > 0 && (
              <div className="col-span-2 md:col-span-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <span className="text-amber-700 text-[9px] font-black uppercase">Parâmetros requeridos</span>
                <p className="text-amber-700 font-black text-xs mt-1">{analysis.parametros.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Busca de Campos */}
          <div className="mt-6">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 uppercase">Campos detectados ({analysis.campos.length})</span>
              <input
                className="bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 shadow-inner w-48"
                placeholder="Buscar campo..."
                value={buscaCampos}
                onChange={(e) => setBuscaCampos(e.target.value)}
              />
            </div>
            <ul className="list-disc pl-5 mt-3 max-h-40 overflow-y-auto text-slate-600 font-bold space-y-0.5 bg-slate-50 border border-slate-150 p-3 rounded-xl shadow-inner">
              {camposFiltrados.slice(0, 30).map((campo: string) => (
                <li key={campo} className="text-xs">
                  <span className="font-black text-slate-800">{campo}</span>
                  <span className="text-slate-400 text-[10px] ml-2 font-bold">
                    ({analysis.tipos?.[campo] || 'desconhecido'})
                  </span>
                </li>
              ))}
              {camposFiltrados.length > 30 && (
                <li className="text-slate-400">... e mais {camposFiltrados.length - 30} campos</li>
              )}
              {buscaCampos && camposFiltrados.length === 0 && (
                <li className="text-slate-400">Nenhum campo encontrado</li>
              )}
            </ul>
          </div>

          {/* Observações */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 uppercase">Observações</span>
              {observacaoEditando === analysis.endpoint ? (
                <div className="flex-1 flex gap-2">
                  <input
                    className="flex-1 bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-inner"
                    value={analysis.observacoes || ''}
                    onChange={(e) => setObservacao(analysis.endpoint, e.target.value)}
                    placeholder="Adicione observações sobre este endpoint..."
                  />
                  <button
                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg transition-colors font-black uppercase shadow-sm"
                    onClick={() => setObservacaoEditando(null)}
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">
                    {analysis.observacoes || 'Clique para adicionar observações'}
                  </span>
                  <button
                    className="text-xs text-emerald-600 hover:text-emerald-500 transition-colors"
                    onClick={() => setObservacaoEditando(analysis.endpoint)}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Histórico */}
          {analysis.historico && analysis.historico.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-bold text-xs text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1">
                <ChevronRight size={12} className="text-emerald-500" />
                📜 Histórico de Descoberta ({analysis.historico.length} registros)
              </summary>
              <div className="text-[10px] mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {analysis.historico.map((h, idx) => (
                  <div key={idx} className="font-mono text-slate-600 font-bold leading-normal">
                    {new Date(h.data).toLocaleString()}: {h.campos} campos
                    {h.hash && ` [${h.hash}]`}
                    {idx > 0 && h.hash !== analysis.historico?.[idx - 1]?.hash && (
                      <span className="text-amber-500 ml-2 font-black">⚠️ schema mudou</span>
                    )}
                  </div>
                ))}
                {analysis.historico.length === 50 && (
                  <div className="text-slate-400 italic mt-1 font-bold">(últimos 50 registros)</div>
                )}
              </div>
            </details>
          )}

          {/* Schema */}
          {analysis.tipos && (
            <details className="mt-4">
              <summary className="cursor-pointer font-bold text-sm text-slate-700 hover:text-slate-800 transition-colors flex items-center gap-1">
                <ChevronRight size={12} className="text-emerald-500" />
                📑 Ver Schema
              </summary>
              <pre className="text-[11px] mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-auto max-h-40 text-slate-700 font-mono font-bold leading-relaxed shadow-inner">
                {JSON.stringify(analysis.tipos, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* KNOWLEDGE BASE CATALOGUE - LIGHT GELO */}
      {Object.keys(catalogo).length > 0 && (
        <section className="relative bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm z-10">
          <div className="bg-zinc-50 p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Database size={14} className="text-emerald-600 animate-pulse" />
              Catálogo API GPRO
            </h2>
            <div className="flex gap-2.5">
              <button onClick={gerarDocumentacao} className="text-[9px] font-black text-slate-500 uppercase hover:text-emerald-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-sm">Gerar .MD</button>
              <button onClick={exportarCatalogo} className="text-[9px] font-black text-slate-500 uppercase hover:text-emerald-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-sm">Exportar .JSON</button>
              <button onClick={limparKnowledgeBase} className="text-[9px] font-black text-slate-500 uppercase hover:text-rose-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-sm">Limpar Catálogo</button>
            </div>
          </div>

          <div className="p-4 md:p-6 bg-white space-y-4">
            {/* Barra de Progresso do Scan se estiver rodando */}
            {scanning && (
              <div className="border border-amber-250 rounded-xl p-4 bg-amber-50 shadow-sm animate-pulse mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-amber-700">Scan Completo: {scanProgress.currentEndpoint}</span>
                      <span className="text-amber-600">{scanProgress.current}/{scanProgress.total}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 mt-2 rounded-full overflow-hidden border border-slate-300/30">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de endpoints mapeados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-white max-h-96 overflow-y-auto custom-scrollbar p-1">
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

                  const statusColors: Record<string, string> = {
                    '✔ Validado': 'bg-emerald-50 text-emerald-700 border-emerald-250',
                    '⚠️ Em análise': 'bg-amber-50 text-amber-700 border-amber-250',
                    '❌ Inativo': 'bg-rose-50 text-rose-700 border-rose-250',
                    '🔍 Pendente': 'bg-slate-50 text-slate-700 border-slate-250',
                  };

                  return (
                    <div
                      key={endpointName}
                      className={`border rounded-xl p-3.5 transition-colors shadow-sm bg-white ${
                        isFavorito ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleExpand(endpointName)}>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-xs font-black text-slate-800 truncate">{endpointName}</strong>
                            {isFavorito && <span className="text-amber-500">⭐</span>}
                            {utilidade > 0 && (
                              <span className="text-[10px] text-amber-500">
                                {'★'.repeat(utilidade)}{'☆'.repeat(5 - utilidade)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] flex-wrap mt-1">
                            <span className="text-slate-400 font-bold">{categoria}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black ${statusColors[status] || 'bg-slate-50 text-slate-700 border-slate-250'}`}>
                              {status}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black ${maturidadeLabels[maturidade]?.color || 'bg-slate-50 text-slate-600'}`}>
                              {maturidadeLabels[maturidade]?.label || maturidade}
                            </span>
                            <span className="text-slate-400 font-bold">{confianca}%</span>
                          </div>
                        </div>
                        <span className="text-slate-400 text-xs ml-2">{isExpanded ? '▼' : '▶'}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 animate-fadeIn text-left">
                          <ul className="text-[10px] font-bold list-disc pl-4 text-slate-500 max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
                            {info.campos.slice(0, 10).map(campo => (
                              <li key={campo} className="text-slate-600">{campo}</li>
                            ))}
                            {info.campos.length > 10 && (
                              <li className="text-slate-400 font-bold">+ {info.campos.length - 10} mais</li>
                            )}
                            {info.parametros && info.parametros.length > 0 && (
                              <li className="text-amber-600 mt-1 list-none font-black">📌 {info.parametros.join(', ')}</li>
                            )}
                          </ul>
                          {info.observacoes && (
                            <div className="text-[10px] text-slate-500 mt-2 italic font-bold truncate">
                              💭 {info.observacoes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* RESPOSTA JSON */}
      {response && (
        <div className="border border-slate-200 rounded-[2rem] p-6 bg-white shadow-sm relative z-10 text-left">
          <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-emerald-500" />
            📄 Resposta JSON
          </h3>
          <pre className="border border-slate-200 rounded-xl p-4 overflow-auto max-h-96 bg-[#0f0f13] text-slate-300 text-xs font-mono font-bold leading-relaxed shadow-inner">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {/* ESTADO VAZIO */}
      {!response && !loading && !error && !scanning && (
        <div className="border border-slate-200 rounded-[2rem] p-12 bg-white text-center shadow-sm relative z-10">
          <div className="text-6xl mb-4">🔬</div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider mb-2">
            {isAuthenticated ? 'Pronto para explorar a API GPRO' : 'Faça login para acessar'}
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider max-w-md mx-auto leading-relaxed">
            {isAuthenticated
              ? 'Selecione um endpoint e clique em Executar para analisar a estrutura da resposta. Use "Scan Todos" para mapear toda a API de uma vez.'
              : 'Você precisa estar autenticado para usar a Knowledge Base. Faça login no Alfa Racing.'}
          </p>
        </div>
      )}

    </div>
  );
}