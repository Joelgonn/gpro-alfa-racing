'use client';
import { Trophy, Calendar, Activity } from 'lucide-react';

type RaceStatusStripProps = {
  championship: { season: string; race: string; position: string; points: string; average: string };
  nextRace: { season: string; race: string; track: string; donePractice: string; doneQ1: string; doneQ2: string };
  weather: { tempQ1: number; tempQ2: number; weatherRace: string };
  getFlagUrlTrack: (t: string) => string | null;
  officeData: any;
  getOfficeEmptyState: () => { title: string; action?: string | null; href?: string };
  isSyncing: boolean;
  onSync: () => void;
};

export function RaceStatusStrip({ championship, nextRace, weather, getFlagUrlTrack, officeData, getOfficeEmptyState, isSyncing, onSync }: RaceStatusStripProps) {
  const hasOffice = !!officeData;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="bg-[#0a0f1f] p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="p-1.5 bg-emerald-600 rounded-lg"><Trophy size={14} className="text-white" /></div><h3 className="text-[11px] font-black text-white uppercase tracking-widest">Campeonato</h3></div>
          <span className="text-[11px] font-mono font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">S{championship.season} • R{championship.race}</span>
        </div>
        {!hasOffice ? (
          <div className="p-6 bg-transparent text-center" role="status" aria-live="polite">
            <p className="text-sm font-bold text-zinc-300">{getOfficeEmptyState().title}</p>
            <div className="mt-3 flex justify-center">{getOfficeEmptyState().href ? <a href={getOfficeEmptyState().href!} className="h-11 inline-flex items-center rounded-xl bg-white/[0.06] border border-white/10 px-6 text-xs font-black uppercase text-zinc-200"> {getOfficeEmptyState().action}</a> : <button onClick={onSync} disabled={isSyncing} className="h-11 inline-flex items-center rounded-xl bg-amber-600 px-6 text-xs font-black uppercase text-white disabled:opacity-50">Tentar novamente</button>}</div>
          </div>
        ) : (
          <div className="p-4 bg-transparent grid grid-cols-3 gap-3">
            <div className="text-center"><span className="text-[10px] text-zinc-400 font-black uppercase">Posição</span><p className="text-lg font-black font-mono text-emerald-300">{championship.position}</p></div>
            <div className="text-center"><span className="text-[10px] text-zinc-400 font-black uppercase">Pontos</span><p className="text-lg font-black font-mono text-amber-300">{championship.points}</p></div>
            <div className="text-center"><span className="text-[10px] text-zinc-400 font-black uppercase">Média</span><p className="text-sm font-black font-mono text-white">{championship.average}</p></div>
          </div>
        )}
      </div>
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="bg-[#0a0f1f] p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="p-1.5 bg-amber-600 rounded-lg"><Calendar size={14} className="text-white" /></div><h3 className="text-[11px] font-black text-white uppercase tracking-widest">Próxima Corrida</h3></div>
          <span className="text-[11px] font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">S{nextRace.season} • R{nextRace.race}</span>
        </div>
        {!hasOffice ? (
          <div className="p-6 bg-transparent text-center" role="status" aria-live="polite">
            <p className="text-sm font-bold text-zinc-300">{getOfficeEmptyState().title}</p>
          </div>
        ) : (
          <div className="p-4 bg-transparent">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center overflow-hidden">
                  {nextRace.track && getFlagUrlTrack(nextRace.track) ? <img src={getFlagUrlTrack(nextRace.track)!} alt={nextRace.track} className="w-8 h-6 object-cover rounded-sm" /> : <span>🏁</span>}
                </div>
                <p className="text-sm font-black text-white">{nextRace.track}</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <div className="flex-1 md:flex-none bg-white/[0.06] rounded-xl px-3 py-2 border border-white/10"><span className="text-[10px] text-zinc-400 font-black uppercase block">Treinos</span><p className={`text-xs font-black ${nextRace.donePractice==='1'?'text-emerald-300':'text-amber-300'}`}>{nextRace.donePractice==='1'?'Feito':'Pendente'}</p></div>
                <div className="flex-1 md:flex-none bg-white/[0.06] rounded-xl px-3 py-2 border border-white/10"><span className="text-[10px] text-zinc-400 font-black uppercase block">Qualificação</span><p className="text-xs font-black text-zinc-200">{nextRace.doneQ1==='1' && nextRace.doneQ2==='1'?'Completa':nextRace.doneQ1==='1'||nextRace.doneQ2==='1'?'Parcial':'Pendente'}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="bg-[#0a0f1f] p-3 border-b border-white/10 flex items-center gap-2"><Activity size={14} className="text-amber-400" /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Clima</h4></div>
        <div className="p-3 bg-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-lg" aria-hidden>{weather?.weatherRace === 'Wet' ? '🌧️' : '☀️'}</span><span className="text-sm font-black text-white">{weather?.weatherRace === 'Wet' ? 'Chuva' : 'Seca'}</span></div>
            <span className="text-xs font-black font-mono text-emerald-300">{weather?.tempQ2 ?? 0}°C</span>
          </div>
          <div className="flex gap-2 mt-1 text-xs font-mono text-zinc-400"><span>Q1: {weather?.tempQ1 ?? 0}°C</span><span>•</span><span>Q2: {weather?.tempQ2 ?? 0}°C</span></div>
        </div>
      </div>
    </div>
  );
}
