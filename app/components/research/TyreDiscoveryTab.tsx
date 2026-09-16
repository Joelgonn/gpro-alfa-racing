'use client';

import { useMemo } from 'react';
import { Activity, Gauge, Grid2x2, Layers3, MapPinned, Shield } from 'lucide-react';
import type { TyreLabResponse } from './tyre-types';

export function TyreDiscoveryTab({ data }: { data: TyreLabResponse }) {
  const discovery = data.knowledgePanel.discovery;
  const discoveryHighlights = [
    { label: 'Endpoints observados', value: discovery.totals.endpointCount, tone: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Eventos Discovery', value: discovery.summary.totalEvents, tone: 'text-slate-900', bg: 'bg-slate-50' },
    { label: 'Campos novos encontrados', value: discovery.totals.newFields, tone: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Mudanças estruturais', value: discovery.totals.schemaChanges, tone: 'text-rose-700', bg: 'bg-rose-50' },
    { label: 'Payloads distintos', value: data.header.observationCount, tone: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Fingerprints únicos', value: data.knowledgePanel.knowledgeSummary.uniqueFingerprintValues.length, tone: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Cobertura da base', value: `${data.overview.coverage}%`, tone: 'text-lime-700', bg: 'bg-lime-50' },
    { label: 'Snapshots', value: data.knowledgePanel.knowledgeSummary.totalSnapshots, tone: 'text-sky-700', bg: 'bg-sky-50' },
    { label: 'Evidence', value: data.knowledgePanel.knowledgeSummary.totalEvidences, tone: 'text-violet-700', bg: 'bg-violet-50' },
    { label: 'Observations', value: data.knowledgePanel.knowledgeSummary.totalObservations, tone: 'text-orange-700', bg: 'bg-orange-50' },
  ];

  const warningEvents = discovery.events.filter(event => event.severity === 'WARNING');
  const noticeEvents = discovery.events.filter(event => event.severity === 'NOTICE');
  const infoEvents = discovery.events.filter(event => event.severity === 'INFO');

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Discovery</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Insights canônicos da plataforma</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {discovery.summary.totalEvents} eventos
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {discoveryHighlights.map(card => (
            <div key={card.label} className={`rounded-2xl border border-slate-200 ${card.bg} p-4`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</p>
              <p className={`mt-2 text-3xl font-black ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Destaques</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Warnings</p>
              <p className="mt-2 text-3xl font-black text-rose-700">{warningEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notices</p>
              <p className="mt-2 text-3xl font-black text-amber-700">{noticeEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Infos</p>
              <p className="mt-2 text-3xl font-black text-emerald-700">{infoEvents.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Eventos em destaque</p>
          <div className="mt-5 space-y-3">
            {discovery.events.slice(0, 8).map((event, index) => (
              <div key={`${event.title}-${index}`} className={`rounded-2xl border p-4 ${event.severity === 'WARNING' ? 'border-rose-200 bg-rose-50' : event.severity === 'NOTICE' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{event.title}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{event.severity}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
