import {
  ExpoArchitecturalImprovement,
  ExpoConfigAudit,
  ExpoNavigationAudit,
  ExpoNavigationStyle,
  ExpoPerformanceAudit,
  ExpoSecurityAudit,
} from '../../../types/framework';

import { contentHasHardcodedSecret } from '../../secretDetectionHeuristics';

const PUBLIC_ENV_SECRET =
  /\b(?:EXPO_PUBLIC_|REACT_NATIVE_)[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|KEY)[A-Z0-9_]*\b/i;

const ASYNC_STORAGE_TOKEN =
  /\bAsyncStorage\.(?:setItem|getItem|multiSet)\s*\(\s*['"][^'"]*(?:token|auth|session|refresh|jwt|password|secret)[^'"]*['"]/i;

const SECURE_STORE = /\b(?:SecureStore|expo-secure-store)\b/;

const WEAK_SESSION_STORAGE =
  /\b(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\(\s*['"][^'"]*(?:token|auth|session|refresh|jwt|password|secret)[^'"]*['"]|FileSystem\.(?:writeAsStringAsync|write)\s*\([^)]*(?:token|auth|session|refresh|jwt|password|secret)/i;

const CLEARTEXT_HTTP =
  /\bfetch\s*\(\s*['"]http:\/\/(?!localhost|127\.0\.0\.1|10\.|192\.168\.)[^'"]+['"]|\baxios\.(?:get|post|put|patch|delete|request)\s*\(\s*['"]http:\/\/(?!localhost|127\.0\.0\.1)/i;

export const VALIDATION_SIGNAL =
  /\b(?:z\.|valibot|yup|zod|schema\.parse|safeParse|parseAsync)\b/i;

const AUTH_HEADER_SIGNAL =
  /\b(?:Authorization|Bearer|getToken|accessToken|SecureStore\.getItemAsync|auth(?:Token|Header)|session)\b/i;

const HEAVY_CLIENT_LIBS =
  /\bfrom\s*['"](?:three|@react-three\/fiber|chart\.js|recharts|d3|monaco-editor|@monaco-editor\/react|leaflet|mapbox-gl|react-native-maps|victory-native|gifted-charts)['"]/i;

const OPEN_DEEP_LINK =
  /\b(?:Linking\.openURL|WebBrowser\.openBrowserAsync|WebBrowser\.openAuthSessionAsync|openAuthSessionAsync)\s*\(\s*(?:[^)]*(?:params|searchParams|route\.|useLocalSearchParams|query|href))/i;

const DEEP_LINK_ALLOWLIST =
  /\b(?:startsWith\s*\(\s*['"](?:https?:\/\/|[\w+-]+:)|allowedHosts|ALLOW(?:ED)?_HOST|originWhitelist|canOpenURL)/i;

const UNTRUSTED_WEBVIEW =
  /<(?:WebView|webview)\b[^>]*(?:source\s*=\s*\{\s*\{\s*uri\s*:\s*(?:[^}]*(?:params|searchParams|route|uri\s*=))|source=\{\{[^}]*uri:\s*(?:props|param))/i;

const ANDROID_BACKUP_TRUE =
  /android:allowBackup\s*=\s*["']true["']|allowBackup\s*:\s*true|"allowBackup"\s*:\s*true/i;

const ANDROID_BACKUP_FALSE =
  /android:allowBackup\s*=\s*["']false["']|allowBackup\s*:\s*false|"allowBackup"\s*:\s*false/i;

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
  const openDeepLinkFiles: string[] = [];
  const untrustedWebViewFiles: string[] = [];

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

    if (contentHasHardcodedSecret(path, content)) {
      hardcodedSecretFiles.push(path);
      improvements.push({
        id: `security-hardcoded-secret-${path}`,
        category: 'security',
        severity: 'critical',
        title: `Hardcoded Secret-like Value in ${fileName(path)}`,
        impact: `${path} appears to embed a high-confidence secret/token literal in mobile source that ships to every install.`,
        remediation: 'Move secrets off-device (backend / secret manager). Rotate any value that was committed.',
        file: path,
      });
    }

    // Open redirect analogue: deep links / browser sessions from params
    if (OPEN_DEEP_LINK.test(content) && !DEEP_LINK_ALLOWLIST.test(content)) {
      openDeepLinkFiles.push(path);
      improvements.push({
        id: `security-open-deeplink-${path}`,
        category: 'security',
        severity: 'warning',
        title: `User-Controlled Deep Link in ${fileName(path)}`,
        impact: `${path} opens a URL from route/params without an obvious scheme/host allowlist. Malicious links can phish or leave the app unexpectedly.`,
        remediation: 'Allowlist https hosts / custom schemes before Linking.openURL / WebBrowser; reject unexpected URLs.',
        file: path,
      });
    }

    if (
      (UNTRUSTED_WEBVIEW.test(content) ||
        (/<WebView\b/.test(content) &&
          /uri\s*:/.test(content) &&
          /\b(?:params|searchParams|route\.|useLocalSearchParams)\b/.test(content))) &&
      !/\boriginWhitelist\s*=\s*\{\s*\[\s*['"]https?:\/\//.test(content)
    ) {
      untrustedWebViewFiles.push(path);
      improvements.push({
        id: `security-webview-uri-${path}`,
        category: 'security',
        severity: 'warning',
        title: `WebView Loads Untrusted URI in ${fileName(path)}`,
        impact: `${path} feeds a WebView uri from params/state without a tight originWhitelist. Untrusted pages can steal session data.`,
        remediation: 'Only load allowlisted https origins; set a restrictive originWhitelist and disable JS if not required.',
        file: path,
      });
    }

    // Client API mutation hygiene (Next API route analogue on device)
    const mutatesApi =
      /\b(?:fetch|axios)\s*\([\s\S]{0,200}(?:method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)|['"](?:POST|PUT|PATCH|DELETE)['"])/i.test(
        content,
      ) ||
      /\baxios\.(?:post|put|patch|delete)\s*\(/.test(content);
    const looksApiCall =
      /['"`][^'"`]*(?:\/api\/|EXPO_PUBLIC_.*URL|API_URL|BASE_URL)/i.test(content) ||
      /\bfetch\s*\(/.test(content);
    if (mutatesApi && looksApiCall && !VALIDATION_SIGNAL.test(content) && content.split(/\r\n|\n|\r/).length > 40) {
      improvements.push({
        id: `security-api-unvalidated-${path}`,
        category: 'security',
        severity: 'optimization',
        title: `API Mutation Without Client Validation (${fileName(path)})`,
        impact: `${path} POSTs/PUTs JSON without an obvious schema validator. Invalid payloads waste network and confuse backends.`,
        remediation: 'Validate request bodies with Zod/Yup before fetch/axios, matching your API contract.',
        file: path,
      });
    }
    if (
      looksApiCall &&
      mutatesApi &&
      !AUTH_HEADER_SIGNAL.test(content) &&
      !/(?:login|signin|signup|register|public|oauth)/i.test(path) &&
      content.split(/\r\n|\n|\r/).length > 40
    ) {
      improvements.push({
        id: `security-api-no-auth-${path}`,
        category: 'security',
        severity: 'warning',
        title: `Protected API Call Without Auth Signal (${fileName(path)})`,
        impact: `${path} mutates a backend API without an Authorization/Bearer/SecureStore token signal.`,
        remediation: 'Attach a Bearer token (from SecureStore) or session header on authenticated API calls.',
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
    openDeepLinkFiles,
    untrustedWebViewFiles,
    issueCount:
      asyncStorageTokenFiles.length +
      secretInPublicEnvFiles.length +
      hardcodedSecretFiles.length +
      weakSessionStorageFiles.length +
      cleartextNetworkFiles.length +
      openDeepLinkFiles.length +
      untrustedWebViewFiles.length,
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

  // Lint / typecheck quality gates (Next/Remix/Node parity)
  let missingLintScript = false;
  let missingTypecheckSignal = false;
  const rootPkg =
    manifests['package.json'] ||
    Object.entries(manifests).find(([p]) => /(^|\/)package\.json$/i.test(p.replace(/\\/g, '/')))?.[1];
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg) as { scripts?: Record<string, string> };
      const scriptBlob = Object.entries(pkg.scripts || {})
        .map(([name, cmd]) => `${name} ${cmd}`)
        .join('\n');
      missingLintScript = !/\b(?:lint|eslint)\b/i.test(scriptBlob);
      missingTypecheckSignal =
        !/\b(?:type-?check|tsc\b)\b/i.test(scriptBlob) &&
        !normalizedPaths.some(path => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(path));
    } catch {
      // ignore
    }
  }
  if (missingLintScript) {
    improvements.push({
      id: 'config-missing-lint-script',
      category: 'config-delivery',
      severity: 'optimization',
      title: 'No Lint Script in package.json',
      impact: 'Without a lint script, contributors and CI lack a standard quality gate for Expo/RN code.',
      remediation: 'Add an ESLint (expo/eslint-config) lint script and run it in CI.',
      file: 'package.json',
    });
  }
  if (missingTypecheckSignal) {
    improvements.push({
      id: 'config-missing-typecheck',
      category: 'config-delivery',
      severity: 'warning',
      title: 'No Typecheck Signal Detected',
      impact: 'TypeScript Expo apps without tsc/typecheck miss navigation and API typing regressions.',
      remediation: 'Add a typecheck script (`tsc --noEmit`) and run it in CI.',
      file: 'package.json',
    });
  }

  // Android backup vs secure token storage
  const usesSecureStore = Object.values(sourceContents).some(c => SECURE_STORE.test(c || ''));
  const configAllowsBackup = ANDROID_BACKUP_TRUE.test(configContent);
  const configDisallowsBackup = ANDROID_BACKUP_FALSE.test(configContent);
  const androidBackupRisk = Boolean(usesSecureStore && configAllowsBackup && !configDisallowsBackup);
  if (androidBackupRisk) {
    improvements.push({
      id: 'config-android-backup-tokens',
      category: 'security',
      severity: 'warning',
      title: 'Android Backup Enabled With Secure Token Storage',
      impact:
        'The app uses SecureStore/token storage but Android allowBackup appears true. Backups can exfiltrate app data on some devices.',
      remediation: 'Set `android.allowBackup: false` (or equivalent manifest flag) for apps that store auth material on device.',
      file: configPath,
    });
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
    missingLintScript,
    missingTypecheckSignal,
    androidBackupRisk,
    issueCount: [
      !hasAppConfig,
      missingScheme,
      missingSplashOrIcon,
      sdkMajor !== undefined && sdkMajor > 0 && sdkMajor < 49,
      updatesIssue,
      newArchDisabled,
      missingPrivacyDescriptions.length > 0,
      easIssue,
      missingLintScript,
      missingTypecheckSignal,
      androidBackupRisk,
    ].filter(Boolean).length,
  };
}

export function auditExpoPerformance(
  normalizedPaths: string[],
  sourceContents: Record<string, string>,
  improvements: ExpoArchitecturalImprovement[],
): ExpoPerformanceAudit {
  const flatListWithoutOptimizationFiles: string[] = [];
  const imageWithoutExpoImageFiles: string[] = [];

  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (/(^|\/)(?:node_modules|android|ios)\//i.test(path)) continue;

    // Heavy libs at app root / layout (Next heavy-client analogue)
    const isRootish =
      /(^|\/)(?:app\/_layout|App|src\/App|app\/\(tabs\)\/_layout)\.(?:jsx?|tsx?)$/i.test(path) ||
      collectExpoEntryFiles(normalizedPaths).includes(path);
    if (isRootish && HEAVY_CLIENT_LIBS.test(content) && !/\b(?:React\.lazy|lazy\s*\(|import\s*\()/i.test(content)) {
      improvements.push({
        id: `perf-heavy-root-${path}`,
        category: 'performance',
        severity: 'optimization',
        title: `Heavy Library at App Root (${fileName(path)})`,
        impact: `${path} imports maps/charts/3D libraries at the root layout. That inflates startup JS for every screen.`,
        remediation: 'Lazy-load heavy screens with React.lazy / dynamic import so root stays thin.',
        file: path,
      });
    }

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

  // Large screens without local error boundary (Next segment error.tsx analogue) — batched
  const missingScreenErrorBoundaries: string[] = [];
  for (const [path, content] of Object.entries(sourceContents)) {
    if (!isSourceFile(path) || !content) continue;
    if (/(^|\/)(?:node_modules|android|ios)\//i.test(path)) continue;
    const lines = content.split(/\r\n|\n|\r/).length;
    const isScreen =
      /(^|\/)(?:app|screens|src\/screens)\//i.test(path) &&
      !/_layout\./i.test(path) &&
      !/error\./i.test(path);
    if (
      isScreen &&
      lines > 80 &&
      !/\bErrorBoundary\b|react-error-boundary/.test(content) &&
      !normalizedPaths.some(
        p =>
          p !== path &&
          p.replace(/\/[^/]+$/, '/') === path.replace(/\/[^/]+$/, '/') &&
          /error\.(?:jsx?|tsx?)$/i.test(p),
      )
    ) {
      missingScreenErrorBoundaries.push(path);
    }
  }
  if (missingScreenErrorBoundaries.length >= 3) {
    improvements.push({
      id: 'perf-missing-screen-error-boundaries',
      category: 'performance',
      severity: 'optimization',
      title: `Missing Error Boundaries on ${missingScreenErrorBoundaries.length} Large Screens`,
      impact: `Screens like ${missingScreenErrorBoundaries
        .slice(0, 3)
        .map(fileName)
        .join(', ')}${missingScreenErrorBoundaries.length > 3 ? ', …' : ''} have no local ErrorBoundary/error route. Render failures can blank larger parts of the navigator.`,
      remediation: 'Add route-level error.tsx (Expo Router) or wrap critical screens in ErrorBoundary.',
      file: missingScreenErrorBoundaries[0],
    });
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
    issueCount:
      flatListWithoutOptimizationFiles.length +
      imageWithoutExpoImageFiles.length +
      (missingScreenErrorBoundaries.length >= 3 ? 1 : 0),
  };
}
