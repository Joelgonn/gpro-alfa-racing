import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { requireAdmin, resolveUserId } from '@/app/lib/auth';
import { buildResearchVariableCatalog } from '@/app/lib/research/research-variable-catalog';

const supabase = supabaseAdmin;

type EnergyObservationRow = {
  id: string;
  user_id?: string | null;
  track_name: string | null;
  track_factor: number | null;
  energia_inicial: number | null;
  energia_final: number | null;
  perda_energia: number | null;
  xp: number | null;
  stamina: number | null;
  idade: number | null;
  peso: number | null;
  ctr: number | null;
  chassis: number | null;
  engine: number | null;
  front_wing: number | null;
  rear_wing: number | null;
  underbody: number | null;
  sidepods: number | null;
  cooling: number | null;
  gearbox: number | null;
  brakes: number | null;
  suspension: number | null;
  electronics: number | null;
  race_completed: boolean | number | null;
  race_clean: boolean | number | null;
  weather: string | null;
  final_position: number | null;
  reliability: number | null;
  temporada: number | null;
  corrida: number | null;
  voltas: number | null;
  corners: number | null;
  weather_condition: string | null;
  validation_status: string | null;
  observacoes: string | null;
  created_at: string | null;
  source: string | null;
  temperature: number | null;
  [key: string]: unknown;
};

