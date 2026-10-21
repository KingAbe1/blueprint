import {
  ExpoArchitecturalImprovement,
  ExpoConfigAudit,
  ExpoNavigationAudit,
  ExpoNavigationStyle,
  ExpoPerformanceAudit,
  ExpoSecurityAudit,
} from '../../../types/framework';

const HARDCODED_SECRET =
  /(?:(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"])|(?:['"]sk-(?:live|test)[_-][A-Za-z0-9]{16,}['"])/i;

const PUBLIC_ENV_SECRET =
  /\b(?:EXPO_PUBLIC_|REACT_NATIVE_)[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|KEY)[A-Z0-9_]*\b/i;

const ASYNC_STORAGE_TOKEN =
  /\bAsyncStorage\.(?:setItem|getItem|multiSet)\s*\(\s*['"][^'"]*(?:token|auth|session|refresh|jwt|password|secret)[^'"]*['"]/i;

const SECURE_STORE = /\b(?:SecureStore|expo-secure-store)\b/;

const WEAK_SESSION_STORAGE =
  /\b(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\(\s*['"][^'"]*(?:token|auth|session|refresh|jwt|password|secret)[^'"]*['"]|FileSystem\.(?:writeAsStringAsync|write)\s*\([^)]*(?:token|auth|session|refresh|jwt|password|secret)/i;

const CLEARTEXT_HTTP =
  /\bfetch\s*\(\s*['"]http:\/\/(?!localhost|127\.0\.0\.1|10\.|192\.168\.)[^'"]+['"]|\baxios\.(?:get|post|put|patch|delete|request)\s*\(\s*['"]http:\/\/(?!localhost|127\.0\.0\.1)/i;

const SENSITIVE_API_USAGE: Array<{ api: RegExp; iosKey: string; label: string }> = [
  { api: /\b(?:expo-camera|Camera\.|useCameraPermissions)\b/, iosKey: 'NSCameraUsageDescription', label: 'camera' },
  { api: /\b(?:expo-image-picker|ImagePicker\.)\b/, iosKey: 'NSPhotoLibraryUsageDescription', label: 'photo library' },
  { api: /\b(?:expo-location|Location\.)\b/, iosKey: 'NSLocationWhenInUseUsageDescription', label: 'location' },
  { api: /\b(?:expo-contacts|Contacts\.)\b/, iosKey: 'NSContactsUsageDescription', label: 'contacts' },
  { api: /\b(?:expo-av|Audio\.|Video\.)\b/, iosKey: 'NSMicrophoneUsageDescription', label: 'microphone' },
];

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

function isSourceFile(path: string): boolean {
  return /\.(?:js|jsx|ts|tsx)$/i.test(path) && !/\.(?:test|spec|d)\.[^/]+$/i.test(path);
}

export function detectExpoSdkVersion(manifests: Record<string, string>): string | undefined {
  for (const [path, content] of Object.entries(manifests)) {
    if (!/(^|\/)package\.json$/i.test(path.replace(/\\/g, '/'))) continue;
    try {
      const parsed = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const raw =
        parsed.dependencies?.expo ||
        parsed.devDependencies?.expo ||
        parsed.dependencies?.['expo-router'] ||
        parsed.dependencies?.['react-native'];
      if (typeof raw === 'string') return raw.replace(/^[^0-9]*/, '').split(/[^\d.]/)[0] || raw;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function collectExpoEntryFiles(normalizedPaths: string[]): string[] {
  const preferred = normalizedPaths.filter(path =>
    /(^|\/)(?:app\/_layout|app\/index|App|index|src\/App)\.(?:jsx?|tsx?)$/i.test(path),
  );
  return [...new Set(preferred)].slice(0, 12);
}

export function auditExpoNavigation(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  improvements: ExpoArchitecturalImprovement[],
): ExpoNavigationAudit {
  const depBlob = Object.entries(manifests)
    .filter(([p]) => /(^|\/)package\.json$/i.test(p.replace(/\\/g, '/')))
    .map(([, c]) => c)
    .join('\n');

  const usesExpoRouter =
    /"expo-router"\s*:/.test(depBlob) ||
    normalizedPaths.some(p => /(^|\/)app\/_layout\.(?:jsx?|tsx?)$/i.test(p));
  const usesReactNavigation =
    /"@react-navigation\//.test(depBlob) ||
    Object.values(sourceContents).some(c => /@react-navigation\//.test(c || ''));

  let style: ExpoNavigationStyle = 'not-identified';
  if (usesExpoRouter && usesReactNavigation) style = 'mixed';
  else if (usesExpoRouter) style = 'expo-router';
  else if (usesReactNavigation) style = 'react-navigation';

  const routeFiles = normalizedPaths.filter(
    path =>
      (/(^|\/)app\/.+\.(?:jsx?|tsx?)$/i.test(path) && !/\/_layout\./i.test(path) && isSourceFile(path)) ||
      /(?:screens?|routes?)\/.+\.(?:jsx?|tsx?)$/i.test(path),
  );

  const rootLayout = normalizedPaths.find(path => /(^|\/)app\/_layout\.(?:jsx?|tsx?)$/i.test(path));
  const hasRootLayout = Boolean(rootLayout);
  const rootContent = rootLayout ? sourceContents[rootLayout] || '' : '';
  const hasErrorBoundary =
    /\bErrorBoundary\b|\berror\.tsx\b|ErrorBoundaryProps|expo-router\/.*error/i.test(
      Object.values(sourceContents).join('\n') + rootContent,
    ) || normalizedPaths.some(p => /(^|\/)app\/\+?error\.(?:jsx?|tsx?)$/i.test(p));

  let issueCount = 0;

  if (usesExpoRouter && !hasRootLayout) {
    issueCount += 1;
    improvements.push({
      id: 'nav-missing-root-layout',
      category: 'navigation',
      severity: 'warning',
      title: 'Expo Router Without app/_layout',
      impact: 'expo-router is present but no app/_layout entry was found. Shared providers, fonts, and navigation chrome usually live there.',
      remediation: 'Add app/_layout.tsx as the root layout wrapping Stack/Tabs and shared providers.',
      file: 'app/_layout.tsx',
    });
  }

  if ((usesExpoRouter || usesReactNavigation) && !hasErrorBoundary) {
    issueCount += 1;
    improvements.push({
      id: 'nav-missing-error-boundary',
      category: 'navigation',
      severity: 'warning',
      title: 'No Navigation Error Boundary',
      impact: 'Without an error boundary / app/error route, render failures can white-screen the whole app.',
      remediation: 'Add an ErrorBoundary (React Navigation) or app/error.tsx / +error (Expo Router) with a recoverable UI.',
      file: rootLayout || routeFiles[0],
    });
  }

  if (style === 'not-identified' && routeFiles.length === 0) {
    issueCount += 1;
    improvements.push({
      id: 'nav-not-identified',
      category: 'navigation',
      severity: 'optimization',
      title: 'Navigation Style Not Identified',
      impact: 'No expo-router or React Navigation signals were found. Mobile apps without a clear navigator are harder to scale.',
      remediation: 'Adopt Expo Router (file-based) or React Navigation and keep screens under app/ or screens/.',
    });
  }

  return {
    style,
    routeFileCount: routeFiles.length,
    hasRootLayout,
    hasErrorBoundary,
    issueCount,
  };
}

export function auditExpoSecurity(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  improvements: ExpoArchitecturalImprovement[],
): ExpoSecurityAudit {
  const asyncStorageTokenFiles: string[] = [];
  const secretInPublicEnvFiles: string[] = [];
  const hardcodedSecretFiles: string[] = [];
  const weakSessionStorageFiles: string[] = [];
  const cleartextNetworkFiles: string[] = [];

  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (/(^|\/)(?:node_modules|dist|build|android|ios)\//i.test(path)) continue;

    if (ASYNC_STORAGE_TOKEN.test(content) && !SECURE_STORE.test(content)) {
      asyncStorageTokenFiles.push(path);
      improvements.push({
        id: `security-async-storage-token-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Auth Token in AsyncStorage (${fileName(path)})`,
        impact: `${path} appears to store auth/session tokens in AsyncStorage, which is not encrypted on device.`,
        remediation: 'Store tokens with expo-secure-store (or a hardware-backed keystore). Use AsyncStorage only for non-sensitive preferences.',
        file: path,
      });
    }

    if (WEAK_SESSION_STORAGE.test(content) && !SECURE_STORE.test(content)) {
      weakSessionStorageFiles.push(path);
      improvements.push({
        id: `security-weak-session-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Weak Auth Session Storage in ${fileName(path)}`,
        impact: `${path} appears to persist auth/session material via localStorage/sessionStorage or plaintext FileSystem writes.`,
        remediation: 'Keep tokens in expo-secure-store (or memory + refresh). Never write secrets to localStorage or plain files.',
        file: path,
      });
    }

    if (CLEARTEXT_HTTP.test(content) || /\busesCleartextTraffic\s*:\s*true/.test(content)) {
      cleartextNetworkFiles.push(path);
      improvements.push({
        id: `security-cleartext-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Cleartext HTTP Traffic in ${fileName(path)}`,
        impact: `${path} calls http:// (non-local) or enables cleartext traffic. Mobile OSes block or warn on unencrypted requests, and traffic can be intercepted.`,
        remediation: 'Use https:// for all production APIs. Avoid usesCleartextTraffic / ATS exceptions except for local dev.',
        file: path,
      });
    }

    if (PUBLIC_ENV_SECRET.test(content)) {
      secretInPublicEnvFiles.push(path);
      improvements.push({
        id: `security-public-env-secret-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Secret-like EXPO_PUBLIC_ Env in ${fileName(path)}`,
        impact: `${path} references EXPO_PUBLIC_/REACT_NATIVE_ env vars that look secret-like. Public env vars are embedded in the client bundle.`,
        remediation: 'Keep secrets on a backend. Only put intentionally public values in EXPO_PUBLIC_* variables.',
        file: path,
      });
    }

    if (HARDCODED_SECRET.test(content) && !/\.env|example|fixture|mock|test/i.test(path)) {
      hardcodedSecretFiles.push(path);
      improvements.push({
        id: `security-hardcoded-secret-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Hardcoded Secret-like Value in ${fileName(path)}`,
        impact: `${path} appears to embed a long secret/token literal in mobile source that ships to every install.`,
        remediation: 'Move secrets off-device (backend / secret manager). Rotate any value that was committed.',
        file: path,
      });
    }
  }

  const committedEnv = normalizedPaths.filter(path => {
    const base = path.split('/').pop() || path;
    if (/^\.env\.example$/i.test(base) || /^\.env\.sample$/i.test(base)) return false;
    return /^\.env(?:\.[A-Za-z0-9_-]+)?$/i.test(base);
  });
  for (const envPath of committedEnv.slice(0, 4)) {
    hardcodedSecretFiles.push(envPath);
    improvements.push({
      id: `security-committed-env-${envPath}`,
      category: 'security',
      severity: 'critical',
      title: `Committed Env File (${fileName(envPath)})`,
      impact: `${envPath} looks like a real env file in the tree. Mobile repos often leak API keys this way.`,
      remediation: 'Remove from git, add to .gitignore, rotate secrets, keep only `.env.example`.',
      file: envPath,
    });
  }

  // App config cleartext flags
  for (const path of normalizedPaths.filter(p => /(^|\/)app\.(?:json|config\.(?:js|ts))$/i.test(p))) {
    const content = sourceContents[path] || '';
    if (!content) continue;
    if (/usesCleartextTraffic\s*:\s*true|"usesCleartextTraffic"\s*:\s*true|NSAllowsArbitraryLoads\s*:\s*true/.test(content)) {
      cleartextNetworkFiles.push(path);
      improvements.push({
        id: `security-cleartext-config-${path}`,
        category: 'security',
        severity: 'warning',
        title: 'Cleartext Traffic Allowed in App Config',
        impact: `${path} enables cleartext / arbitrary HTTP loads. That weakens transport security for release builds.`,
        remediation: 'Disable cleartext traffic for production; keep HTTPS-only ATS / network security config.',
        file: path,
      });
    }
  }

  return {
    asyncStorageTokenFiles,
    secretInPublicEnvFiles,
    hardcodedSecretFiles,
    weakSessionStorageFiles,
    cleartextNetworkFiles,
    issueCount:
      asyncStorageTokenFiles.length +
      secretInPublicEnvFiles.length +
      hardcodedSecretFiles.length +
      weakSessionStorageFiles.length +
      cleartextNetworkFiles.length,
  };
}

export function auditExpoConfig(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  manifests: Record<string, string>,
  sdkMajor: number | undefined,
  improvements: ExpoArchitecturalImprovement[],
): ExpoConfigAudit {
  const appJson = normalizedPaths.find(p => /(^|\/)app\.(?:json|config\.(?:js|ts))$/i.test(p));
  const configPath = appJson;
  const configContent =
    (configPath && (sourceContents[configPath] || manifests[configPath])) ||
    manifests['app.json'] ||
    manifests['app.config.js'] ||
    '';

  const depBlob = Object.entries(manifests)
    .filter(([p]) => /(^|\/)package\.json$/i.test(p.replace(/\\/g, '/')))
    .map(([, c]) => c)
    .join('\n');
  const usesExpoRouter = /"expo-router"\s*:/.test(depBlob);
  const hasAppConfig = Boolean(configPath) || Boolean(configContent);

  let missingScheme = false;
  let missingSplashOrIcon = false;

  if (hasAppConfig && configContent) {
    missingScheme = !/"scheme"\s*:/.test(configContent) && !/\bscheme\s*:/.test(configContent);
    const hasIcon = /\bicon\b/.test(configContent);
    const hasSplash = /\bsplash\b/.test(configContent);
    missingSplashOrIcon = !hasIcon || !hasSplash;
  } else if (!hasAppConfig) {
    missingSplashOrIcon = true;
    improvements.push({
      id: 'config-missing-app-config',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No app.json / app.config Found',
      impact: 'Expo apps need app config for name, icons, splash, scheme, and store metadata.',
      remediation: 'Add app.json or app.config.ts with name, slug, icon, splash, and scheme.',
    });
  }

  if (missingScheme && hasAppConfig) {
    improvements.push({
      id: 'config-missing-scheme',
      category: 'config-delivery',
      severity: 'warning',
      title: 'Missing Deep Link Scheme',
      impact: 'No URL scheme was found in app config. Auth redirects and deep links often break without it.',
      remediation: 'Set `scheme` in app.json / app.config (and matching iOS/Android intent filters).',
      file: configPath,
    });
  }

  if (missingSplashOrIcon && hasAppConfig) {
    improvements.push({
      id: 'config-missing-splash-icon',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'Missing Splash or Icon Config',
      impact: 'App config is missing icon and/or splash settings, which store listings and first-launch UX rely on.',
      remediation: 'Configure `icon` and `splash` (or expo-splash-screen) in app config.',
      file: configPath,
    });
  }

  if (sdkMajor !== undefined && sdkMajor > 0 && sdkMajor < 49) {
    improvements.push({
      id: 'modernization-old-sdk',
      category: 'modernization',
      severity: 'warning',
      title: `Older Expo SDK Detected (${sdkMajor})`,
      impact: `Expo SDK ${sdkMajor} is far behind current releases and may miss security and store requirement updates.`,
      remediation: 'Upgrade toward a supported Expo SDK using the Expo upgrade guide, then re-test iOS/Android builds.',
      file: 'package.json',
    });
  }

  // OTA / expo-updates
  const hasExpoUpdatesDep = /"expo-updates"\s*:/.test(depBlob);
  const updatesEnabled =
    /updates\s*:\s*\{[\s\S]{0,400}?enabled\s*:\s*true|"updates"\s*:\s*\{[\s\S]{0,400}?"enabled"\s*:\s*true/.test(
      configContent,
    );
  const updatesDisabled =
    /updates\s*:\s*\{[\s\S]{0,400}?enabled\s*:\s*false|"updates"\s*:\s*\{[\s\S]{0,400}?"enabled"\s*:\s*false/.test(
      configContent,
    );
  const hasRuntimeVersion =
    /\bruntimeVersion\b|"runtimeVersion"\s*:/.test(configContent) ||
    /\bexpo-updates\b/.test(Object.values(sourceContents).join('\n').slice(0, 50000));
  const updatesIssue =
    (!hasExpoUpdatesDep && hasAppConfig) ||
    updatesDisabled ||
    (hasExpoUpdatesDep && !hasRuntimeVersion && !updatesEnabled);
  if (!hasExpoUpdatesDep && hasAppConfig) {
    improvements.push({
      id: 'config-missing-expo-updates',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'expo-updates Not Installed',
      impact: 'Without expo-updates, you cannot ship OTA JS fixes without a full store rebuild.',
      remediation: 'Add expo-updates, set runtimeVersion, and enable updates for release channels you control.',
      file: 'package.json',
    });
  } else if (updatesDisabled) {
    improvements.push({
      id: 'config-updates-disabled',
      category: 'config-delivery',
      severity: 'warning',
      title: 'OTA Updates Disabled in App Config',
      impact: 'updates.enabled is false. Production apps cannot pull emergency JS patches over-the-air.',
      remediation: 'Enable updates for production builds (or document why OTA is intentionally off) and set runtimeVersion.',
      file: configPath,
    });
  } else if (hasExpoUpdatesDep && !hasRuntimeVersion) {
    improvements.push({
      id: 'config-missing-runtime-version',
      category: 'config-delivery',
      severity: 'warning',
      title: 'expo-updates Without runtimeVersion',
      impact: 'expo-updates is present but no runtimeVersion was found. Mismatched native/JS runtimes can crash after OTA.',
      remediation: 'Set runtimeVersion in app config (policy or explicit string) aligned with your EAS update channels.',
      file: configPath,
    });
  }

  // New Architecture
  const newArchTrue = /newArchEnabled\s*:\s*true|"newArchEnabled"\s*:\s*true/.test(configContent);
  const newArchFalse = /newArchEnabled\s*:\s*false|"newArchEnabled"\s*:\s*false/.test(configContent);
  const newArchDisabled =
    Boolean(hasAppConfig && sdkMajor !== undefined && sdkMajor >= 51 && !newArchTrue) || newArchFalse;
  if (newArchDisabled && hasAppConfig) {
    improvements.push({
      id: 'modernization-new-arch',
      category: 'modernization',
      severity: 'optimization',
      title: newArchFalse ? 'New Architecture Explicitly Disabled' : 'New Architecture Not Enabled',
      impact: 'Recent Expo SDKs encourage the New Architecture for Fabric/TurboModules performance and library support.',
      remediation: 'Set newArchEnabled: true in app config after validating native modules, then rebuild with EAS.',
      file: configPath,
    });
  }

  // Privacy / usage description strings vs used APIs
  const sourceBlob = Object.values(sourceContents).join('\n');
  const missingPrivacyDescriptions: string[] = [];
  for (const entry of SENSITIVE_API_USAGE) {
    if (!entry.api.test(sourceBlob)) continue;
    const hasDesc =
      configContent.includes(entry.iosKey) ||
      new RegExp(`infoPlist[\\s\\S]{0,800}${entry.iosKey}`).test(configContent) ||
      new RegExp(`${entry.iosKey}\\s*:`).test(configContent);
    if (!hasDesc) {
      missingPrivacyDescriptions.push(entry.iosKey);
      improvements.push({
        id: `permissions-missing-usage-${entry.iosKey}`,
        category: 'permissions',
        severity: 'warning',
        title: `Missing ${entry.iosKey}`,
        impact: `The project uses ${entry.label} APIs but app config does not declare ${entry.iosKey}. iOS will reject or crash permission prompts without it.`,
        remediation: `Add ${entry.iosKey} (and Android equivalents) under ios.infoPlist / app config plugins with a clear user-facing purpose string.`,
        file: configPath,
      });
    }
  }

  // EAS build profile
  const easPath = normalizedPaths.find(p => /(^|\/)eas\.json$/i.test(p));
  const easContent = easPath ? sourceContents[easPath] || manifests[easPath] || manifests['eas.json'] || '' : '';
  let easIssue = false;
  if (!easPath && !manifests['eas.json']) {
    easIssue = true;
    improvements.push({
      id: 'config-missing-eas',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No eas.json Found',
      impact: 'Without EAS Build profiles, iOS/Android release builds are harder to reproduce and automate.',
      remediation: 'Add eas.json with development, preview, and production profiles (eas build:configure).',
      file: 'eas.json',
    });
  } else if (easContent) {
    const hasProduction = /"production"\s*:/.test(easContent);
    const productionLooksThin =
      hasProduction &&
      !/"env"\s*:/.test(easContent) &&
      !/"autoIncrement"\s*:/.test(easContent) &&
      !/"channel"\s*:/.test(easContent);
    if (!hasProduction) {
      easIssue = true;
      improvements.push({
        id: 'config-eas-no-production',
        category: 'config-delivery',
        severity: 'warning',
        title: 'EAS Missing production Profile',
        impact: 'eas.json has no production profile. Store builds often need a dedicated profile for credentials and channels.',
        remediation: 'Add a production profile with channel/runtimeVersion and any required env keys.',
        file: easPath || 'eas.json',
      });
    } else if (productionLooksThin) {
      easIssue = true;
      improvements.push({
        id: 'config-eas-production-thin',
        category: 'config-delivery',
        severity: 'optimization',
        title: 'EAS production Profile Looks Sparse',
        impact: 'The production EAS profile has no obvious env, channel, or autoIncrement settings.',
        remediation: 'Document production env vars, set an update channel, and consider autoIncrement for store builds.',
        file: easPath || 'eas.json',
      });
    }
  }

  return {
    configFile: configPath,
    usesExpoRouter,
    hasAppConfig,
    missingScheme,
    missingSplashOrIcon,
    sdkMajor,
    updatesIssue,
    newArchDisabled,
    missingPrivacyDescriptions,
    easIssue,
    issueCount: [
      !hasAppConfig,
      missingScheme,
      missingSplashOrIcon,
      sdkMajor !== undefined && sdkMajor > 0 && sdkMajor < 49,
      updatesIssue,
      newArchDisabled,
      missingPrivacyDescriptions.length > 0,
      easIssue,
    ].filter(Boolean).length,
  };
}

export function auditExpoPerformance(
  _normalizedPaths: string[],
  sourceContents: Record<string, string>,
  improvements: ExpoArchitecturalImprovement[],
): ExpoPerformanceAudit {
  const flatListWithoutOptimizationFiles: string[] = [];
  const imageWithoutExpoImageFiles: string[] = [];

  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (/(^|\/)(?:node_modules|android|ios)\//i.test(path)) continue;

    if (/\bFlatList\b/.test(content)) {
      const missingKey = !/\bkeyExtractor\b/.test(content);
      const missingVirtualHint =
        !/\bgetItemLayout\b/.test(content) &&
        !/\bwindowSize\b/.test(content) &&
        !/\binitialNumToRender\b/.test(content) &&
        !/\bremoveClippedSubviews\b/.test(content);
      if (missingKey || (content.split(/\bFlatList\b/).length > 2 && missingVirtualHint)) {
        flatListWithoutOptimizationFiles.push(path);
        improvements.push({
          id: `perf-flatlist-${path}`,
          category: 'performance',
          severity: 'optimization',
          title: `FlatList Tuning Missing in ${fileName(path)}`,
          impact: `${path} uses FlatList without keyExtractor and/or common virtualization props. Large lists can jank on low-end devices.`,
          remediation: 'Always set keyExtractor. For long lists, set initialNumToRender/windowSize and prefer getItemLayout when row height is fixed.',
          file: path,
        });
      }
    }

    if (
      /\bImage\b/.test(content) &&
      /from\s*['"]react-native['"]/.test(content) &&
      !/expo-image|from\s*['"]expo-image['"]/.test(content) &&
      /\bsource\s*=\s*\{\s*\{\s*uri\s*:/.test(content)
    ) {
      imageWithoutExpoImageFiles.push(path);
      improvements.push({
        id: `perf-image-${path}`,
        category: 'performance',
        severity: 'optimization',
        title: `Remote Image via RN Image in ${fileName(path)}`,
        impact: `${path} loads remote URIs with React Native Image. expo-image caches and transitions more efficiently for most Expo apps.`,
        remediation: 'Prefer `expo-image` for remote images (caching, placeholders, blurhash).',
        file: path,
      });
    }
  }

  // Permissions without usage description hints in config are hard; flag Contacts/Camera imports lightly
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (
      /\b(?:expo-camera|expo-image-picker|expo-location|expo-contacts|Camera\.|Location\.|ImagePicker\.)\b/.test(
        content,
      ) &&
      !/\brequest(?:Camera|MediaLibrary|Foreground)?Permissions|get(?:Camera|MediaLibrary)?Permissions|PermissionStatus\b/.test(
        content,
      )
    ) {
      improvements.push({
        id: `permissions-no-request-${path}`,
        category: 'permissions',
        severity: 'warning',
        title: `Sensitive API Without Permission Request (${fileName(path)})`,
        impact: `${path} uses camera/location/contacts/picker APIs without an obvious permission request call.`,
        remediation: 'Request and handle permission status before invoking the API; add usage strings in app config.',
        file: path,
      });
    }
  }

  return {
    flatListWithoutOptimizationFiles,
    imageWithoutExpoImageFiles,
    issueCount: flatListWithoutOptimizationFiles.length + imageWithoutExpoImageFiles.length,
  };
}
