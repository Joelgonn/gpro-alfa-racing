'use client';
import { Car } from 'lucide-react';
type CarPart = { name: string; lvl: number; wear: number };
export function CarHealth({ car }: { car: CarPart[] }) {
  if (!car || car.length === 0) return <div className="p-6 text-center text-sm text-zinc-400">Carro sem dados — sincronize.</div>;
  const avgLvl = (car.reduce((a, p) => a + p.lvl, 0) / car.length).toFixed(1);
  const health = Math.round(100 - car.reduce((a, p) => a + p.wear, 0) / car.length);
  return (
    <div className="p-3 bg-transparent">
      <div className="flex items-center justify-between"><span className="text-sm font-black font-mono text-white">{avgLvl}</span><span className="text-xs text-zinc-400">Nível Médio</span></div>
      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400"><span>Peças: {car.length}</span><span>•</span><span className="text-emerald-300 font-black font-mono">{health}% saúde</span></div>
    </div>
  );
}
export function CarHealthCard({ car }: { car: CarPart[] }) {
  return (
    <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
      <div className="bg-[#0a0f1f] p-3 border-b border-white/10 flex items-center gap-2"><Car size={14} className="text-indigo-400" /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Carro</h4></div>
      <CarHealth car={car} />
    </div>
  );
}
