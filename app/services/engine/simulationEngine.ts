// app/services/engine/simulationEngine.ts

export interface Driver {
  id: string;
  name: string;
  skill: number; // 0-100, influencia a consistência e economia de pneus
  aggressiveness: number; // 0-100, influencia ultrapassagens e desgaste de pneus
  technical: number; // 0-100, habilidade em condições molhadas
  stamina: number; // 0-100, resistência para corridas longas
  weight: number; // kg, peso do piloto (influencia performance)
}

export interface CarSetup {
  frontWing: number; // 1-10
  rearWing: number; // 1-10
  engine: number; // 1-10
  brakes: number; // 1-10
  suspension: number; // 1-10
}

export interface Track {
  id: string;
  name: string;
  length: number; // metros
  laps: number;
  averageSpeed: number; // km/h, referência
  abrasiveness: number; // 0.5-2.0, multiplicador de desgaste de pneus
  engineDemand: number; // 0.5-2.0, multiplicador de consumo de combustível
  corners: number; // número de curvas, influencia freios
  isWetProbability: number; // 0-1
}

export interface Weather {
  temperature: number; // °C
  humidity: number; // %
  isWet: boolean;
  intensity: number; // 0-1 (chuva leve a torrencial)
}

export interface RaceResult {
  driverId: string;
  position: number;
  totalTime: number; // segundos
  lapTimes: number[]; // tempos por volta em segundos
  pits: number;
  tyreWear: number; // % média final
  fuelConsumption: number; // litros totais
  incidents: number; // número de erros/incidentes
  consistency: number; // 0-100, quão constante foi
}

export class SimulationEngine {
  
  /**
   * Calcula o tempo de volta base ajustado por piloto, carro e clima
   */
  private calculateLapTime(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    fuelLoad: number, // kg
    tyreWear: number, // % de desgaste (0-100)
    lapNumber: number
  ): number {
    // Tempo base da pista (segundos por km * comprimento)
    const baseTime = (track.length / 1000) / (track.averageSpeed / 3600);
    
    // Fator de habilidade do piloto (menos habilidade = mais tempo)
    const skillFactor = 1 - (driver.skill / 200);
    
    // Fator de agressividade (agressivo = mais rápido mas desgasta mais)
    const aggressionBonus = driver.aggressiveness / 200;
    const aggressionFactor = 1 - aggressionBonus;
    
    // Fator de peso (peso extra = mais lento)
    const weightFactor = 1 + (driver.weight - 75) / 500;
    
    // Fator de configuração do carro (ajustes individuais)
    const setupFactor = 
      (carSetup.frontWing / 10) * 0.02 +
      (carSetup.rearWing / 10) * 0.02 +
      (carSetup.engine / 10) * 0.03 +
      (carSetup.brakes / 10) * 0.01 +
      (carSetup.suspension / 10) * 0.01;
    
    // Fator de clima (pista molhada reduz performance)
    let weatherFactor = 1;
    if (weather.isWet) {
      const wetSkill = driver.technical / 100;
      weatherFactor = 1 + (weather.intensity * 0.5) - (wetSkill * 0.3);
    }
    
    // Fator de combustível (mais peso = mais lento)
    const fuelFactor = 1 + (fuelLoad / 800);
    
    // Fator de desgaste de pneus (pneus gastos = mais lentos)
    const tyreFactor = 1 + (tyreWear / 150);
    
    // Degradação ao longo da corrida (fadiga)
    const fatigueFactor = 1 + (lapNumber / track.laps) * 0.05 * (1 - driver.stamina / 100);
    
    // Tempo final calculado
    let lapTime = baseTime * skillFactor * aggressionFactor * weightFactor * 
                  (1 + setupFactor) * weatherFactor * fuelFactor * tyreFactor * fatigueFactor;
    
    // Adicionar variação aleatória para consistência (quanto maior skill, menor variação)
    const consistencyVariation = (Math.random() - 0.5) * 0.015 * (1 - driver.skill / 100);
    lapTime *= (1 + consistencyVariation);
    
    return lapTime;
  }
  
  /**
   * Calcula o desgaste de pneus por volta
   */
  private calculateTyreWear(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    lapNumber: number
  ): number {
    // Desgaste base da pista (abrasividade)
    let wear = 0.01 * track.abrasiveness;
    
    // Agressividade do piloto acelera desgaste
    wear *= (1 + driver.aggressiveness / 100);
    
    // Setup agressivo (asas baixas) aumenta desgaste
    const setupAggression = (11 - carSetup.frontWing) / 10 + (11 - carSetup.rearWing) / 10;
    wear *= (1 + setupAggression * 0.3);
    
    // Chuva reduz desgaste mas aumenta risco
    if (weather.isWet) {
      wear *= 0.7;
    }
    
    // Pneus pioram com o uso (aceleração do desgaste)
    return wear;
  }
  
  /**
   * Calcula o consumo de combustível por volta (litros)
   */
  private calculateFuelConsumption(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather
  ): number {
    // Consumo base da pista
    let consumption = 2.5 * track.engineDemand;
    
    // Piloto agressivo consome mais
    consumption *= (1 + driver.aggressiveness / 150);
    
    // Setup com mais potência (engine alto) consome mais
    consumption *= (1 + (carSetup.engine - 5) / 20);
    
    // Chuva aumenta consumo (maior arrasto)
    if (weather.isWet) {
      consumption *= 1.15;
    }
    
    return consumption;
  }
  
