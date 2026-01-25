'use client';
import { useState, ChangeEvent } from 'react';

// --- TIPOS AUXILIARES ---
type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type DriverKeys = keyof typeof initialDriver;

// --- DADOS INICIAIS ---
const initialDriver = {
  total: 95,
  concentracao: 91,
  talento: 207,
  agressividade: 36,
  experiencia: 43,
  tecnica: 94,
  resistencia: 72,
  carisma: 34,
  motivacao: 0,
  reputacao: 0,
  peso: 64,
  idade: 21,
  energia: 100
};

export default function DashboardHome() {
  
  const [driver, setDriver] = useState(initialDriver);
  
  const [car, setCar] = useState([
    { name: "Chassi", lvl: 5, wear: 98 },
    { name: "Motor", lvl: 5, wear: 63 },
    { name: "Asa dianteira", lvl: 5, wear: 54 },
    { name: "Asa traseira", lvl: 5, wear: 55 },
    { name: "Assoalho", lvl: 4, wear: 93 },
    { name: "Laterais", lvl: 5, wear: 86 },
    { name: "Radiador", lvl: 5, wear: 84 },
    { name: "Câmbio", lvl: 5, wear: 27 },
    { name: "Freios", lvl: 5, wear: 88 },
    { name: "Suspensão", lvl: 4, wear: 95 },
    { name: "Eletrônicos", lvl: 5, wear: 83 },
  ]);

  const updateDriver = (field: DriverKeys, value: string) => {
    setDriver(prev => ({ ...prev, [field]: Number(value) }));
  };

  const updateCar = (index: number, field: 'lvl' | 'wear', value: string) => {
    const newCar = [...car];
    newCar[index][field] = Number(value);
    setCar(newCar);
  };

  return (
    // Usa 'animate-in' nativo do Tailwind css se configurado, ou apenas fade-in css padrão
    <div className="p-6 max-w-7xl mx-auto space-y-6 fade-in text-foreground">
      
      {/* ... [Header e Gerente - Mantenha seu código aqui, mas aplique as classes bg-card abaixo] ... */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUNA 1: GERENTE (Placeholder visual com as novas classes) */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden h-full min-h-[200px] p-6">
            <h3 className="font-semibold text-lg tracking-tight mb-4">Gerente</h3>
            <p className="text-muted-foreground text-sm">Seu conteúdo do gerente aqui...</p>
        </div>

        {/* COLUNA 2: HABILIDADES */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-5 h-full transition-all hover:shadow-md">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
                <h3 className="font-semibold text-lg tracking-tight">Habilidades</h3>
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-secondary px-2 py-1 rounded">Editável</span>
            </div>
            
            {/* Energia - Visual Modernizado */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col items-center justify-center w-10">
                    <span className="text-xl">⚡</span>
                </div>
                <div className="relative w-full h-8 bg-secondary rounded-lg border border-border overflow-hidden group shadow-inner">
                    <input 
                        type="number" 
                        value={driver.energia} 
                        onChange={(e) => updateDriver('energia', e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all duration-500 ease-out" 
                        style={{ width: `${driver.energia}%` }}
                    ></div>
                    {/* Efeito de brilho sobre a barra */}
                    <div className="absolute inset-0 bg-white/10 z-10 pointer-events-none"></div>
                    
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md z-10 pointer-events-none select-none">
                        {driver.energia}%
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                <SkillInput label="Total (OA)" value={driver.total} max={250} readonly highlight />
                
                <div className="h-px bg-border my-4" /> {/* Divisor sutil */}
                
                <SkillInput label="Concentração" value={driver.concentracao} max={150} onChange={(e) => updateDriver('concentracao', e.target.value)} />
                <SkillInput label="Talento" value={driver.talento} max={250} onChange={(e) => updateDriver('talento', e.target.value)} />
                <SkillInput label="Agressividade" value={driver.agressividade} max={150} onChange={(e) => updateDriver('agressividade', e.target.value)} />
                <SkillInput label="Experiência" value={driver.experiencia} max={150} onChange={(e) => updateDriver('experiencia', e.target.value)} />
                <SkillInput label="Conhec. Técnico" value={driver.tecnica} max={150} onChange={(e) => updateDriver('tecnica', e.target.value)} />
                <SkillInput label="Resistência" value={driver.resistencia} max={150} onChange={(e) => updateDriver('resistencia', e.target.value)} />
                <SkillInput label="Carisma" value={driver.carisma} max={150} onChange={(e) => updateDriver('carisma', e.target.value)} />
                <SkillInput label="Motivação" value={driver.motivacao} max={150} onChange={(e) => updateDriver('motivacao', e.target.value)} />
                <SkillInput label="Reputação" value={driver.reputacao} max={150} onChange={(e) => updateDriver('reputacao', e.target.value)} />
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                    <SkillInput label="Peso (kg)" value={driver.peso} max={100} color="bg-emerald-500" onChange={(e) => updateDriver('peso', e.target.value)} compact />
                    <SkillInput label="Idade" value={driver.idade} max={40} color="bg-emerald-500" onChange={(e) => updateDriver('idade', e.target.value)} compact />
                </div>
            </div>
        </div>

        {/* COLUNA 3: CARRO */}
        <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden h-full flex flex-col hover:shadow-md transition-all">
             <div className="bg-muted/30 p-4 border-b border-border flex justify-between items-center">
                <h3 className="font-semibold text-lg tracking-tight">Carro</h3>
                <span className="text-xs font-medium text-muted-foreground">Configuração</span>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-muted-foreground bg-muted/50 uppercase text-[10px] font-bold tracking-wider sticky top-0 backdrop-blur-sm">
                        <tr>
                            <th className="px-4 py-3 font-medium">Peça</th>
                            <th className="px-2 py-3 text-center font-medium">Nível</th>
                            <th className="px-2 py-3 text-center font-medium">Desgaste</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {car.map((part, index) => (
                            <CarPartInput 
                                key={index} 
                                name={part.name} 
                                level={part.lvl} 
                                wear={part.wear}
                                onLevelChange={(e) => updateCar(index, 'lvl', e.target.value)}
                                onWearChange={(e) => updateCar(index, 'wear', e.target.value)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES AUXILIARES (REESTILIZADOS) ---

interface SkillInputProps {
    label: string;
    value: number;
    max: number;
    color?: string;
    onChange?: (e: InputChangeEvent) => void;
    readonly?: boolean;
    highlight?: boolean;
    compact?: boolean;
}

function SkillInput({ label, value, max, color, onChange, readonly, highlight, compact }: SkillInputProps) {
    const width = Math.min(100, (value / max) * 100);
    
    return (
        <div className={`flex items-center gap-3 group ${compact ? 'flex-col items-stretch gap-1' : ''}`}>
            <span className={`text-sm font-medium transition-colors ${compact ? 'text-left' : 'w-28 text-right'} ${highlight ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                {label}
            </span>
            
            <div className={`flex items-center gap-2 flex-1 ${compact ? 'flex-row-reverse justify-end' : ''}`}>
                <input 
                    type="number" 
                    value={value} 
                    onChange={onChange}
                    readOnly={readonly}
                    className={`
                        w-10 bg-transparent text-center text-sm font-mono outline-none rounded-md py-0.5
                        transition-all duration-200
                        ${readonly 
                            ? 'font-bold text-foreground cursor-default' 
                            : 'border border-transparent hover:border-border focus:border-primary focus:bg-secondary focus:ring-1 focus:ring-primary/20'}
                    `}
                />

                <div className={`flex-1 h-2.5 bg-secondary rounded-full relative overflow-hidden ${compact ? 'w-full' : ''}`}>
                    <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${color ? color : 'bg-gradient-to-r from-red-500 via-orange-400 to-emerald-500'}`} 
                        style={{ width: `${width}%` }}
                    ></div>
                </div>
            </div>
        </div>
    )
}

interface CarPartInputProps {
    name: string;
    level: number;
    wear: number;
    onLevelChange: (e: InputChangeEvent) => void;
    onWearChange: (e: InputChangeEvent) => void;
}

function CarPartInput({ name, level, wear, onLevelChange, onWearChange }: CarPartInputProps) {
    // Lógica de cores mais sofisticada
    let wearColor = "text-emerald-600 dark:text-emerald-400";
    if (wear > 50) wearColor = "text-amber-600 dark:text-amber-400";
    if (wear > 90) wearColor = "text-destructive font-bold";

    return (
        <tr className="hover:bg-accent/50 transition-colors group">
            <td className="px-4 py-2.5 font-medium text-foreground text-sm border-r border-transparent">{name}</td>
            
            <td className="px-2 py-1 text-center">
                <input 
                    type="number" 
                    value={level} 
                    onChange={onLevelChange}
                    className="w-12 bg-transparent text-foreground text-center text-sm font-mono outline-none rounded hover:bg-muted focus:bg-background focus:ring-1 focus:ring-primary/20 transition-all p-1 border border-transparent focus:border-border"
                />
            </td>
            
            <td className="px-2 py-1 text-center">
                <div className="flex items-center justify-center gap-0.5">
                    <input 
                        type="number" 
                        value={wear} 
                        onChange={onWearChange}
                        className={`w-10 bg-transparent text-center font-mono outline-none rounded hover:bg-muted focus:bg-background focus:ring-1 focus:ring-primary/20 transition-all p-1 border border-transparent focus:border-border text-sm ${wearColor}`}
                    />
                    <span className="text-muted-foreground text-xs select-none">%</span>
                </div>
            </td>
        </tr>
    )
}