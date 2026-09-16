'use client';

import type { FuelLabResponse } from './fuel-types';

function HighlightCard({ label, value, tone, bg }: { label: string; value: string | number; tone: string; bg: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bg} p-4`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function FuelDiscoveryTab({ data }: { data: FuelLabResponse }) {
  const discovery = data.knowledgePanel.discovery;
  const audit = data.knowledgePanel.auditSummary;
  const discoveryHighlights = [
    { label: 'Endpoints observados', value: discovery.totals.endpointCount, tone: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Eventos Discovery', value: discovery.summary.totalEvents, tone: 'text-slate-900', bg: 'bg-slate-50' },
    { label: 'Campos auditados', value: data.overview.fieldsAudited, tone: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Sinais de combustível', value: data.overview.fuelSignals, tone: 'text-rose-700', bg: 'bg-rose-50' },
    { label: 'Snapshots', value: audit.totalSnapshots, tone: 'text-sky-700', bg: 'bg-sky-50' },
    { label: 'Campos 100%', value: audit.fieldsIn100Percent.length, tone: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Cobertura da base', value: `${data.overview.coverage}%`, tone: 'text-lime-700', bg: 'bg-lime-50' },
    { label: 'Observações', value: data.header.observationCount, tone: 'text-orange-700', bg: 'bg-orange-50' },
  ];

  const warningEvents = discovery.events.filter(event => event.severity === 'WARNING');
  const noticeEvents = discovery.events.filter(event => event.severity === 'NOTICE');
  const infoEvents = discovery.events.filter(event => event.severity === 'INFO');

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Discovery</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Insights canônicos e auditados</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {discovery.summary.totalEvents} eventos
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {discoveryHighlights.map(card => (
            <HighlightCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Resumo da auditoria</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Snapshots analisados</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{audit.totalSnapshots}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campos auditados</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{data.overview.fieldsAudited}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campos com 100%</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{audit.fieldsIn100Percent.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sinais relacionados</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{data.overview.fuelSignals}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endpoints com sinais</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {audit.endpointsWithSignals.length > 0 ? audit.endpointsWithSignals.map(endpoint => (
                <span key={endpoint} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                  {endpoint}
                </span>
              )) : <span className="text-sm text-slate-500">Dados insuficientes</span>}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campos mais frequentes</p>
            <div className="mt-3 space-y-2">
              {audit.fieldAudit.slice(0, 12).map(field => (
                <div key={field.path} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">{field.path}</span>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">{field.coverage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Eventos em destaque</p>
          <div className="mt-5 space-y-3">
            {discovery.events.slice(0, 8).map((event, index) => (
              <div
                key={`${event.title}-${index}`}
                className={`rounded-2xl border p-4 ${
                  event.severity === 'WARNING' ? 'border-rose-200 bg-rose-50' : event.severity === 'NOTICE' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">{event.title}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{event.severity}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{event.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Warnings</p>
              <p className="mt-2 text-3xl font-black text-rose-700">{warningEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Notices</p>
              <p className="mt-2 text-3xl font-black text-amber-700">{noticeEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Infos</p>
              <p className="mt-2 text-3xl font-black text-emerald-700">{infoEvents.length}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
