// app/lib/gpro-snapshot.ts
// ============================================
// HELPERS PARA SALVAR SNAPSHOTS DE IMPORTAÇÃO
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GproSnapshotPayload {
  userId: string;
  endpoint: string;
  payload: any;
  season?: number;
  race?: number;
}

export interface SnapshotResult {
  id: string;
  endpoint: string;
  success: boolean;
  error?: string;
}

/**
 * Salva um único snapshot de importação no banco
 * @param data - Dados do snapshot
 * @returns ID do snapshot salvo
 */
export async function saveSnapshot(data: GproSnapshotPayload): Promise<string> {
  const { data: result, error } = await supabase
    .from('gpro_import_snapshots')
    .insert({
      user_id: data.userId,
      endpoint: data.endpoint,
      season: data.season || null,
      race: data.race || null,
      payload: data.payload,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Erro ao salvar snapshot ${data.endpoint}:`, error);
    throw new Error(`Erro ao salvar snapshot ${data.endpoint}: ${error.message}`);
  }

  return result.id;
}

/**
 * Salva múltiplos snapshots em BULK (uma única requisição)
 * MUITO mais rápido que inserts individuais
 * @param snapshots - Array de dados dos snapshots
 * @returns Array com os resultados de cada snapshot
 */
export async function saveSnapshots(
  snapshots: GproSnapshotPayload[]
): Promise<SnapshotResult[]> {
  if (snapshots.length === 0) {
    return [];
  }

  // Prepara os dados para o bulk insert
  const bulkData = snapshots.map(s => ({
    user_id: s.userId,
    endpoint: s.endpoint,
    season: s.season || null,
    race: s.race || null,
    payload: s.payload,
  }));

  try {
    // ✅ BULK INSERT - uma única requisição para todos os snapshots
    const { data: results, error } = await supabase
      .from('gpro_import_snapshots')
      .insert(bulkData)
      .select('id');

    if (error) {
      console.error('Erro no bulk insert de snapshots:', error);
      throw new Error(`Erro ao salvar snapshots: ${error.message}`);
    }

    // Mapeia os resultados
    const finalResults: SnapshotResult[] = results.map((result, index) => ({
      id: result.id,
      endpoint: snapshots[index]?.endpoint || 'unknown',
      success: true,
    }));

    console.log(`✅ ${finalResults.length} snapshots salvos em bulk`);

    return finalResults;

  } catch (error: any) {
    // Se o bulk insert falhar, tenta inserts individuais como fallback
    console.warn('⚠️ Bulk insert falhou, tentando inserts individuais:', error.message);
    
    const fallbackResults: SnapshotResult[] = [];
    
    for (const snapshot of snapshots) {
      try {
        const id = await saveSnapshot(snapshot);
        fallbackResults.push({
          id,
          endpoint: snapshot.endpoint,
          success: true,
        });
      } catch (saveError: any) {
        fallbackResults.push({
          id: '',
          endpoint: snapshot.endpoint,
          success: false,
          error: saveError.message || 'Erro desconhecido',
        });
      }
    }

    const successCount = fallbackResults.filter(r => r.success).length;
    const failCount = fallbackResults.filter(r => !r.success).length;
    
    console.log(`⚠️ Fallback: ${successCount} salvos, ${failCount} falhas`);
    
    return fallbackResults;
  }
}