  /**
   * Calcula a probabilidade de incidente por volta
   */
  private calculateIncidentProbability(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    tyreWear: number,
    lapNumber: number
  ): number {
    // Base
    let probability = 0.02;
    
    // Piloto agressivo tem mais risco
    probability += driver.aggressiveness / 500;
    
    // Setup instável (asas baixas) aumenta risco
    const setupRisk = (11 - carSetup.frontWing) / 50 + (11 - carSetup.rearWing) / 50;
    probability += setupRisk;
    
    // Chuva aumenta muito o risco
    if (weather.isWet) {
      probability += weather.intensity * 0.15;
      // Piloto com baixa técnica sofre mais na chuva
      probability += (1 - driver.technical / 100) * 0.1;
    }
    
    // Pneus gastos aumentam risco
    probability += tyreWear / 500;
    
    // Fadiga aumenta risco
    probability += (lapNumber / 100) * (1 - driver.stamina / 100);
    
    return Math.min(probability, 0.4); // Máximo 40% por volta
  }
  
  /**
   * Simula uma corrida completa
   */
  public simulateRace(
    drivers: Driver[],
    carSetups: CarSetup[],
    track: Track,
    weather: Weather,
    lapsToSimulate?: number // opcional, padrão track.laps
  ): RaceResult[] {
    const totalLaps = lapsToSimulate || track.laps;
    const results: RaceResult[] = [];
    
    // Estrutura de dados para cada piloto durante a simulação
    const driversState = drivers.map((driver, idx) => ({
      driver,
      setup: carSetups[idx],
      lapTimes: [] as number[],
      fuel: 180, // litros iniciais
      tyreWear: 0,
      pits: 0,
      incidents: 0,
      totalTime: 0,
      currentPosition: 0,
      lastLapTime: 0,
      consistency: 100
    }));
    
    // Simular volta por volta
    for (let lap = 1; lap <= totalLaps; lap++) {
      // Calcular tempos de volta para todos os pilotos
      for (const state of driversState) {
        // Calcular desgaste de pneus
        const tyreWearIncrement = this.calculateTyreWear(
          state.driver, state.setup, track, weather, lap
        );
        state.tyreWear = Math.min(100, state.tyreWear + tyreWearIncrement);
        
        // Calcular consumo de combustível
        const fuelUsed = this.calculateFuelConsumption(
          state.driver, state.setup, track, weather
        );
        state.fuel -= fuelUsed;
        
        // Verificar se precisa de pit stop (pneus > 80% ou combustível < 20L)
        let pitThisLap = false;
        if (state.tyreWear > 80 || state.fuel < 20) {
          pitThisLap = true;
          state.pits++;
          state.tyreWear = 0; // troca de pneus
          state.fuel = 180; // reabastecimento
        }
        
        // Calcular tempo da volta
        let lapTime = this.calculateLapTime(
          state.driver, state.setup, track, weather, 
          180 - state.fuel, state.tyreWear, lap
        );
        
        // Adicionar tempo do pit stop se necessário
        if (pitThisLap) {
          lapTime += 25; // 25 segundos para pit stop
        }
        
        // Calcular incidentes
        const incidentProb = this.calculateIncidentProbability(
          state.driver, state.setup, track, weather, state.tyreWear, lap
        );
        
        if (Math.random() < incidentProb) {
          state.incidents++;
          lapTime += 5; // perde 5 segundos por incidente
        }
        
        state.lapTimes.push(lapTime);
        state.totalTime += lapTime;
        state.lastLapTime = lapTime;
      }
      
      // Ordenar por posição (menor tempo total = melhor)
      driversState.sort((a, b) => a.totalTime - b.totalTime);
      
      // Atualizar posições
      driversState.forEach((state, pos) => {
        state.currentPosition = pos + 1;
      });
    }
    
    // Calcular consistência para cada piloto
    for (const state of driversState) {
      if (state.lapTimes.length > 1) {
        const mean = state.totalTime / state.lapTimes.length;
        let variance = 0;
        for (const lapTime of state.lapTimes) {
          variance += Math.pow(lapTime - mean, 2);
        }
        variance /= state.lapTimes.length;
        const stdDev = Math.sqrt(variance);
        // Consistência = 100 - (desvio padrão relativo * 100)
        const consistency = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100));
        state.consistency = consistency;
      }
    }
    
    // Montar resultados ordenados
    driversState.sort((a, b) => a.totalTime - b.totalTime);
    for (let pos = 0; pos < driversState.length; pos++) {
      const state = driversState[pos];
      results.push({
        driverId: state.driver.id,
        position: pos + 1,
        totalTime: state.totalTime,
        lapTimes: state.lapTimes,
        pits: state.pits,
        tyreWear: state.tyreWear,
        fuelConsumption: 180 - state.fuel,
        incidents: state.incidents,
        consistency: state.consistency
      });
    }
    
    return results;
  }
  
  /**
   * Gera condições climáticas baseadas em probabilidade
   */
  public generateWeather(track: Track): Weather {
    const isWet = Math.random() < track.isWetProbability;
    return {
      temperature: 20 + Math.random() * 20,
      humidity: 40 + Math.random() * 50,
      isWet,
      intensity: isWet ? Math.random() * 0.8 + 0.2 : 0
    };
  }
}