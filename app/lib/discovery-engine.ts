// app/lib/discovery-engine.ts
// ============================================
// DISCOVERY ENGINE
// ============================================
//
// Serviço puro para descobrir fatos objetivos a
// partir de uma KnowledgeSession.
// Sem IA, heurísticas ou inferências.

import type { KnowledgeSession } from './knowledge-session';

export type DiscoverySeverity = 'INFO' | 'NOTICE' | 'WARNING';

export interface DiscoveryEvent {
  type: string;
  category: 'schema' | 'endpoint' | 'fingerprint' | 'payload';
  subject: string;
  metadata: Record<string, string | number | string[] | number[]>;
  description: string;
  severity: DiscoverySeverity;
}

export interface DiscoveryReport {
  discoveries: DiscoveryEvent[];
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function pushEvent(discoveries: DiscoveryEvent[], event: DiscoveryEvent) {
  discoveries.push(event);
}

function getSchemaAt(session: KnowledgeSession, index: number) {
  return session.schemas[index];
}

/**
 * Descobre fatos objetivos sem alterar estado e sem
 * qualquer dependência externa.
 */
export function createDiscoveryReport(session: KnowledgeSession): DiscoveryReport {
  const discoveries: DiscoveryEvent[] = [];
  const endpointGroups = new Map<string, number[]>();

  session.observations.forEach((observation, index) => {
    const current = endpointGroups.get(observation.endpoint) || [];
    current.push(index);
    endpointGroups.set(observation.endpoint, current);
  });

  endpointGroups.forEach((indexes, endpoint) => {
    if (indexes.length === 1) {
      pushEvent(discoveries, {
        type: 'new-endpoint',
        category: 'endpoint',
        subject: endpoint,
        metadata: {
          occurrenceCount: 1,
        },
        description: `Endpoint inédito identificado na sessão: ${endpoint}.`,
        severity: 'INFO',
      });
    }

    const schemas = indexes
      .map(index => getSchemaAt(session, index))
      .filter((schema): schema is NonNullable<typeof schema> => Boolean(schema));

    const flatFields = uniqueValues(
      schemas.flatMap(schema => schema.flatFieldList)
    );

    if (flatFields.length > 0) {
      pushEvent(discoveries, {
        type: 'new-fields',
        category: 'schema',
        subject: endpoint,
        metadata: {
          fieldCount: flatFields.length,
          fields: flatFields,
        },
        description: `Endpoint ${endpoint} possui ${flatFields.length} campos observados na sessão.`,
        severity: 'NOTICE',
      });
    }

    const recursiveFieldCounts = uniqueValues(
      schemas.map(schema => String(schema.recursiveFieldCount))
    );

    if (recursiveFieldCounts.length > 1) {
      pushEvent(discoveries, {
        type: 'structural-change',
        category: 'schema',
        subject: endpoint,
        metadata: {
          recursiveFieldCount: recursiveFieldCounts.map(value => Number(value)),
        },
        description: `Endpoint ${endpoint} apresentou ${recursiveFieldCounts.length} valores de recursiveFieldCount na mesma sessão.`,
        severity: 'WARNING',
      });
    }

    const payloadTypes = uniqueValues(
      schemas.map(schema => schema.payloadType)
    );

    if (payloadTypes.length > 1) {
      pushEvent(discoveries, {
        type: 'payload-type-change',
        category: 'payload',
        subject: endpoint,
        metadata: {
          payloadTypes,
        },
        description: `Endpoint ${endpoint} apresentou ${payloadTypes.length} tipos de payload na mesma sessão.`,
        severity: 'WARNING',
      });
    }
  });

  const fingerprintCounts = session.fingerprints.reduce<Record<string, number>>((acc, fingerprint) => {
    acc[fingerprint.value] = (acc[fingerprint.value] || 0) + 1;
    return acc;
  }, {});

  const duplicateFingerprintCount = Object.values(fingerprintCounts).filter(count => count > 1).length;

  if (duplicateFingerprintCount > 0) {
    pushEvent(discoveries, {
      type: 'duplicate-fingerprint',
      category: 'fingerprint',
      subject: 'global',
      metadata: {
        duplicateCount: duplicateFingerprintCount,
      },
      description: `A sessão contém ${duplicateFingerprintCount} fingerprints duplicados.`,
      severity: 'NOTICE',
    });
  }

  const seenPayloadTypes = uniqueValues(session.schemas.map(schema => schema.payloadType));

  if (seenPayloadTypes.length > 1) {
    pushEvent(discoveries, {
      type: 'payload-type-count',
      category: 'payload',
      subject: 'global',
      metadata: {
        payloadTypes: seenPayloadTypes,
      },
      description: `A sessão contém ${seenPayloadTypes.length} tipos de payload distintos.`,
      severity: 'INFO',
    });
  }

  return {
    discoveries,
  };
}
