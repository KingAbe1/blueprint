import { SUPPORTED_IDES } from '../constants/supportedIdes';

const STORAGE_KEY = 'blueprint_system_preferences_v1';
const LEGACY_IDE_KEY = 'blueprint:preferred-ide';

export interface SystemPreferences {
  notificationSoundEnabled: boolean;
  osNotificationsEnabled: boolean;
  preferredIdeId: string;
  /** When true, reopen the last project/view on launch; when false, land on home. */
  resumeWhereLeftOff: boolean;
}

const DEFAULTS: SystemPreferences = {
  notificationSoundEnabled: true,
  osNotificationsEnabled: true,
  preferredIdeId: 'vscode',
  resumeWhereLeftOff: true,
};

function normalizeIdeId(id: string | undefined): string {
  if (id && SUPPORTED_IDES.some(ide => ide.id === id)) return id;
  return DEFAULTS.preferredIdeId;
}

export function readSystemPreferences(): SystemPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SystemPreferences>;
      return {
        notificationSoundEnabled: parsed.notificationSoundEnabled ?? DEFAULTS.notificationSoundEnabled,
        osNotificationsEnabled: parsed.osNotificationsEnabled ?? DEFAULTS.osNotificationsEnabled,
        preferredIdeId: normalizeIdeId(parsed.preferredIdeId),
        resumeWhereLeftOff: parsed.resumeWhereLeftOff ?? DEFAULTS.resumeWhereLeftOff,
      };
    }
  } catch {
    // fall through
  }

  let preferredIdeId = DEFAULTS.preferredIdeId;
  try {
    const legacy = localStorage.getItem(LEGACY_IDE_KEY);
    if (legacy) preferredIdeId = normalizeIdeId(legacy);
  } catch {
    // ignore
  }

  return { ...DEFAULTS, preferredIdeId };
}

export function persistSystemPreferences(prefs: SystemPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(LEGACY_IDE_KEY, prefs.preferredIdeId);
  } catch {
    // ignore quota errors
  }
}
