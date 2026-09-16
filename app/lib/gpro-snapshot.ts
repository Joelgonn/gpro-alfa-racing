/**
 * Legacy Snapshot Adapter
 *
 * Este componente representa o primeiro Adapter da
 * Knowledge Platform.
 *
 * Nesta fase ele continua preservando exatamente
 * o comportamento legado.
 *
 * Nenhuma lógica de aquisição de conhecimento deve
 * ser implementada aqui.
 */
// app/lib/gpro-snapshot.ts
// ============================================
// ADAPTER LEGADO PARA PERSISTÊNCIA DE SNAPSHOTS
// ============================================

import { createClient } from '@supabase/supabase-js';
import { Capture } from './capture';
import { processCapture } from './observation-pipeline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type GproSnapshotPayload = Capture;

export interface SnapshotResult {
  id: string;
  endpoint: string;
  success: boolean;
  error?: string;
}

// Adapter responsibilities:
// - preserve the raw snapshot envelope as-is;
// - persist the legacy history records;
// - keep Sync behavior unchanged.
//
// Future core responsibilities (not implemented here):
// - Observation creation;
// - fingerprinting;
// - schema analysis;
// - evidence building;
// - reconciliation.

function buildSnapshotRow(data: GproSnapshotPayload) {
  return {
    user_id: data.userId,
    endpoint: data.endpoint,
    season: data.season || null,
    race: data.race || null,
    payload: data.payload,
  };
}

function buildBulkSnapshotRows(snapshots: GproSnapshotPayload[]) {
  return snapshots.map(buildSnapshotRow);
}

function captureObservations(snapshots: GproSnapshotPayload[]) {
  return snapshots.map(snapshot => {
    const observation = processCapture(snapshot);
    // Observation criada apenas para validar o pipeline da nova arquitetura.
    void observation;
    return snapshot;
  });
}

function buildSnapshotResult(
  id: string,
  snapshot: GproSnapshotPayload,
  success: boolean,
  error?: string
): SnapshotResult {
  return {
    id,
    endpoint: snapshot.endpoint,
    success,
    ...(error ? { error } : {}),
  };
}

function logSaveError(endpoint: string, error: unknown) {
  console.error(`Erro ao salvar snapshot ${endpoint}:`, error);
}

function logBulkInsertError(error: unknown) {
  console.error('Erro no bulk insert de snapshots:', error);
}

function logBulkSuccess(count: number) {
  console.log(`✅ ${count} snapshots salvos em bulk`);
}

function logFallbackWarning(message: string) {
  console.warn(`⚠️ ${message}`);
}

async function persistSnapshot(data: GproSnapshotPayload): Promise<string> {
  const { data: result, error } = await supabase
    .from('gpro_import_snapshots')
    .insert(buildSnapshotRow(data))
    .select('id')
    .single();

  if (error) {
    // Adapter: persistence errors stay non-fatal for the Sync path.
    logSaveError(data.endpoint, error);
    throw new Error(`Erro ao salvar snapshot ${data.endpoint}: ${error.message}`);
  }

  return result.id;
}

/**
 * Salva um único snapshot de importação no banco
 * @param data - Dados do snapshot
 * @returns ID do snapshot salvo
 */
export async function saveSnapshot(data: GproSnapshotPayload): Promise<string> {
  const observation = processCapture(data);
  // Observation criada apenas para validar o pipeline da nova arquitetura.
  void observation;
  return persistSnapshot(data);
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

  // Observation nasce uma única vez por Capture, antes da decisão de persistência.
  const processedSnapshots = captureObservations(snapshots);

  // Adapter: prepare the legacy snapshot envelope for persistence.
  const bulkData = buildBulkSnapshotRows(processedSnapshots);

  try {
    // Adapter: legacy bulk insert remains the primary persistence path.
    const { data: results, error } = await supabase
      .from('gpro_import_snapshots')
      .insert(bulkData)
      .select('id');

    if (error) {
      logBulkInsertError(error);
      throw new Error(`Erro ao salvar snapshots: ${error.message}`);
    }

    const finalResults: SnapshotResult[] = results.map((result, index) =>
      buildSnapshotResult(result.id, processedSnapshots[index]!, true)
    );

    logBulkSuccess(finalResults.length);

    return finalResults;

  } catch (error: any) {
    // Adapter: fallback preserves Sync behavior when bulk persistence fails.
    logFallbackWarning(`Bulk insert falhou, tentando inserts individuais: ${error.message}`);

    const fallbackResults: SnapshotResult[] = [];

    for (const snapshot of processedSnapshots) {
      try {
        const id = await persistSnapshot(snapshot);
        fallbackResults.push(buildSnapshotResult(id, snapshot, true));
      } catch (saveError: any) {
        fallbackResults.push(
          buildSnapshotResult(
            '',
            snapshot,
            false,
            saveError.message || 'Erro desconhecido'
          )
        );
      }
    }

    const successCount = fallbackResults.filter(r => r.success).length;
    const failCount = fallbackResults.filter(r => !r.success).length;

    logFallbackWarning(`Fallback: ${successCount} salvos, ${failCount} falhas`);

    return fallbackResults;
  }
}
