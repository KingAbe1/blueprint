import { useSyncExternalStore } from 'react';
import type { CodebaseAnalysis } from '../types/codebase';
import { collectFixItems, type FixPromptItem } from './fixPromptService';

/** Compact record of one scan, kept apart from the project list so history never bloats it. */
export interface ScanSnapshot {
  scannedAt: number;
  score: number | null;
  findings: Array<{ key: string; title: string; priority: FixPromptItem['priority']; file?: string }>;
  counts: { total: number; high: number; medium: number; low: number; cves: number };
}

export interface ScanDiff {
  previous: ScanSnapshot;
  current: ScanSnapshot;
  scoreDelta: number | null;
  added: ScanSnapshot['findings'];
  resolved: ScanSnapshot['findings'];
}

const STORAGE_KEY = 'blueprint_scan_history_v1';
/** Per-project cap. Old scans fall off the front. */
export const MAX_SNAPSHOTS = 20;
const MAX_FINDINGS_PER_SNAPSHOT = 300;

type HistoryStore = Record<string, ScanSnapshot[]>;

const listeners = new Set<() => void>();
let cache: HistoryStore | null = null;
const EMPTY: ScanSnapshot[] = [];

function readStore(): HistoryStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function writeStore(next: HistoryStore) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory history for this session rather than failing a scan.
  }
  listeners.forEach(listener => listener());
}

/**
 * Stable identity for a finding across scans. Line numbers are left out on purpose:
 * an agent's edits shift lines, and that should not make an unchanged issue look "new".
 */
export function findingKey(item: Pick<FixPromptItem, 'title' | 'file' | 'category'>): string {
  return `${item.category}|${item.title}|${item.file || ''}`;
}

export function snapshotFromAnalysis(analysis: CodebaseAnalysis): ScanSnapshot {
  const items = collectFixItems(analysis);
  const seen = new Set<string>();
  const findings: ScanSnapshot['findings'] = [];
  for (const item of items) {
    const key = findingKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ key, title: item.title, priority: item.priority, ...(item.file ? { file: item.file } : {}) });
  }
  return {
    scannedAt: analysis.scannedAt,
    score: typeof analysis.quality?.score === 'number' ? analysis.quality.score : null,
    findings: findings.slice(0, MAX_FINDINGS_PER_SNAPSHOT),
    counts: {
      total: items.length,
      high: items.filter(i => i.priority === 'high').length,
      medium: items.filter(i => i.priority === 'medium').length,
      low: items.filter(i => i.priority === 'low').length,
      cves: analysis.dependencyRisk?.advisories?.length || 0,
    },
  };
}

/**
 * Save this scan. A later update with the same `scannedAt` (CVE audit finishing, AI review)
 * replaces that snapshot instead of adding a new one.
 */
export function recordScanSnapshot(projectId: string, analysis: CodebaseAnalysis) {
  if (!projectId || !analysis?.scannedAt) return;
  const store = readStore();
  const snapshot = snapshotFromAnalysis(analysis);
  const existing = store[projectId] || [];
  const withoutSame = existing.filter(s => s.scannedAt !== snapshot.scannedAt);
  const next = [...withoutSame, snapshot].sort((a, b) => a.scannedAt - b.scannedAt).slice(-MAX_SNAPSHOTS);
  const unchanged =
    existing.length === next.length && JSON.stringify(existing) === JSON.stringify(next);
  if (unchanged) return;
  writeStore({ ...store, [projectId]: next });
}

export function clearScanHistory(projectId: string) {
  const store = readStore();
  if (!store[projectId]) return;
  const next = { ...store };
  delete next[projectId];
  writeStore(next);
}

export function getScanHistory(projectId: string | undefined): ScanSnapshot[] {
  if (!projectId) return EMPTY;
  return readStore()[projectId] || EMPTY;
}

export function diffSnapshots(previous: ScanSnapshot, current: ScanSnapshot): ScanDiff {
  const previousKeys = new Set(previous.findings.map(f => f.key));
  const currentKeys = new Set(current.findings.map(f => f.key));
  return {
    previous,
    current,
    scoreDelta: previous.score !== null && current.score !== null ? current.score - previous.score : null,
    added: current.findings.filter(f => !previousKeys.has(f.key)),
    resolved: previous.findings.filter(f => !currentKeys.has(f.key)),
  };
}

/** Diff of the shown scan against the scan before it, or null for a first scan. */
export function diffForScan(history: ScanSnapshot[], scannedAt: number): ScanDiff | null {
  const index = history.findIndex(s => s.scannedAt === scannedAt);
  if (index <= 0) return null;
  return diffSnapshots(history[index - 1], history[index]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Live scan history for a project. */
export function useScanHistory(projectId: string | undefined): ScanSnapshot[] {
  return useSyncExternalStore(subscribe, () => getScanHistory(projectId), () => EMPTY);
}
