// app/services/engine/fuelCalculator.ts

import { Track, Weather, CarSetup, Driver } from './simulationEngine';

export interface FuelStrategy {
  initialFuel: number; // litros
  plannedPits: number;
  fuelPerStint: number[]; // litros por stint
  estimatedTotalFuel: number;
  safetyMargin: number; // litros extras
}

export interface FuelRecommendation {
  recommendedInitialFuel: number;
  recommendedPitWindow: number[]; // voltas recomendadas para pit
  estimatedLapsPerLiter: number;
  totalEstimatedConsumption: number;
  confidence: number; // 0-100
}

export class FuelCalculator {
  
  /**
   * Calcula o consumo base por volta para uma pista
   */
  private getBaseConsumption(track: Track): number {
    // Consumo base em litros por volta para um carro médio
    // baseado no comprimento da pista e demandas
    const baseConsumption = (track.length / 1000) * 0.35; // 0.35L por km
    return baseConsumption * track.engineDemand;
  }
  
  /**
   * Calcula fatores que afetam o consumo
   */
  private getConsumptionFactors(
    driver: Driver,
    carSetup: CarSetup,
    weather: Weather
  ): number {
    let factor = 1.0;
    
    // Fator do piloto (agressividade aumenta consumo)
    factor += (driver.aggressiveness - 50) / 200;
    
    // Fator do setup (motor mais potente consome mais)
    factor += (carSetup.engine - 5) / 25;
    
    // Fator climático (chuva aumenta consumo)
    if (weather.isWet) {
      factor *= 1.1 + weather.intensity * 0.1;
    }
    
    // Temperatura alta aumenta consumo
    if (weather.temperature > 30) {
      factor *= 1.05;
    }
    
    return factor;
  }
  
  /**
   * Calcula consumo para um piloto específico em uma volta
   */
  public calculateLapConsumption(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather
  ): number {
    const baseConsumption = this.getBaseConsumption(track);
    const factors = this.getConsumptionFactors(driver, carSetup, weather);
    
    let consumption = baseConsumption * factors;
    
    // Adicionar variação aleatória (pilotos podem ter variação de estilo)
    const variation = 0.9 + Math.random() * 0.2;
    consumption *= variation;
    
    return Math.max(1.2, Math.min(4.5, consumption)); // Limitar entre 1.2 e 4.5 L/volta
  }
  
  /**
   * Calcula consumo total estimado para uma corrida
   */
  public calculateTotalConsumption(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    laps: number
  ): number {
    let totalConsumption = 0;
    
    // Simular consumo por volta (com pequena variação)
    for (let lap = 1; lap <= laps; lap++) {
      const lapConsumption = this.calculateLapConsumption(
        driver, carSetup, track, weather
      );
      totalConsumption += lapConsumption;
    }
    
    return totalConsumption;
  }
  
  /**
   * Otimiza estratégia de combustível para minimizar pits
   */
  public optimizeFuelStrategy(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    laps: number,
    maxFuelCapacity: number = 180, // litros
    safetyMargin: number = 5 // litros extras por segurança
  ): FuelStrategy {
    const consumptionPerLap = this.calculateLapConsumption(
      driver, carSetup, track, weather
    );
    
    // Calcular quantos litros são necessários para a corrida inteira
    const totalNeeded = consumptionPerLap * laps + safetyMargin;
    
    // Calcular número ideal de pits
    let plannedPits = Math.ceil(totalNeeded / maxFuelCapacity) - 1;
    if (plannedPits < 0) plannedPits = 0;
    
    // Distribuir combustível por stint
    const lapsPerStint = Math.floor(laps / (plannedPits + 1));
    const fuelPerStint: number[] = [];
    
    let remainingLaps = laps;
    for (let i = 0; i <= plannedPits; i++) {
      const stintLaps = i === plannedPits ? remainingLaps : lapsPerStint;
      const stintFuel = stintLaps * consumptionPerLap + safetyMargin;
      fuelPerStint.push(Math.min(maxFuelCapacity, stintFuel));
      remainingLaps -= stintLaps;
    }
    
    // Calcular combustível inicial
    const initialFuel = fuelPerStint[0];
    
    // Calcular consumo total estimado (mais preciso)
    let estimatedTotalFuel = 0;
    for (const fuel of fuelPerStint) {
      estimatedTotalFuel += fuel;
    }
    
    return {
      initialFuel,
      plannedPits,
      fuelPerStint,
      estimatedTotalFuel,
      safetyMargin
    };
  }
  
