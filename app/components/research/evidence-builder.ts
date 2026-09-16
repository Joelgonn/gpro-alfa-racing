import type { Evidence } from './EvidenceTypes';
import type { ResearchVariableRow } from '@/app/lib/research/research-variable-catalog';

function computeStatus(confidence: number): Evidence['status'] {
  if (confidence >= 70) return 'Forte';
  if (confidence >= 40) return 'Moderada';
  return 'Fraca';
}

function extractTracks(dataset: Record<string, unknown>[]): string[] {
  const tracks = new Set<string>();
  for (const row of dataset) {
    const t = row.track;
    if (t && typeof t === 'string') tracks.add(t);
  }
  return Array.from(tracks);
}

function extractSeasons(dataset: Record<string, unknown>[]): number[] {
  const seasons = new Set<number>();
  for (const row of dataset) {
    const s = row.season;
    if (s !== null && s !== undefined && typeof s === 'number') seasons.add(s);
  }
  return Array.from(seasons).sort();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFuelEvidences(variables: ResearchVariableRow[], datasetLength: number, dataset: any[]): Evidence[] {
  const evidences: Evidence[] = [];
  let id = 1;

  const sortedByCoverage = [...variables].sort((a, b) => b.coverage - a.coverage);
  const topCoverage = sortedByCoverage.slice(0, 3);
  if (topCoverage.length > 0) {
    const maxCoverage = topCoverage[0].coverage;
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const endpoints = new Set(topCoverage.flatMap(v => v.endpoints));
    const observations = topCoverage.reduce((sum, v) => sum + v.occurrences, 0);
    const confidence = Math.min(100, Math.round(
      (maxCoverage / 100) * 40 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      Math.min(1, endpoints.size / 3) * 20
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${topCoverage[0].path} é o campo com maior cobertura do dataset`,
      description: `Campo presente em ${maxCoverage}% das ${datasetLength} observações. Revela regularidade na captura deste campo pelos endpoints do Fuel Lab.`,
      variables: topCoverage.map(v => v.path),
      observations,
      coverage: maxCoverage,
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: endpoints.size,
      status: computeStatus(confidence),
      source: 'VariableCatalog — top variáveis por cobertura.',
    });
  }

  const numeric = variables.filter(v => v.numericStats);
  const topNumeric = numeric.sort((a, b) => (b.numericStats?.distinctValuesCount ?? 0) - (a.numericStats?.distinctValuesCount ?? 0)).slice(0, 3);
  if (topNumeric.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const endpoints = new Set(topNumeric.flatMap(v => v.endpoints));
    const observations = topNumeric.reduce((sum, v) => sum + v.occurrences, 0);
    const avgCoverage = Math.round(topNumeric.reduce((sum, v) => sum + v.coverage, 0) / topNumeric.length);
    const confidence = Math.min(100, Math.round(
      Math.min(1, avgCoverage / 100) * 30 +
      Math.min(1, tracks.length / 5) * 25 +
      Math.min(1, seasons.length / 3) * 25 +
      Math.min(1, endpoints.size / 3) * 20
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${topNumeric.length} variáveis numéricas com alta variabilidade nos dados`,
      description: `Variáveis como ${topNumeric.map(v => v.path).join(', ')} apresentam valores numéricos com distribuição observada em ${tracks.length} pistas e ${seasons.length} temporadas.`,
      variables: topNumeric.map(v => v.path),
      observations,
      coverage: avgCoverage,
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: endpoints.size,
      status: computeStatus(confidence),
      source: 'VariableCatalog — variáveis numéricas com faixa de valores.',
    });
  }

  const highMaturity = variables.filter(v => v.maturity === 'Consolidada' || v.maturity === 'Relevante');
  if (highMaturity.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const endpoints = new Set(highMaturity.flatMap(v => v.endpoints));
    const observations = highMaturity.reduce((sum, v) => sum + v.occurrences, 0);
    const avgCoverage = Math.round(highMaturity.reduce((sum, v) => sum + v.coverage, 0) / highMaturity.length);
    const confidence = Math.min(100, Math.round(
      Math.min(1, highMaturity.length / 5) * 20 +
      Math.min(1, avgCoverage / 100) * 30 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 15 +
      Math.min(1, endpoints.size / 3) * 15
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${highMaturity.length} variáveis atingiram maturidade consolidada ou relevante`,
      description: `Indica que ${highMaturity.map(v => v.path).slice(0, 3).join(', ')}${highMaturity.length > 3 ? ` e mais ${highMaturity.length - 3}` : ''} já possuem cobertura e consistência suficientes para análise continuada.`,
      variables: highMaturity.map(v => v.path),
      observations,
      coverage: avgCoverage,
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: endpoints.size,
      status: computeStatus(confidence),
      source: 'VariableCatalog — maturidade das variáveis.',
    });
  }

  const endpointCount = new Set(variables.flatMap(v => v.endpoints)).size;
  if (endpointCount > 1) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const confidence = Math.min(100, Math.round(
      Math.min(1, endpointCount / 5) * 30 +
      Math.min(1, tracks.length / 5) * 25 +
      Math.min(1, seasons.length / 3) * 25 +
      (variables.length > 10 ? 20 : 10)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `Dados de combustível distribuídos em ${endpointCount} endpoints diferentes`,
      description: `O sinal de combustível foi observado em múltiplos endpoints, indicando que não está isolado a uma única fonte — o que fortalece o suporte observacional.`,
      variables: [],
      observations: datasetLength,
      coverage: variables.length > 0 ? Math.round(variables.reduce((sum, v) => sum + v.coverage, 0) / variables.length) : 0,
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: endpointCount,
      status: computeStatus(confidence),
      source: 'VariableCatalog — distribuição por endpoints.',
    });
  }

  return evidences;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTyreEvidences(variables: ResearchVariableRow[], datasetLength: number, dataset: any[]): Evidence[] {
  const evidences: Evidence[] = [];
  let id = 1;

  const compoundRows = dataset.filter((row: any) => row.compound);
  const uniqueCompounds = new Set(compoundRows.map((row: any) => row.compound));
  if (uniqueCompounds.size > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const confidence = Math.min(100, Math.round(
      Math.min(1, uniqueCompounds.size / 3) * 25 +
      Math.min(1, compoundRows.length / 100) * 20 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      (variables.length > 5 ? 15 : 5)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${uniqueCompounds.size} compostos de pneu observados em ${tracks.length} pistas`,
      description: `Compostos como ${Array.from(uniqueCompounds).slice(0, 4).join(', ')} foram registrados em ${compoundRows.length} observações, cobrindo diferentes condições de pista e temperatura.`,
      variables: ['compound'],
      observations: compoundRows.length,
      coverage: Math.round((compoundRows.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo compound dos snapshots de pneu.',
    });
  }

  const wearRows = dataset.filter((row: any) => row.wear !== null && row.wear !== undefined);
  if (wearRows.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const wearValues = wearRows.map((row: any) => Number(row.wear)).filter((v: number) => Number.isFinite(v));
    const avgWear = wearValues.length > 0 ? Math.round(wearValues.reduce((s: number, v: number) => s + v, 0) / wearValues.length) : 0;
    const confidence = Math.min(100, Math.round(
      Math.min(1, wearRows.length / 100) * 30 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      (avgWear > 0 ? 15 : 0) +
      (uniqueCompounds.size > 1 ? 15 : 5)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `Desgaste médio de ${avgWear}% observado em ${wearRows.length} registros`,
      description: `Dados de desgaste (wear) disponíveis em ${wearRows.length} observações distribuídas em ${tracks.length} pistas e ${seasons.length} temporadas, com média de ${avgWear}%.`,
      variables: ['wear'],
      observations: wearRows.length,
      coverage: Math.round((wearRows.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo wear dos snapshots de pneu.',
    });
  }

  const tempRows = dataset.filter((row: any) => row.temperature !== null && row.temperature !== undefined);
  if (tempRows.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const temps = tempRows.map((row: any) => Number(row.temperature)).filter((v: number) => Number.isFinite(v));
    const avgTemp = temps.length > 0 ? Math.round((temps.reduce((s: number, v: number) => s + v, 0) / temps.length) * 10) / 10 : 0;
    const confidence = Math.min(100, Math.round(
      Math.min(1, tempRows.length / 100) * 25 +
      Math.min(1, tracks.length / 5) * 25 +
      Math.min(1, seasons.length / 3) * 25 +
      (wearRows.length > 0 ? 25 : 0)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `Temperatura média de ${avgTemp}°C registrada em ${tempRows.length} observações`,
      description: `Dados de temperatura ambiente coletados em ${tracks.length} pistas diferentes ao longo de ${seasons.length} temporadas. Pode ser um ponto de partida para investigar a relação entre temperatura e desgaste.`,
      variables: ['temperature'],
      observations: tempRows.length,
      coverage: Math.round((tempRows.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo temperature dos snapshots de pneu.',
    });
  }

  const weatherRows = dataset.filter((row: any) => row.weather);
  const uniqueWeather = new Set(weatherRows.map((row: any) => row.weather));
  if (uniqueWeather.size > 1) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const confidence = Math.min(100, Math.round(
      Math.min(1, weatherRows.length / 100) * 20 +
      Math.min(1, tracks.length / 5) * 25 +
      Math.min(1, seasons.length / 3) * 25 +
      (uniqueWeather.size > 1 ? 30 : 10)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${uniqueWeather.size} condições climáticas distintas registradas: ${Array.from(uniqueWeather).join(' e ')}`,
      description: `Observações em ${Array.from(uniqueWeather).join(' e ')} registradas em ${tracks.length} pistas e ${seasons.length} temporadas. A comparação de desgaste entre condições climáticas é uma direção possível de investigação.`,
      variables: ['weather'],
      observations: weatherRows.length,
      coverage: Math.round((weatherRows.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo weather dos snapshots de pneu.',
    });
  }

  return evidences;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDriverEnergyEvidences(variables: ResearchVariableRow[], datasetLength: number, dataset: any[]): Evidence[] {
  const evidences: Evidence[] = [];
  let id = 1;

  const energyLost = dataset
    .map((row: any) => row.energyLost)
    .filter((v: number | null): v is number => v !== null && Number.isFinite(v));

  if (energyLost.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const drivers = new Set(dataset.map((row: any) => row.driver).filter(Boolean));
    const avgLoss = Math.round((energyLost.reduce((s: number, v: number) => s + v, 0) / energyLost.length) * 10) / 10;
    const confidence = Math.min(100, Math.round(
      Math.min(1, energyLost.length / 50) * 25 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      Math.min(1, drivers.size / 3) * 20 +
      (variables.length > 5 ? 15 : 5)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `Perda média de energia de ${avgLoss} registrada em ${energyLost.length} observações`,
      description: `Dados de perda de energia do piloto disponíveis em ${energyLost.length} corridas, abrangendo ${drivers.size} piloto(s) em ${tracks.length} pistas ao longo de ${seasons.length} temporadas.`,
      variables: ['energyLost'],
      observations: energyLost.length,
      coverage: Math.round((energyLost.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo energyLost (perda_energia) da tabela energy_observations.',
    });
  }

  const drivers = new Set(dataset.map((row: any) => row.driver).filter(Boolean));
  if (drivers.size > 1) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const confidence = Math.min(100, Math.round(
      Math.min(1, drivers.size / 3) * 30 +
      Math.min(1, tracks.length / 5) * 25 +
      Math.min(1, seasons.length / 3) * 25 +
      (energyLost.length > 20 ? 20 : 10)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `Comparação possível entre ${drivers.size} pilotos diferentes na base`,
      description: `A base contém dados de ${Array.from(drivers).slice(0, 4).join(', ')}${drivers.size > 4 ? ` e mais ${drivers.size - 4}` : ''}, distribuídos em ${tracks.length} pistas e ${seasons.length} temporadas.`,
      variables: ['driver'],
      observations: datasetLength,
      coverage: Math.round((dataset.filter((row: any) => row.driver).length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo driver da tabela energy_observations.',
    });
  }

  const trackFactors = dataset
    .map((row: any) => row.track_factor)
    .filter((v: number | null): v is number => v !== null && Number.isFinite(v));

  if (trackFactors.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const uniqueTfs = new Set(trackFactors);
    const confidence = Math.min(100, Math.round(
      Math.min(1, trackFactors.length / 50) * 25 +
      Math.min(1, uniqueTfs.size / 3) * 20 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      (energyLost.length > 0 ? 15 : 5)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${uniqueTfs.size} track factors distintos observados em ${tracks.length} pistas`,
      description: `Track factors variam de ${Math.min(...trackFactors)} a ${Math.max(...trackFactors)} ao longo de ${trackFactors.length} registros. A relação entre track factor e energia do piloto merece investigação.`,
      variables: ['track_factor'],
      observations: trackFactors.length,
      coverage: Math.round((trackFactors.length / Math.max(1, datasetLength)) * 100),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: 1,
      status: computeStatus(confidence),
      source: 'Dataset — campo track_factor da tabela energy_observations.',
    });
  }

  const highScore = variables.filter(v => v.researchScore >= 70);
  if (highScore.length > 0) {
    const tracks = extractTracks(dataset);
    const seasons = extractSeasons(dataset);
    const confidence = Math.min(100, Math.round(
      Math.min(1, highScore.length / 5) * 30 +
      Math.min(1, tracks.length / 5) * 20 +
      Math.min(1, seasons.length / 3) * 20 +
      (energyLost.length > 20 ? 30 : 10)
    ));

    evidences.push({
      id: `E${id++}`,
      title: `${highScore.length} variáveis atingiram Research Score ≥ 70`,
      description: `Variáveis como ${highScore.slice(0, 3).map(v => v.path).join(', ')}${highScore.length > 3 ? ` e mais ${highScore.length - 3}` : ''} apresentam alto potencial de engenharia segundo o Research Score.`,
      variables: highScore.map(v => v.path),
      observations: highScore.reduce((sum, v) => sum + v.occurrences, 0),
      coverage: Math.round(highScore.reduce((sum, v) => sum + v.coverage, 0) / highScore.length),
      confidence,
      tracks: tracks.length,
      seasons: seasons.length,
      endpoints: new Set(highScore.flatMap(v => v.endpoints)).size,
      status: computeStatus(confidence),
      source: 'VariableCatalog — top variáveis por Research Score.',
    });
  }

  return evidences;
}
