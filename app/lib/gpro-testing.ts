// app/lib/gpro-testing.ts
// ============================================
// TESTING (mapeamento de dados de teste)
// ============================================
// Mapeia o payload bruto do endpoint Testing
// (ou do snapshot persistido) para o formato
// consumido pela página de Testes.
//
// Sem chamadas externas e sem persistência.
// ============================================

export interface TestingData {
  track: string;
  weather: string;
  temp: number;
}

/** Payload bruto do endpoint Testing (campos conhecidos). */
export interface TestingRawPayload {
  trackName?: string | null;
  weather?: string | null;
  weatherTransl?: string | null;
  temp?: number | string | null;
  [key: string]: unknown;
}

export function mapTesting(data: TestingRawPayload | null): TestingData | null {
  if (!data) return null;

  return {
    track: String(data.trackName ?? ''),
    weather: String(data.weatherTransl ?? data.weather ?? 'Dry'),
    temp: Number(data.temp ?? 0),
  };
}