  /**
   * Recomenda janelas de pit stop ideais
   */
  public recommendPitWindows(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    laps: number,
    tyreLife: number = 40 // voltas estimadas de vida dos pneus
  ): FuelRecommendation {
    const consumptionPerLap = this.calculateLapConsumption(
      driver, carSetup, track, weather
    );
    
    const maxFuelCapacity = 180;
    const maxLapsOnFuel = Math.floor(maxFuelCapacity / consumptionPerLap);
    
    // Calcular janelas de pit (quando o combustível acaba)
    const pitWindows: number[] = [];
    let currentLap = 0;
    
    while (currentLap < laps) {
      const nextPit = Math.min(currentLap + maxLapsOnFuel, laps);
      if (nextPit < laps) {
        // Janela de 3 voltas para pit
        const windowStart = Math.max(currentLap + maxLapsOnFuel - 3, currentLap + 1);
        const windowEnd = nextPit;
        pitWindows.push(windowStart, windowEnd);
      }
      currentLap = nextPit;
    }
    
    // Considerar também desgaste de pneus para pit windows
    const tyreWindows: number[] = [];
    for (let lap = tyreLife; lap < laps; lap += tyreLife) {
      tyreWindows.push(lap - 2, lap + 2);
    }
    
    // Combinar janelas
    const combinedWindows = [...pitWindows];
    for (const window of tyreWindows) {
      if (!combinedWindows.includes(window)) {
        combinedWindows.push(window);
      }
    }
    combinedWindows.sort((a, b) => a - b);
    
    // Calcular consumo total estimado
    const totalConsumption = this.calculateTotalConsumption(
      driver, carSetup, track, weather, laps
    );
    
    // Calcular confiança na estimativa
    let confidence = 80;
    if (weather.isWet) confidence -= 20;
    if (driver.aggressiveness > 80) confidence -= 10;
    if (driver.aggressiveness < 30) confidence -= 10;
    
    return {
      recommendedInitialFuel: Math.min(maxFuelCapacity, totalConsumption * 0.4),
      recommendedPitWindow: combinedWindows,
      estimatedLapsPerLiter: 1 / consumptionPerLap,
      totalEstimatedConsumption: totalConsumption,
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }
  
  /**
   * Calcula economia de combustível necessária para alcançar determinada volta
   */
  public calculateFuelSavingNeeded(
    currentFuel: number,
    currentLap: number,
    targetLap: number,
    consumptionPerLap: number
  ): number {
    const remainingLaps = targetLap - currentLap;
    const fuelNeeded = remainingLaps * consumptionPerLap;
    
    if (currentFuel >= fuelNeeded) {
      return 0; // não precisa economizar
    }
    
    const fuelDeficit = fuelNeeded - currentFuel;
    const savingPerLap = fuelDeficit / remainingLaps;
    const savingPercentage = (savingPerLap / consumptionPerLap) * 100;
    
    return savingPercentage;
  }
  
  /**
   * Verifica se um piloto pode completar a corrida sem reabastecer
   */
  public canCompleteWithoutPit(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    laps: number,
    fuelCapacity: number = 180
  ): boolean {
    const totalNeeded = this.calculateTotalConsumption(
      driver, carSetup, track, weather, laps
    );
    return totalNeeded <= fuelCapacity;
  }
}