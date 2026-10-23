import {
  APP_VERSION,
  DISMISSED_UPDATE_STORAGE_KEY,
  LATEST_RELEASE_API_URL,
  RELEASES_PAGE_URL,
  UPDATE_CHECK_SESSION_KEY,
} from '../constants/appRelease';
import { isDesktopApp } from '../utils/platform';

export interface AppReleaseInfo {
  version: string;
  name: string;
  htmlUrl: string;
  publishedAt?: string;
  body?: string;
}

export type UpdateCheckResult =
  | { status: 'up_to_date'; currentVersion: string; latest: AppReleaseInfo }
  | { status: 'update_available'; currentVersion: string; latest: AppReleaseInfo }
  | { status: 'unavailable'; currentVersion: string; message: string };

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '').split(/[-+]/)[0] || '';
}

/** Compare dotted semver cores (major.minor.patch). Returns 1 if a>b, -1 if a<b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const left = normalizeVersion(a).split('.').map(part => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split('.').map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length, 3);
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

export async function getInstalledAppVersion(): Promise<string> {
  if (isDesktopApp()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const version = await getVersion();
      if (version?.trim()) return normalizeVersion(version);
    } catch {
      // Fall through to bundled constant (web / API unavailable).
    }
  }
  return normalizeVersion(APP_VERSION);
}

export function getDismissedUpdateVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_UPDATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdateVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_UPDATE_STORAGE_KEY, normalizeVersion(version));
  } catch {
    // ignore quota / private mode
  }
}

export function clearDismissedUpdateVersion(): void {
  try {
    localStorage.removeItem(DISMISSED_UPDATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasCheckedUpdatesThisSession(): boolean {
  try {
    return sessionStorage.getItem(UPDATE_CHECK_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markUpdatesCheckedThisSession(): void {
  try {
    sessionStorage.setItem(UPDATE_CHECK_SESSION_KEY, '1');
  } catch {
    // ignore
  }
}

async function fetchLatestRelease(): Promise<AppReleaseInfo> {
  const response = await fetch(LATEST_RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'No published releases found yet.'
        : `Could not reach GitHub releases (${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    tag_name?: string;
    name?: string;
    html_url?: string;
    published_at?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
  };

  if (data.draft) {
    throw new Error('Latest release is still a draft.');
  }

  const version = normalizeVersion(data.tag_name || data.name || '');
  if (!version) {
    throw new Error('Latest release has no version tag.');
  }

  return {
    version,
    name: (data.name || `v${version}`).trim(),
    htmlUrl: data.html_url || `${RELEASES_PAGE_URL}/tag/v${version}`,
    publishedAt: data.published_at,
    body: data.body,
  };
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getInstalledAppVersion();
  try {
    const latest = await fetchLatestRelease();
    if (compareSemver(latest.version, currentVersion) > 0) {
      return { status: 'update_available', currentVersion, latest };
    }
    return { status: 'up_to_date', currentVersion, latest };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check for updates.';
    return { status: 'unavailable', currentVersion, message };
  }
}

export function shouldPromptForUpdate(result: UpdateCheckResult): boolean {
  if (result.status !== 'update_available') return false;
  const dismissed = getDismissedUpdateVersion();
  if (!dismissed) return true;
  return compareSemver(result.latest.version, dismissed) > 0;
}
