// domain/setup/calculateSetup.ts

import tracksData from "@/data/tracks.json"

export interface SetupInput {
  pista: string
  driver: any
  car: any[]
  tech_director: any
  staff_facilities: any
  tempQ1: number
  tempQ2: number
  weatherQ1: string
  weatherQ2: string
  weatherRace: string
  raceAvgTemp: number
  desgasteModifier: number
}

export interface SetupOutput {
  asaDianteira: {
    q1: number
    q2: number
    race: number
  }
  asaTraseira: {
    q1: number
    q2: number
    race: number
  }
  motor: {
    q1: number
    q2: number
    race: number
  }
  freios: {
    q1: number
    q2: number
    race: number
  }
  cambio: {
    q1: number
    q2: number
    race: number
  }
  suspensao: {
    q1: number
    q2: number
    race: number
  }
}

function round(val: number): number {
  return Math.round(val)
}

function mround(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple
}

// 🔧 PROCV REAL - Usando o arquivo tracks.json
// Fonte: PROCV($R$5;Tracks!$A$4:$W$885;19;0)
function getTrackBaseValue(pista: string): number {
  const value = (tracksData as Record<string, number>)[pista]
  
  if (!value) {
    console.warn(`⚠️ Pista não encontrada no tracks.json: ${pista}, usando valor padrão 200`)
    return 200
  }
  
  return value
}

// 🔧 P25 - ESTRUTURA PREPARADA PARA DADOS REAIS
// TODO: Implementar N13 + N19 baseado no Setup&WS
// N13 = I6*B13 + I7*C13 + I8*D13 + I9*E13 + I10*F13 + I11*G13 + I12*H13 + I13*I13 + I14*K13 + I15*L13 + I16*M13
// N19 = J6*B19 + J7*C19 + J8*D19 + J9*E19 + J10*F19 + J11*G19 + J12*H19 + J13*I19 + J14*K19 + J15*L19 + J16*M19
function calculateP25(input: SetupInput): number {
  // TEMPORÁRIO: valor calibrado para Jeddah
  // Quando implementar N13+N19 real, isso será dinâmico por pista
  return 154
}

// ============================================
// ASA DIANTEIRA Q1
// ============================================
function calculateAsaDianteiraQ1(input: SetupInput): number {
  const talento = input.driver?.talento || 0
  const experiencia = input.driver?.experiencia || 0
  const conhecimento = input.driver?.tecnica || 0

  const rdAero = input.tech_director?.rdAerodinamico || 0
  const expTD = input.tech_director?.experiencia || 50

  const pista = input.pista
  const weather = input.weatherQ1

  const R7 = 1
  
  const tableDry = 6.1
  const tableWet = 1
  const tableExtra = 270
  
  const JRaw = weather === "Dry"
    ? tableDry * R7
    : tableWet * R7 + tableExtra

  const JFinal = JRaw * 2

  const trackBase = getTrackBaseValue(pista)
  const I25 = trackBase * 2

  const somaParaArredondar = I25 + JFinal
  const arred = mround(somaParaArredondar, 1)

  const trackModifier = pista !== "Indianapolis Oval" ? 1 : 0.39

  const M25 = talento * arred * -0.001349079032746 * trackModifier

  const P25 = calculateP25(input)

  const Q25 = (I25 + JFinal + M25 + P25) / 2

  const V24 = round(
    experiencia * -0.051 +
    conhecimento * -0.153 +
    67.594
  ) * 2 + 2

  const W24 = Math.max(
    2,
    round(
      experiencia * -0.051 +
      conhecimento * -0.153 +
      69.592 +
      expTD * -0.031 +
      rdAero * -0.203
    ) * 2
  )

  const adjustment = expTD === 0 ? V24 / 2 : W24 / 2

  const resultado = Math.round(Q25) - adjustment

  return resultado
}

