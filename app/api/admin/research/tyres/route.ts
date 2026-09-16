import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { requireAdmin, resolveUserId } from '@/app/lib/auth';
import { createCapture, type Capture } from '@/app/lib/capture';
import { createKnowledgeScanSession } from '@/app/lib/knowledge-scan-session';
import { runDiscovery } from '@/app/lib/discovery-service';
import { accumulateKnowledge } from '@/app/lib/knowledge-accumulator';
import { buildResearchVariableCatalog } from '@/app/lib/research/research-variable-catalog';

const supabase = supabaseAdmin;

const TYRE_ENDPOINTS = ['Practice', 'Testing', 'Qualify2', 'TrackProfile', 'UpdateCar'] as const;
const TYRE_SIGNAL_PATHS = ['compound', 'tyreCompound', 'tipo_pneu', 'wear', 'tyreWear', 'tyre_wear', 'desgaste_pneu_percent', 'stint', 'stintName'] as const;

type SnapshotRow = {
  id: string;
  endpoint: string;
  payload: any;
  season: number | null;
  race: number | null;
  created_at: string;
};

async function getUserId(request: NextRequest): Promise<string> {
  const headerUserId = request.headers.get('user-id');
  const adminUser = await requireAdmin();
  if (headerUserId && headerUserId !== adminUser.id) {
    await resolveUserId(headerUserId);
  }
  return adminUser.id;
}

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function deepPick(value: any, keys: string[], depth = 0): any {
  if (!value || typeof value !== 'object' || depth > 4) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepPick(item, keys, depth + 1);
      if (found !== null && found !== undefined && found !== '') return found;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (keys.includes(key)) {
      return nested;
    }
  }

  for (const nested of Object.values(value)) {
    const found = deepPick(nested, keys, depth + 1);
    if (found !== null && found !== undefined && found !== '') return found;
  }

  return null;
}

