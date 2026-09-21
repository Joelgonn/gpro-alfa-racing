'use client';
import { Calendar } from 'lucide-react';

type Props = {
  track: string;
  season: string;
  race: string;
  donePractice: string;
  doneQ1: string;
  doneQ2: string;
  weather: { tempQ1: number; tempQ2: number; weatherQ1?: string; weatherQ2?: string; weatherRace: string } | null;
  getFlagUrlTrack: (t: string) => string | null;
  hasOffice: boolean;
};

function weatherLabel(value?: string | null) {
  if (!value) return '—';
  const v = String(value).toLowerCase();
  if (v.includes('wet') || v.includes('rain') || v.includes('chuva')) return 'Chuva';
  if (v.includes('cloud') || v.includes('nublado')) return 'Nublado';
  if (v === 'dry' || v.includes('dry') || v.includes('seca') || v.includes('sun')) return 'Seca';
  return String(value);
}

function weatherIcon(value?: string | null) {
  const v = String(value || '').toLowerCase();
  if (v.includes('wet') || v.includes('rain') || v.includes('chuva')) return '🌧️';
  if (v.includes('cloud') || v.includes('nublado')) return '⛅';
  return '☀️';
}

function hasValue(v: unknown) {
  return v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '0' || typeof v === 'number';
}

export function NextRaceHero({ track, season, race, donePractice, doneQ1, doneQ2, weather, getFlagUrlTrack, hasOffice }: Props) {
  if (!hasOffice) {
    return (
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden p-6 text-center shadow-sm">
        <p className="text-sm font-bold text-slate-600">Próxima corrida ainda não disponível. Sincronize seus dados.</p>
      </div>
    );
  }

  const practiceDone = donePractice === '1';
  const qualiDone = doneQ1 === '1' && doneQ2 === '1';
  const qualiPartial = doneQ1 === '1' || doneQ2 === '1';

  const q1Temp = weather?.tempQ1;
  const q2Temp = weather?.tempQ2;
  // temperatura da corrida: usa tempQ2 como fallback se não houver campo específico
  const raceTemp = weather?.tempQ2 ?? weather?.tempQ1;

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-white p-3.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 rounded-lg"><Calendar size={14} className="text-white" /></div>
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Próxima Corrida</h3>
        </div>
        <span className="text-[11px] font-mono font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">S{season} • R{race}</span>
      </div>
      <div className="p-5 md:p-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center overflow-hidden shrink-0">
              {track && getFlagUrlTrack(track) ? (
                <img src={getFlagUrlTrack(track)!} alt={track} className="w-10 h-7 object-cover rounded-sm" />
              ) : (
                <span className="text-2xl">🏁</span>
              )}
            </div>
            <div>
              <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{track || 'N/A'}</p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Temporada {season} — Etapa {race}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase border ${practiceDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              Treinos {practiceDone ? '✓' : '—'}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase border ${qualiDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : qualiPartial ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              Quali {qualiDone ? '✓' : qualiPartial ? '½' : '—'}
            </span>
          </div>
        </div>

        {/* Clima explícito por etapa */}
        <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Q1</p>
            <p className="mt-1 text-lg" aria-hidden>{weatherIcon(weather?.weatherQ1)}</p>
            <p className="text-[11px] font-bold text-slate-700">{weatherLabel(weather?.weatherQ1)}</p>
            <p className="text-xs font-black font-mono text-slate-900">{hasValue(q1Temp) ? `${q1Temp}°C` : '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Q2</p>
            <p className="mt-1 text-lg" aria-hidden>{weatherIcon(weather?.weatherQ2)}</p>
            <p className="text-[11px] font-bold text-slate-700">{weatherLabel(weather?.weatherQ2)}</p>
            <p className="text-xs font-black font-mono text-slate-900">{hasValue(q2Temp) ? `${q2Temp}°C` : '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-amber-50 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Corrida</p>
            <p className="mt-1 text-lg" aria-hidden>{weatherIcon(weather?.weatherRace)}</p>
            <p className="text-[11px] font-bold text-slate-700">{weatherLabel(weather?.weatherRace)}</p>
            <p className="text-xs font-black font-mono text-slate-900">{hasValue(raceTemp) ? `${raceTemp}°C` : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
