import * as XLSX from "xlsx";

// ============================================================================
// 1. INTERFACES
// ============================================================================

export interface RegressionSample {
  trackFactor: number;
  driverRisk: number;
  overtakeRisk: number;
  stamina: number;
  consumption: number;
}

export interface EnergyCoefficients {
  A: number; // Track Factor
  B: number; // Driver Risk
  C: number; // Overtake Risk
  D: number; // Stamina
  E: number; // Constante (Offset)
  Recovery: number;
  rSquared?: number; // Qualidade do modelo (opcional)
  standardError?: number; // Erro padrão (opcional)
}

export interface RaceAnalyzerResult {
  samples: RegressionSample[];
  coefficients: EnergyCoefficients;
}

// ============================================================================
// 2. VALOR PADRÃO DOS COEFICIENTES
// ============================================================================

export const DEFAULT_COEFFS: EnergyCoefficients = {
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  Recovery: 20,
  rSquared: 0,
  standardError: 0
};

// ============================================================================
// 3. UTILITÁRIOS E ÁLGEBRA LINEAR
// ============================================================================

const safeNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(',', '.').trim();
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, col) => matrix.map(row => row[col]));
}

function multiply(A: number[][], B: number[][]): number[][] {
  const result: number[][] = Array.from({ length: A.length }, () => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B[0].length; j++) {
      for (let k = 0; k < A[0].length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function invertMatrix(m: number[][]): number[][] {
  const n = m.length;
  const inv = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const a = m.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    let pivot = a[i][i];
    if (Math.abs(pivot) < 1e-12) pivot = 1e-10;
    for (let j = 0; j < n; j++) {
      a[i][j] /= pivot;
      inv[i][j] /= pivot;
    }
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        let factor = a[k][i];
        for (let j = 0; j < n; j++) {
          a[k][j] -= factor * a[i][j];
          inv[k][j] -= factor * inv[i][j];
        }
      }
    }
  }
  return inv;
}

// ============================================================================
// 4. FUNÇÃO DE PREDIÇÃO DE CONSUMO
// ============================================================================

/**
 * Prediz o consumo energético baseado nos coeficientes do modelo de regressão
 * Modelo: consumption = A * trackFactor + B * driverRisk + C * overtakeRisk + D * stamina + E
 */
export function predictConsumption(
  coefficients: EnergyCoefficients,
  trackFactor: number,
  driverRisk: number,
  overtakeRisk: number,
  stamina: number = 0
): number {
  return (
    coefficients.A * trackFactor +
    coefficients.B * driverRisk +
    coefficients.C * overtakeRisk +
    coefficients.D * stamina +
    coefficients.E
  );
}

// ============================================================================
// 5. MOTOR DE REGRESSÃO (OLS)
// ============================================================================

export function fitEnergyModel(samples: RegressionSample[]): EnergyCoefficients {
  if (samples.length < 6) {
    throw new Error("Mínimo de 6 corridas necessárias para calibração estável.");
  }

  // Matriz Y: Consumo Real
  const Y = samples.map(s => [s.consumption]);

  // Matriz X: [TrackFactor, DriverRisk, OvertakeRisk, Stamina, Constante]
  const X = samples.map(s => [s.trackFactor, s.driverRisk, s.overtakeRisk, s.stamina, 1]);

  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtX_inv = invertMatrix(XtX);
  const XtY = multiply(Xt, Y);
  const beta = multiply(XtX_inv, XtY);

  // Calcular R² (qualidade do modelo)
  const meanConsumption = samples.reduce((sum, s) => sum + s.consumption, 0) / samples.length;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < samples.length; i++) {
    const predicted = predictConsumption(
      { A: beta[0][0], B: beta[1][0], C: beta[2][0], D: beta[3][0], E: beta[4][0], Recovery: 20 },
      samples[i].trackFactor,
      samples[i].driverRisk,
      samples[i].overtakeRisk,
      samples[i].stamina
    );
    const residual = samples[i].consumption - predicted;
    ssRes += residual * residual;
    ssTot += Math.pow(samples[i].consumption - meanConsumption, 2);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const standardError = Math.sqrt(ssRes / (samples.length - 5));

  return {
    A: beta[0][0],
    B: beta[1][0],
    C: beta[2][0],
    D: beta[3][0],
    E: beta[4][0],
    Recovery: 20,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    standardError
  };
}

// ============================================================================
// 6. PIPELINE DE EXCEL (FRONTEND ONLY)
// ============================================================================

export async function analyzeRaceExcel(file: File, recovery = 20): Promise<RaceAnalyzerResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets["RaceHistory"];
        
        if (!sheet) throw new Error("Aba 'RaceHistory' não encontrada no Excel.");
        
        const json = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const samples: RegressionSample[] = json.map(r => {
            let tf = safeNumber(r.TrackFactor);
            if (tf === 0) {
                const c = safeNumber(r.Corners);
                const spd = safeNumber(r.AvgSpeed);
                const len = safeNumber(r.TrackLength);
                if (spd > 0) tf = ((c * len) / spd) * 0.04;
            }

            return {
              trackFactor: tf,
              driverRisk: safeNumber(r.DriverRisk),
              overtakeRisk: safeNumber(r.OvertakeRisk),
              stamina: safeNumber(r.Stamina),
              consumption: safeNumber(r.EnergyBefore) - safeNumber(r.EnergyAfter) + recovery
            };
        });

        const coefficients = fitEnergyModel(samples);
        resolve({ samples, coefficients });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}