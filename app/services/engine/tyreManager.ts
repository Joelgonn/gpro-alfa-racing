// app/services/engine/tyreManager.ts

import { Track, Weather, Driver, CarSetup } from './simulationEngine';

export type TyreCompound = 'ultra-soft' | 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet';

export interface TyreSet {
  compound: TyreCompound;
  wear: number; // 0-100
  age: number; // voltas desde a última troca
  temperature: number; // °C
  performance: number; // 0-100
}

export interface TyreStrategy {
  initialCompound: TyreCompound;
  plannedStops: number;
  compoundsPerStint: TyreCompound[];
  expectedWearPerLap: number;
  estimatedTotalTime: number;
}

export interface TyreRecommendation {
  recommendedCompound: TyreCompound;
  estimatedLapsBeforeChange: number;
  performanceLoss: number; // segundos por volta quando desgastado
  confidence: number; // 0-100
}

export class TyreManager {
  
  // Propriedades base de cada composto
  private readonly compoundProperties: Record<TyreCompound, {
    grip: number; // 0-100
    wearRate: number; // multiplicador de desgaste
    operatingWindow: { min: number; max: number }; // temperatura ideal °C
    wetPerformance: number; // 0-100 performance na chuva
  }> = {
    'ultra-soft': { grip: 98, wearRate: 1.4, operatingWindow: { min: 80, max: 110 }, wetPerformance: 20 },
    'soft': { grip: 95, wearRate: 1.2, operatingWindow: { min: 85, max: 115 }, wetPerformance: 30 },
    'medium': { grip: 90, wearRate: 1.0, operatingWindow: { min: 90, max: 120 }, wetPerformance: 45 },
    'hard': { grip: 85, wearRate: 0.8, operatingWindow: { min: 95, max: 125 }, wetPerformance: 55 },
    'intermediate': { grip: 75, wearRate: 0.6, operatingWindow: { min: 60, max: 90 }, wetPerformance: 80 },
    'wet': { grip: 65, wearRate: 0.5, operatingWindow: { min: 50, max: 80 }, wetPerformance: 95 }
  };
  
  /**
   * Calcula o composto ideal baseado nas condições
   */
  public getIdealCompound(weather: Weather, track: Track): TyreCompound {
    if (weather.isWet) {
      if (weather.intensity > 0.6) {
        return 'wet';
      }
      return 'intermediate';
    }
    
    // Pistas abrasivas exigem compostos mais duros
    if (track.abrasiveness > 1.5) {
      return 'hard';
    } else if (track.abrasiveness > 1.1) {
      return 'medium';
    } else if (track.abrasiveness > 0.8) {
      return 'soft';
    }
    
    return 'ultra-soft';
  }
  
  /**
   * Calcula desgaste de pneu por volta
   */
  public calculateWearPerLap(
    compound: TyreCompound,
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    currentWear: number
  ): number {
    // Desgaste base do composto
    let wear = 1.2 * this.compoundProperties[compound].wearRate;
    
    // Fator de abrasividade da pista
    wear *= track.abrasiveness;
    
    // Agressividade do piloto
    wear *= (1 + driver.aggressiveness / 150);
    
    // Setup agressivo (asas baixas) aumenta desgaste
    const wingFactor = (11 - carSetup.frontWing) / 20 + (11 - carSetup.rearWing) / 20;
    wear *= (1 + wingFactor);
    
    // Clima (chuva reduz desgaste mas aumenta risco)
    if (weather.isWet) {
      wear *= 0.6;
    }
    
    // Temperatura da pista
    const trackTemp = weather.temperature + 15;
    const optimalTemp = this.compoundProperties[compound].operatingWindow;
    if (trackTemp > optimalTemp.max) {
      wear *= 1 + (trackTemp - optimalTemp.max) / 50;
    } else if (trackTemp < optimalTemp.min) {
      wear *= 1 + (optimalTemp.min - trackTemp) / 100;
    }
    
    // Pneus mais gastos aceleram o desgaste
    if (currentWear > 60) {
      wear *= 1 + (currentWear - 60) / 100;
    }
    
    return Math.max(0.5, Math.min(3.5, wear));
  }
  
  /**
   * Calcula perda de performance por desgaste (%)
   */
  public calculatePerformanceLoss(wear: number): number {
    if (wear <= 20) return 0;
    if (wear <= 40) return (wear - 20) * 0.25;
    if (wear <= 60) return 5 + (wear - 40) * 0.5;
    if (wear <= 80) return 15 + (wear - 60) * 1;
    return 35 + (wear - 80) * 2;
  }
  
  /**
   * Calcula tempo de volta ajustado pelo desgaste
   */
  public applyTyreWearPenalty(lapTime: number, wear: number): number {
    const lossPercent = this.calculatePerformanceLoss(wear);
    return lapTime * (1 + lossPercent / 100);
  }
  
