// app/lib/knowledge-timeline.ts
// ============================================
// KNOWLEDGE TIMELINE
// ============================================
//
// KnowledgeTimeline recebe múltiplas KnowledgeSession
// e organiza a evolução temporal em memória.
// Nesta sprint não realiza comparações.

import type { KnowledgeSession } from './knowledge-session';

export interface KnowledgeTimeline {
  sessions: KnowledgeSession[];
  createdAt: string;
}

export function createKnowledgeTimeline(): KnowledgeTimeline {
  return {
    sessions: [],
    createdAt: new Date().toISOString(),
  };
}

export function appendSession(timeline: KnowledgeTimeline, session: KnowledgeSession) {
  timeline.sessions.push(session);
}

export function getLatestSession(timeline: KnowledgeTimeline): KnowledgeSession | undefined {
  return timeline.sessions[timeline.sessions.length - 1];
}