// ============================================
// ASA DIANTEIRA Q2
// ============================================
function calculateAsaDianteiraQ2(input: SetupInput): number {
  const talento = input.driver?.talento || 0
  const experiencia = input.driver?.experiencia || 0
  const conhecimento = input.driver?.tecnica || 0

  const rdAero = input.tech_director?.rdAerodinamico || 0
  const expTD = input.tech_director?.experiencia || 50

  const pista = input.pista
  const weather = input.weatherQ2

  const R7 = 1
  
  const tableDry = 6.1
  const tableWet = 1
  const tableExtra = 270
  
  const JRaw = weather === "Dry"
    ? tableDry * R7
    : tableWet * R7 + tableExtra

  const JFinal = JRaw * 2

  const trackBase = getTrackBaseValue(pista)
  const I25 = trackBase * 2

  const somaParaArredondar = I25 + JFinal
  const arred = mround(somaParaArredondar, 1)

  const trackModifier = pista !== "Indianapolis Oval" ? 1 : 0.39

  const M25 = talento * arred * -0.001349079032746 * trackModifier

  const P25 = calculateP25(input)

  const Q25 = (I25 + JFinal + M25 + P25) / 2

  const V24 = round(
    experiencia * -0.051 +
    conhecimento * -0.153 +
    67.594
  ) * 2 + 2

  const W24 = Math.max(
    2,
    round(
      experiencia * -0.051 +
      conhecimento * -0.153 +
      69.592 +
      expTD * -0.031 +
      rdAero * -0.203
    ) * 2
  )

  const adjustment = expTD === 0 ? V24 / 2 : W24 / 2

  const resultado = Math.round(Q25) - adjustment

  return resultado
}

// ============================================
// ASA DIANTEIRA RACE
// ============================================
function calculateAsaDianteiraRace(input: SetupInput): number {
  const talento = input.driver?.talento || 0
  const experiencia = input.driver?.experiencia || 0
  const conhecimento = input.driver?.tecnica || 0

  const rdAero = input.tech_director?.rdAerodinamico || 0
  const expTD = input.tech_director?.experiencia || 50

  const pista = input.pista
  const weather = input.weatherRace

  const R7 = 1
  
  const tableDry = 6.1
  const tableWet = 1
  const tableExtra = 270
  
  const JRaw = weather === "Dry"
    ? tableDry * R7
    : tableWet * R7 + tableExtra

  const JFinal = JRaw * 2

  const trackBase = getTrackBaseValue(pista)
  const I25 = trackBase * 2

  const somaParaArredondar = I25 + JFinal
  const arred = mround(somaParaArredondar, 1)

  const trackModifier = pista !== "Indianapolis Oval" ? 1 : 0.39

  const M25 = talento * arred * -0.001349079032746 * trackModifier

  const P25 = calculateP25(input)

  const Q25 = (I25 + JFinal + M25 + P25) / 2

  const V24 = round(
    experiencia * -0.051 +
    conhecimento * -0.153 +
    67.594
  ) * 2 + 2

  const W24 = Math.max(
    2,
    round(
      experiencia * -0.051 +
      conhecimento * -0.153 +
      69.592 +
      expTD * -0.031 +
      rdAero * -0.203
    ) * 2
  )

  const adjustment = expTD === 0 ? V24 / 2 : W24 / 2

  const resultado = Math.round(Q25) - adjustment

  return resultado
}

// ============================================
// EXPORTAÇÃO PRINCIPAL
// ============================================
export function calculateSetup(input: SetupInput): SetupOutput {
  return {
    asaDianteira: {
      q1: calculateAsaDianteiraQ1(input),
      q2: calculateAsaDianteiraQ2(input),
      race: calculateAsaDianteiraRace(input)
    },
    asaTraseira: {
      q1: 0,
      q2: 0,
      race: 0
    },
    motor: {
      q1: 0,
      q2: 0,
      race: 0
    },
    freios: {
      q1: 0,
      q2: 0,
      race: 0
    },
    cambio: {
      q1: 0,
      q2: 0,
      race: 0
    },
    suspensao: {
      q1: 0,
      q2: 0,
      race: 0
    }
  }
}