async function getUserId(request: NextRequest): Promise<string> {
  const headerUserId = request.headers.get('user-id');
  const adminUser = await requireAdmin();
  if (headerUserId && headerUserId !== adminUser.id) {
    await resolveUserId(headerUserId);
  }
  return adminUser.id;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function buildDataset(rows: EnergyObservationRow[]) {
  return rows.map(row => ({
    id: row.id,
    season: row.temporada ?? null,
    race: row.corrida ?? null,
    track: row.track_name ?? null,
    driver: pickString(row.source) ?? null,
    track_name: row.track_name ?? null,
    track_factor: row.track_factor ?? null,
    energia_inicial: row.energia_inicial ?? null,
    energia_final: row.energia_final ?? null,
    perda_energia: row.perda_energia ?? null,
    xp: row.xp ?? null,
    stamina: row.stamina ?? null,
    idade: row.idade ?? null,
    peso: row.peso ?? null,
    ctr: row.ctr ?? null,
    chassis: row.chassis ?? null,
    engine: row.engine ?? null,
    front_wing: row.front_wing ?? null,
    rear_wing: row.rear_wing ?? null,
    underbody: row.underbody ?? null,
    sidepods: row.sidepods ?? null,
    cooling: row.cooling ?? null,
    gearbox: row.gearbox ?? null,
    brakes: row.brakes ?? null,
    suspension: row.suspension ?? null,
    electronics: row.electronics ?? null,
    race_completed: row.race_completed ?? null,
    race_clean: row.race_clean ?? null,
    temperature: row.temperature ?? null,
    weather: row.weather ?? null,
    energyInitial: row.energia_inicial ?? null,
    energyFinal: row.energia_final ?? null,
    energyLost: row.perda_energia ?? null,
    energyRecovered: null,
    final_position: row.final_position ?? null,
    reliability: row.reliability ?? null,
    temporada: row.temporada ?? null,
    corrida: row.corrida ?? null,
    voltas: row.voltas ?? null,
    corners: row.corners ?? null,
    weather_condition: row.weather_condition ?? null,
    validation_status: row.validation_status ?? null,
    observacoes: row.observacoes ?? null,
    source: pickString(row.source) ?? 'energy_observations',
    createdAt: row.created_at ?? '',
    raw: row,
  }));
}

function buildTrackExplorer(rows: ReturnType<typeof buildDataset>) {
  const map = new Map<string, {
    name: string;
    observationCount: number;
    temperatures: number[];
    races: Set<string>;
  }>();

  for (const row of rows) {
    if (!row.track) continue;
    const existing = map.get(row.track) ?? {
      name: row.track,
      observationCount: 0,
      temperatures: [],
      races: new Set<string>(),
    };

    existing.observationCount += 1;
    if (row.temperature !== null && row.temperature !== undefined) existing.temperatures.push(row.temperature);
    if (row.temporada !== null && row.corrida !== null) existing.races.add(`${row.temporada}-${row.corrida}`);
    map.set(row.track, existing);
  }

  return Array.from(map.values())
    .map(track => ({
      name: track.name,
      observationCount: track.observationCount,
      minTemperature: track.temperatures.length ? Math.min(...track.temperatures) : null,
      maxTemperature: track.temperatures.length ? Math.max(...track.temperatures) : null,
      endpointCount: 0,
      raceCount: track.races.size,
    }))
    .sort((a, b) => b.observationCount - a.observationCount || a.name.localeCompare(b.name));
}

function buildAudit(rows: EnergyObservationRow[]) {
  const pathCounts = new Map<string, number>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id' || key === 'user_id') continue;
      if (value === undefined) continue;
      pathCounts.set(key, (pathCounts.get(key) || 0) + 1);
    }
  }
  const totalSnapshots = rows.length;
  const fieldAudit = Array.from(pathCounts.entries())
    .map(([path, count]) => ({
      path,
      count,
      coverage: totalSnapshots ? Math.round((count / totalSnapshots) * 100) : 0,
      sampleType: typeof rows.find(row => row[path] !== undefined)?.[path],
    }))
    .sort((a, b) => b.coverage - a.coverage || b.count - a.count || a.path.localeCompare(b.path));

  return {
    totalSnapshots,
    uniquePaths: fieldAudit.length,
    fieldsIn100Percent: fieldAudit.filter(field => field.coverage === 100).map(field => field.path),
    fieldAudit,
    endpoints: ['energy_observations'],
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const { data: observations, error } = await supabase
      .from('energy_observations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const typedObservations = (observations || []) as EnergyObservationRow[];
    const dataset = buildDataset(typedObservations);
    const variableCatalog = buildResearchVariableCatalog(typedObservations);
    const auditSummary = buildAudit(typedObservations);
    const trackExplorer = buildTrackExplorer(dataset);

    const uniqueRaces = Array.from(new Set(dataset.filter(row => row.temporada !== null && row.corrida !== null).map(row => `${row.temporada}-${row.corrida}`)));
    const uniqueTracks = Array.from(new Set(dataset.map(row => row.track_name).filter(Boolean) as string[]));
    const uniqueDrivers = Array.from(new Set(dataset.map(row => row.source).filter(Boolean) as string[]));
    const latestUpdate = dataset.length ? typedObservations[typedObservations.length - 1].created_at ?? null : null;
    const coverage = dataset.length
      ? Math.round((dataset.filter(row => row.energia_inicial !== null || row.energia_final !== null || row.perda_energia !== null).length / dataset.length) * 100)
      : 0;
    const maxResearchScore = variableCatalog.reduce((max, variable) => Math.max(max, variable.researchScore), 0);
    const excellentVariables = variableCatalog.filter(variable => variable.researchLevel === 'Excelente').length;
    const averageResearchScore = variableCatalog.length
      ? Math.round(variableCatalog.reduce((sum, variable) => sum + variable.researchScore, 0) / variableCatalog.length)
      : 0;

    const discovery = {
      averageResearchScore,
      variableCount: variableCatalog.length,
      excellentVariables,
      coverage,
    };

    return NextResponse.json({
      success: true,
      header: {
        observationCount: dataset.length,
        raceCount: uniqueRaces.length,
        trackCount: uniqueTracks.length,
        latestUpdate,
      },
      overview: {
        observations: dataset.length,
        racesAnalyzed: uniqueRaces.length,
        pilots: uniqueDrivers.length,
        uniqueTracks: uniqueTracks.length,
        coverage,
        variablesCataloged: variableCatalog.length,
        maxResearchScore,
      },
      dataset,
      trackExplorer,
      discovery,
      knowledgePanel: {
        discovery,
        knowledgeSummary: {
          totalCaptures: dataset.length,
          totalObservations: dataset.length,
          totalFingerprints: 0,
          totalSchemas: 0,
          totalEvidences: 0,
          totalSnapshots: dataset.length,
          uniqueEndpoints: ['energy_observations'],
          uniqueFingerprintValues: [],
        },
        schemaPreview: null,
        evidencePreview: null,
        auditSummary,
        variableCatalog,
      },
      hypotheses: [
        { title: 'Perda de energia aumenta com temperatura.', status: 'Experimental', confidence: 25, observations: dataset.length, description: 'Hipótese inicial a ser acompanhada em novos snapshots.' },
        { title: 'Clima influencia recuperação.', status: 'Experimental', confidence: 25, observations: dataset.length, description: 'Sem modelagem nesta sprint, apenas registro observacional.' },
        { title: 'Energia inicial influencia desgaste.', status: 'Experimental', confidence: 25, observations: dataset.length, description: 'Mantida como hipótese de pesquisa futura.' },
        { title: 'Consumo varia por pista.', status: 'Experimental', confidence: 25, observations: dataset.length, description: 'Hipótese catalogada sem inferência matemática.' },
      ],
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
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar Driver Energy Lab' },
      { status: 500 }
    );
  }
}