  /**
   * Determina quando trocar pneus baseado no desgaste
   */
  public shouldChangeTyres(
    currentWear: number,
    currentLap: number,
    totalLaps: number,
    weather: Weather,
    hasWetForecast: boolean
  ): boolean {
    // Troca obrigatória se desgaste > 80%
    if (currentWear > 80) return true;
    
    // Se está chovendo e tem previsão de melhora, pode trocar para intermediates
    if (weather.isWet && weather.intensity < 0.3 && hasWetForecast === false) {
      return true;
    }
    
    // Se não está chovendo mas vai chover, trocar para intermediates
    if (!weather.isWet && hasWetForecast) {
      return true;
    }
    
    // Perto do fim da corrida, aguenta se possível
    const lapsRemaining = totalLaps - currentLap;
    if (lapsRemaining < 10 && currentWear < 90) {
      return false;
    }
    
    // Troca preventiva se ainda tem muito tempo e desgaste moderado
    if (lapsRemaining > 30 && currentWear > 60) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Otimiza estratégia de pneus para a corrida
   */
  public optimizeTyreStrategy(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    totalLaps: number,
    weatherForecast: Weather[] // previsão para diferentes momentos
  ): TyreStrategy {
    const segments: { compound: TyreCompound; laps: number }[] = [];
    let currentLap = 0;
    let currentWeather = weather;
    
    for (const forecast of weatherForecast) {
      const forecastLap = Math.floor(forecast as any); // simplificação
      if (forecastLap > currentLap) {
        const lapsInSegment = forecastLap - currentLap;
        const idealCompound = this.getIdealCompound(currentWeather, track);
        segments.push({ compound: idealCompound, laps: lapsInSegment });
        currentLap = forecastLap;
        currentWeather = forecast as any;
      }
    }
    
    // Adicionar segmento final
    if (currentLap < totalLaps) {
      const idealCompound = this.getIdealCompound(currentWeather, track);
      segments.push({ compound: idealCompound, laps: totalLaps - currentLap });
    }
    
    // Otimizar compostos por stint
    const compoundsPerStint: TyreCompound[] = [];
    let plannedStops = 0;
    let expectedWearPerLap = 0;
    let estimatedTotalTime = 0;
    
    for (const segment of segments) {
      const wearRate = this.calculateWearPerLap(
        segment.compound, driver, carSetup, track, 
        currentWeather, 0
      );
      
      const maxLapsOnCompound = Math.floor(80 / wearRate);
      
      if (segment.laps > maxLapsOnCompound) {
        // Precisa de pit dentro do segmento
        const numberOfStints = Math.ceil(segment.laps / maxLapsOnCompound);
        plannedStops += numberOfStints - 1;
        
        for (let i = 0; i < numberOfStints; i++) {
          compoundsPerStint.push(segment.compound);
        }
      } else {
        compoundsPerStint.push(segment.compound);
      }
      
      expectedWearPerLap += wearRate * segment.laps;
      estimatedTotalTime += segment.laps * 95; // tempo base estimado
    }
    
    // Adicionar tempo de pit stops
    estimatedTotalTime += plannedStops * 25;
    
    return {
      initialCompound: segments[0]?.compound || 'medium',
      plannedStops,
      compoundsPerStint,
      expectedWearPerLap: expectedWearPerLap / totalLaps,
      estimatedTotalTime
    };
  }
  
  /**
   * Recomenda composto e momento de troca
   */
  public recommendTyreStrategy(
    driver: Driver,
    carSetup: CarSetup,
    track: Track,
    weather: Weather,
    currentLap: number,
    totalLaps: number,
    currentWear: number
  ): TyreRecommendation {
    const idealCompound = this.getIdealCompound(weather, track);
    const wearPerLap = this.calculateWearPerLap(
      idealCompound, driver, carSetup, track, weather, currentWear
    );
    
    const remainingLaps = totalLaps - currentLap;
    let estimatedLapsBeforeChange = Math.floor(80 / wearPerLap);
    
    // Se já está desgastado, ajustar
    if (currentWear > 0) {
      const remainingWearCapacity = 80 - currentWear;
      estimatedLapsBeforeChange = Math.floor(remainingWearCapacity / wearPerLap);
    }
    
    // Não trocar se está perto do fim
    if (remainingLaps < estimatedLapsBeforeChange) {
      estimatedLapsBeforeChange = remainingLaps;
    }
    
    // Calcular perda de performance quando desgastado
    const performanceLoss = this.calculatePerformanceLoss(80);
    
    // Calcular confiança da recomendação
    let confidence = 85;
    if (weather.isWet && idealCompound === 'wet') confidence = 90;
    if (weather.isWet && idealCompound !== 'wet') confidence = 60;
    if (track.abrasiveness > 1.5) confidence -= 10;
    if (driver.aggressiveness > 80) confidence -= 10;
    
    return {
      recommendedCompound: idealCompound,
      estimatedLapsBeforeChange,
      performanceLoss,
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }
  
  /**
   * Calcula temperatura dos pneus
   */
  public calculateTyreTemperature(
    compound: TyreCompound,
    trackTemp: number,
    drivingStyle: number, // 0-100 agressividade
    lapNumber: number
  ): number {
    let baseTemp = trackTemp + 40;
    
    // Ajuste por composto
    if (compound === 'ultra-soft') baseTemp += 10;
    if (compound === 'soft') baseTemp += 5;
    if (compound === 'hard') baseTemp -= 5;
    
    // Estilo de pilotagem agressivo aquece mais
    baseTemp += drivingStyle / 5;
    
    // Pneus novos são mais frios
    if (lapNumber < 3) {
      baseTemp -= 15;
    }
    
    return Math.min(130, Math.max(40, baseTemp));
  }
}