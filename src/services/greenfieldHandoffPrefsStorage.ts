import { HandoffTarget } from './handoffExportService';
import { IDETarget } from '../types/project';

const STORAGE_KEY = 'blueprint_handoff_prefs_v1';

type StoredTarget = {
  name: string;
  path: string;
  kind: HandoffTarget['kind'];
};

type PrefsMap = Record<
  string,
  {
    ide?: IDETarget;
    target?: StoredTarget;
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
      ? { name: entry.target.name, path: entry.target.path, kind: entry.target.kind }
      : undefined,
  };
}

export function saveHandoffPrefs(
  projectId: string,
  patch: { ide?: IDETarget; target?: HandoffTarget | null },
) {
  const map = readMap();
  const prev = map[projectId] ?? {};
  map[projectId] = {
    ide: patch.ide ?? prev.ide,
    target: patch.target === null ? undefined : patch.target
      ? { name: patch.target.name, path: patch.target.path, kind: patch.target.kind }
      : prev.target,
  };
  writeMap(map);
}