function pickString(payload: any, keys: string[]): string | null {
  const value = deepPick(payload, keys);
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function pickNumber(payload: any, keys: string[]): number | null {
  const value = deepPick(payload, keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildCapture(userId: string, row: SnapshotRow): Capture {
  return createCapture({
    userId,
    endpoint: row.endpoint,
    source: 'manager_sync',
    payload: row.payload,
    season: row.season ?? undefined,
    race: row.race ?? undefined,
  });
}

function extractTrack(row: SnapshotRow): string | null {
  return firstDefined(
    pickString(row.payload, ['trackName', 'track_name']),
    pickString(row.payload?.track, ['name']),
    pickString(row.payload, ['track'])
  );
}

function extractTemperature(row: SnapshotRow): number | null {
  return firstDefined(
    pickNumber(row.payload, ['temp', 'temperature', 'avg_temp']),
    pickNumber(row.payload, ['q1Temp', 'q2Temp']),
    pickNumber(row.payload?.weather, ['q1Temp', 'q2Temp', 'temp', 'temperature'])
  );
}

function extractWeather(row: SnapshotRow): string | null {
  return firstDefined(
    pickString(row.payload, ['weatherTransl', 'weather', 'q2WeatherTransl']),
    pickString(row.payload?.weather, ['weatherTransl', 'weather', 'q2WeatherTransl'])
  );
}

function extractCompound(row: SnapshotRow): string | null {
  return firstDefined(
    pickString(row.payload, ['compound', 'tyreCompound', 'tipo_pneu', 'selectedCompound']),
    pickString(row.payload, ['pneus_fornecedor'])
  );
}

function extractStint(row: SnapshotRow): string | null {
  return firstDefined(
    pickString(row.payload, ['stint', 'stintName']),
    pickString(row.payload, ['stints']),
    pickString(row.payload, ['laps'])
  );
}

function extractWear(row: SnapshotRow): number | null {
  return firstDefined(
    pickNumber(row.payload, ['wear', 'tyreWear', 'tyre_wear', 'desgaste_pneu_percent'])
  );
}

function buildRows(userId: string, rows: SnapshotRow[]) {
  return rows.map(row => {
    const capture = buildCapture(userId, row);
    const track = extractTrack(row);
    const temperature = extractTemperature(row);
    const weather = extractWeather(row);
    const compound = extractCompound(row);
    const stint = extractStint(row);
    const wear = extractWear(row);

    return {
      id: row.id,
      season: row.season,
      race: row.race,
      track,
      temperature,
      weather,
      compound,
      stint,
      wear,
      source: 'manager_sync',
      endpoint: capture.endpoint,
      updatedAt: row.created_at,
      payloadKeys: row.payload && typeof row.payload === 'object' ? Object.keys(row.payload) : [],
      hasTyreSignal: Boolean(track || temperature !== null || weather || compound || stint || wear !== null),
    };
  });
}

function buildTrackExplorer(rows: ReturnType<typeof buildRows>) {
  const map = new Map<string, {
    name: string;
    observationCount: number;
    temperatures: number[];
    compounds: Set<string>;
    races: Set<string>;
  }>();

  for (const row of rows) {
    if (!row.track) continue;
    const existing = map.get(row.track) ?? {
      name: row.track,
      observationCount: 0,
      temperatures: [],
      compounds: new Set<string>(),
      races: new Set<string>(),
    };

    existing.observationCount += 1;
    if (row.temperature !== null && row.temperature !== undefined) {
      existing.temperatures.push(row.temperature);
    }
    if (row.compound) existing.compounds.add(row.compound);
    if (row.season !== null && row.race !== null) {
      existing.races.add(`${row.season}-${row.race}`);
    }

    map.set(row.track, existing);
  }

  return Array.from(map.values())
    .map(track => ({
      name: track.name,
      observationCount: track.observationCount,
      minTemperature: track.temperatures.length ? Math.min(...track.temperatures) : null,
      maxTemperature: track.temperatures.length ? Math.max(...track.temperatures) : null,
      compoundCount: track.compounds.size,
      raceCount: track.races.size,
    }))
    .sort((a, b) => b.observationCount - a.observationCount || a.name.localeCompare(b.name));
}

function getPathValue(value: any, path: string): unknown {
  return path.split('.').reduce((current, key) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined), value as any);
}

function collectPaths(value: any, prefix = '', audit = new Map<string, { path: string; count: number; types: Set<string> }>()) {
  const pathKey = prefix || '<root>';
  const current = audit.get(pathKey) ?? { path: pathKey, count: 0, types: new Set<string>() };
  current.count += 1;
  current.types.add(value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
  audit.set(pathKey, current);
  if (Array.isArray(value)) for (const item of value) collectPaths(item, prefix, audit);
  else if (value && typeof value === 'object') for (const [key, nested] of Object.entries(value)) collectPaths(nested, prefix ? `${prefix}.${key}` : key, audit);
  return audit;
}

function buildAuditSummary(rows: SnapshotRow[]) {
  const pathMap = new Map<string, { path: string; count: number; types: Set<string> }>();
  const signalEndpoints = new Map<string, Set<string>>();
  const endpointsWithSignals = new Set<string>();

  for (const row of rows) {
    const paths = collectPaths(row.payload);
    for (const [path, audit] of paths.entries()) {
      const existing = pathMap.get(path) ?? { path, count: 0, types: new Set<string>() };
      existing.count += 1;
      for (const type of audit.types) existing.types.add(type);
      pathMap.set(path, existing);
    }
    const hasSignal = TYRE_SIGNAL_PATHS.some(signalPath => getPathValue(row.payload, signalPath) !== undefined);
    if (hasSignal) endpointsWithSignals.add(row.endpoint);
    for (const signalPath of TYRE_SIGNAL_PATHS) {
      if (getPathValue(row.payload, signalPath) !== undefined) {
        const existing = signalEndpoints.get(signalPath) ?? new Set<string>();
        existing.add(row.endpoint);
        signalEndpoints.set(signalPath, existing);
      }
    }
  }

  const totalSnapshots = rows.length;
  const fieldAudit = Array.from(pathMap.values()).filter(field => field.path !== '<root>').map(field => ({ path: field.path, count: field.count, coverage: totalSnapshots ? Math.round((field.count / totalSnapshots) * 100) : 0, sampleType: Array.from(field.types)[0] ?? 'unknown' })).sort((a, b) => b.coverage - a.coverage || b.count - a.count || a.path.localeCompare(b.path));
  return { totalSnapshots, uniquePaths: fieldAudit.length, fieldsIn100Percent: fieldAudit.filter(field => field.coverage === 100).map(field => field.path), fieldAudit, tyreSignals: TYRE_SIGNAL_PATHS.map(path => ({ path, count: rows.filter(row => getPathValue(row.payload, path) !== undefined).length, endpoints: Array.from(signalEndpoints.get(path) ?? []).sort() })).filter(signal => signal.count > 0), endpointsWithSignals: Array.from(endpointsWithSignals).sort(), endpointsWithoutSignals: Array.from(new Set(rows.map(row => row.endpoint))).filter(endpoint => !endpointsWithSignals.has(endpoint)).sort() };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    const { data: snapshots, error } = await supabase
      .from('gpro_import_snapshots')
      .select('id, endpoint, payload, season, race, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const typedSnapshots = (snapshots || []) as SnapshotRow[];
    const observations = buildRows(userId, typedSnapshots);
    const filteredObservations = observations.filter(row => row.hasTyreSignal || row.track);
    const auditSummary = buildAuditSummary(typedSnapshots);
    const variableCatalog = buildResearchVariableCatalog(typedSnapshots);

    const session = createKnowledgeScanSession();
    for (const snapshot of typedSnapshots) {
      session.addCapture(buildCapture(userId, snapshot));
    }

    const knowledgeSession = session.build();
    const discovery = runDiscovery(knowledgeSession);
    const knowledgeSummary = accumulateKnowledge(knowledgeSession);

    const uniqueRaces = Array.from(
      new Set(
        observations
          .filter(row => row.season !== null && row.race !== null)
          .map(row => `${row.season}-${row.race}`)
      )
    );
    const uniqueTracks = Array.from(new Set(observations.map(row => row.track).filter(Boolean) as string[]));
    const uniqueCompounds = Array.from(new Set(observations.map(row => row.compound).filter(Boolean) as string[]));
    const uniqueTemperatures = Array.from(new Set(observations.map(row => row.temperature).filter((v): v is number => typeof v === 'number')));
    const latestUpdate = observations.length ? observations[observations.length - 1].updatedAt : null;

    const coverage = observations.length
      ? Math.round((filteredObservations.length / observations.length) * 100)
      : 0;

    const hypotheses = [
      {
        title: 'O desgaste parece depender de temperatura, pista e composto.',
        status: filteredObservations.length > 0 ? 'Em análise' : 'Disponível em próxima fase',
        confidence: coverage,
        observations: filteredObservations.length,
      },
    ];

    return NextResponse.json({
      success: true,
      header: {
        observationCount: observations.length,
        raceCount: uniqueRaces.length,
        trackCount: uniqueTracks.length,
        latestUpdate,
      },
      overview: {
        racesAnalyzed: uniqueRaces.length,
        observations: observations.length,
        uniqueTracks: uniqueTracks.length,
        compoundsFound: uniqueCompounds.length,
        temperaturesObserved: uniqueTemperatures.length,
        coverage,
      },
      dataset: observations,
      trackExplorer: buildTrackExplorer(observations),
      knowledgePanel: {
        discovery,
        knowledgeSummary,
        schemaPreview: knowledgeSession.schemas[0] ?? null,
        evidencePreview: knowledgeSession.evidences[0] ?? null,
        auditSummary,
        variableCatalog,
      },
      hypotheses,
      roadmap: [
        { label: 'Modelo matemático', done: false },
        { label: 'Correlação', done: false },
        { label: 'Predição', done: false },
        { label: 'Comparação entre compostos', done: false },
        { label: 'Simulação', done: false },
      ],
    });
  } catch (error: any) {
    if (error?.status === 401) return NextResponse.json({ success: false, error: error.message || 'Não autenticado' }, { status: 401 });
    if (error?.status === 403) return NextResponse.json({ success: false, error: error.message || 'Acesso negado' }, { status: 403 });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar Tyre Lab' },
      { status: 500 }
    );
  }
}




