'use client';
import { Target, Car, Briefcase, Users } from 'lucide-react';
import { calcStaffLevel } from '@/app/lib/staff';

type Driver = { talento: number; concentracao: number; experiencia: number; energia: number; overall: number; name: string };
type CarPart = { name: string; lvl: number; wear: number };
type TD = { name?: string; overall?: string; racesLeft?: string; rdMecanico?: number; rdEletronico?: number; rdAerodinamico?: number };
type Staff = { toleranciaPressao?: number; concentracao?: number };

type Props = {
  driver: Driver;
  car: CarPart[];
  techDirector: TD;
  staffFacilities: Staff;
};

export function TeamStateGroup({ driver, car, techDirector, staffFacilities }: Props) {
  const avgLvl = car && car.length > 0 ? (car.reduce((a, p) => a + p.lvl, 0) / car.length).toFixed(1) : '—';
  const health = car && car.length > 0 ? Math.round(100 - car.reduce((a, p) => a + p.wear, 0) / car.length) : null;
  const sortedByWear = car ? [...car].sort((a, b) => b.wear - a.wear).slice(0, 2) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Piloto */}
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-white p-3 border-b border-slate-200 flex items-center gap-2">
          <Target size={14} className="text-emerald-500" />
          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Piloto</h4>
          <span className="ml-auto text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">OA {driver.overall ?? 0}</span>
        </div>
        <div className="p-4 bg-white">
          <p className="text-sm font-black text-slate-900 truncate">{driver.name || 'N/A'}</p>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
              <span>Energia</span>
              <span className={driver.energia >= 80 ? 'text-emerald-600' : driver.energia >= 50 ? 'text-amber-600' : 'text-red-500'}>{driver.energia}%</span>
            </div>
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${driver.energia >= 80 ? 'bg-emerald-500' : driver.energia >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, driver.energia)}%` }} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200"><span className="text-[9px] text-slate-500 font-black uppercase block">Talento</span><p className="text-sm font-black font-mono text-slate-900">{driver.talento ?? 0}</p></div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200"><span className="text-[9px] text-slate-500 font-black uppercase block">Concent.</span><p className="text-sm font-black font-mono text-slate-900">{driver.concentracao ?? 0}</p></div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200"><span className="text-[9px] text-slate-500 font-black uppercase block">Exper.</span><p className="text-sm font-black font-mono text-slate-900">{driver.experiencia ?? 0}</p></div>
          </div>
        </div>
      </div>

      {/* Carro */}
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-white p-3 border-b border-slate-200 flex items-center gap-2">
          <Car size={14} className="text-indigo-500" />
          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Carro</h4>
          {health !== null && <span className="ml-auto text-[11px] font-black text-emerald-700">{health}% saúde</span>}
        </div>
        <div className="p-4 bg-white">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-black uppercase text-slate-500">Nível médio</span>
            <span className="text-lg font-black font-mono text-slate-900">{avgLvl}</span>
          </div>
          {car && car.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {sortedByWear.map((p) => (
                <div key={p.name} className="flex justify-between text-xs">
                  <span className="text-slate-600 font-bold">{p.name}</span>
                  <span className={`font-mono font-black ${p.wear > 80 ? 'text-red-500' : p.wear > 50 ? 'text-amber-600' : 'text-slate-700'}`}>{p.wear}%</span>
                </div>
              ))}
              <p className="text-[10px] text-slate-500 font-bold">{car.length} peças</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Carro sem dados — sincronize.</p>
          )}
        </div>
      </div>

      {/* Staff / TD */}
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-white p-3 border-b border-slate-200 flex items-center gap-2">
          <Users size={14} className="text-purple-500" />
          <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Equipe Técnica</h4>
        </div>
        <div className="p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <Briefcase size={12} className="text-cyan-600" />
            <span className="text-sm font-black text-slate-900 truncate">{techDirector?.name || 'Sem diretor'}</span>
            <span className="ml-auto text-[11px] font-mono font-black text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">OA {techDirector?.overall || '0'}</span>
          </div>
          <div className="flex gap-3 text-xs font-mono text-slate-600">
            <span>🔧 {techDirector?.rdMecanico ?? 0}</span>
            <span>⚡ {techDirector?.rdEletronico ?? 0}</span>
            <span>🌀 {techDirector?.rdAerodinamico ?? 0}</span>
          </div>
          <div className="h-px bg-slate-200" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 font-bold">Staff</span>
            <span className="font-black font-mono text-emerald-600">Nv {calcStaffLevel(staffFacilities?.toleranciaPressao, staffFacilities?.concentracao)}</span>
          </div>
          <p className="text-xs text-slate-500">Tolerância {staffFacilities?.toleranciaPressao ?? 0} • Concentração {staffFacilities?.concentracao ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
