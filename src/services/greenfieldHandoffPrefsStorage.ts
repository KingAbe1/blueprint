import { HandoffTarget } from './handoffExportService';
import { IDETarget } from '../types/project';

const STORAGE_KEY = 'blueprint_handoff_prefs_v1';

type StoredTauriTarget = {
  name: string;
  path: string;
  kind: 'tauri';
};

type PrefsMap = Record<
  string,
  {
    ide?: IDETarget;
    target?: StoredTauriTarget;
  }
>;

function readMap(): PrefsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PrefsMap;
  } catch {
    return {};
  }
}

function writeMap(map: PrefsMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

export function loadHandoffPrefs(projectId: string): { ide?: IDETarget; target?: HandoffTarget } {
  const entry = readMap()[projectId];
  if (!entry) return {};
  return {
    ide: entry.ide,
    target: entry.target
      ? { name: entry.target.name, path: entry.target.path, kind: 'tauri' as const }
      : undefined,
  };
}

export function saveHandoffPrefs(
  projectId: string,
  patch: { ide?: IDETarget; target?: HandoffTarget | null },
) {
  const map = readMap();
  const prev = map[projectId] ?? {};
  let nextTarget = prev.target;
  if (patch.target === null) {
    nextTarget = undefined;
  } else if (patch.target?.kind === 'tauri') {
    nextTarget = { name: patch.target.name, path: patch.target.path, kind: 'tauri' };
  }
  map[projectId] = {
    ide: patch.ide ?? prev.ide,
    target: nextTarget,
  };
  writeMap(map);
}
