// app/lib/discovery-read-model.ts
// ============================================
// DISCOVERY READ MODEL
// ============================================
//
// Projeção estável para consumo da UI a partir do
// DiscoveryReport canônico.

import type { DiscoveryEvent, DiscoveryReport } from './discovery-engine';

export interface DiscoveryReadModelEvent {
  severity: DiscoveryEvent['severity'];
  title: string;
  description: string;
}

export interface DiscoveryReadModelSummary {
  totalEvents: number;
  infoCount: number;
  noticeCount: number;
  warningCount: number;
}

export interface DiscoveryReadModelTotals {
  endpointCount: number;
  schemaChanges: number;
  newEndpoints: number;
  newFields: number;
}

export interface DiscoveryReadModel {
  summary: DiscoveryReadModelSummary;
  events: DiscoveryReadModelEvent[];
  totals: DiscoveryReadModelTotals;
}

function buildTitle(event: DiscoveryEvent): string {
  const subjectLabel = event.subject === 'global' ? 'Geral' : event.subject;

  switch (event.type) {
    case 'new-endpoint':
      return `Novo endpoint: ${subjectLabel}`;
    case 'new-fields':
      return `Novos campos em ${subjectLabel}`;
    case 'structural-change':
      return `Mudança estrutural em ${subjectLabel}`;
    case 'payload-type-change':
      return `Mudança de tipo em ${subjectLabel}`;
    case 'duplicate-fingerprint':
      return 'Fingerprints duplicados';
    case 'payload-type-count':
      return 'Tipos de payload observados';
    default:
      return subjectLabel;
  }
}

export function createDiscoveryReadModel(report: DiscoveryReport): DiscoveryReadModel {
  const summary = report.discoveries.reduce<DiscoveryReadModelSummary>(
    (acc, event) => {
      acc.totalEvents += 1;

      if (event.severity === 'INFO') acc.infoCount += 1;
      if (event.severity === 'NOTICE') acc.noticeCount += 1;
      if (event.severity === 'WARNING') acc.warningCount += 1;

      return acc;
    },
    {
      totalEvents: 0,
      infoCount: 0,
      noticeCount: 0,
      warningCount: 0,
    }
  );

  const events = report.discoveries.map(event => ({
    severity: event.severity,
    title: buildTitle(event),
    description: event.description,
  }));

  const totals = report.discoveries.reduce<DiscoveryReadModelTotals>(
    (acc, event) => {
      const isEndpointEvent = event.category === 'endpoint';
      const isSchemaEvent = event.category === 'schema';

      if (event.type === 'new-endpoint') {
        acc.newEndpoints += 1;
      }

      if (event.type === 'new-fields') {
        acc.newFields += 1;
      }

      if (isSchemaEvent && (event.type === 'structural-change' || event.type === 'new-fields')) {
        acc.schemaChanges += 1;
      }

      if (isEndpointEvent || isSchemaEvent || event.category === 'payload' || event.category === 'fingerprint') {
        acc.endpointCount += event.subject === 'global' ? 0 : 1;
      }

      return acc;
    },
    {
      endpointCount: 0,
      schemaChanges: 0,
      newEndpoints: 0,
      newFields: 0,
    }
  );

  totals.endpointCount = Array.from(
    new Set(report.discoveries.filter(event => event.subject !== 'global').map(event => event.subject))
  ).length;

  return {
    summary,
    events,
    totals,
  };
}
