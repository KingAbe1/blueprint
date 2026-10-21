/** Only IDs with a registered deep analyzer. Do not list planned frameworks here. */
export type FrameworkId = 'nextjs' | 'remix' | 'nodejs';

export interface UniversalRoute {
  path: string;
  pattern: string;
  type: 'page' | 'api' | 'action' | 'socket';
  method?: string;
  file: string;
  dynamicParams?: string[];
}

export interface UniversalBoundary {
  type: 'server' | 'client' | 'middleware' | 'edge' | 'hybrid';
  file: string;
  details?: string;
}

export type NextJsImprovementCategory =
  | 'action-hygiene'
  | 'api-hygiene'
  | 'bundle-optimization'
  | 'route-resilience'
  | 'config-delivery'
  | 'data-caching'
  | 'security'
  | 'seo-metadata'
  | 'modernization';

export type NextJsImprovementSeverity = 'critical' | 'warning' | 'optimization';

export interface NextJsArchitecturalImprovement {
  id: string;
  category: NextJsImprovementCategory;
  severity: NextJsImprovementSeverity;
  title: string;
  impact: string;
  remediation: string;
  file?: string;
  line?: number;
  codeContext?: string;
}

export interface NextJsActionAudit {
  totalActionsCount: number;
  actionFilesCount: number;
  unvalidatedFilesCount: number;
  unprotectedFilesCount: number;
  complexActionsCount: number;
  actionFiles: Array<{
    path: string;
    exportedActions: string[];
    lineCount: number;
    hasValidation: boolean;
    hasAuth: boolean;
  }>;
}

export interface NextJsApiAudit {
  routeHandlerCount: number;
  pagesApiCount: number;
  unvalidatedFilesCount: number;
  unprotectedFilesCount: number;
  auditedFiles: Array<{
    path: string;
    kind: 'route-handler' | 'pages-api';
    hasValidation: boolean;
    hasAuth: boolean;
  }>;
}

export interface NextJsBundleAudit {
  serverComponentsCount: number;
  clientComponentsCount: number;
  totalComponents: number;
  serverRatio: number; // 0 to 100
  clientRatio: number; // 0 to 100
  unnecessaryClientFiles: string[];
  rawImgTagFiles?: string[];
  missingNextFont?: boolean;
  sharpMissingWithImages?: boolean;
}

export interface NextJsResilienceAudit {
  hasRootLayout: boolean;
  hasRootLoading: boolean;
  hasRootError: boolean;
  hasRootNotFound: boolean;
  hasGlobalError?: boolean;
  layoutCount: number;
  loadingCount: number;
  errorCount: number;
  notFoundCount: number;
  missingLoadingSegments: string[];
  missingErrorSegments: string[];
}

export interface NextJsConfigAudit {
  configFile?: string;
  ignoreBuildErrors: boolean;
  ignoreDuringBuilds: boolean;
  hasSecurityHeaders: boolean;
  hasStandaloneOutput: boolean;
  openImageRemotePatterns: boolean;
  missingLintScript: boolean;
  missingTypecheckSignal: boolean;
  issueCount: number;
}

export interface NextJsCachingAudit {
  forceDynamicFiles: string[];
  zeroRevalidateFiles: string[];
  uncachedFetchFiles: string[];
  syncRequestApiFiles: string[];
  dynamicRoutesMissingStaticParams: string[];
  issueCount: number;
}

export interface NextJsSecurityAudit {
  serverImportInClientFiles: string[];
  secretEnvInClientFiles: string[];
  middlewareWithoutAuth: boolean;
  middlewareFile?: string;
  issueCount: number;
}

export interface NextJsSeoAudit {
  hasRootMetadata: boolean;
  hasRobotsFile: boolean;
  hasSitemapFile: boolean;
  pagesMissingMetadata: string[];
  issueCount: number;
}

export interface NextJsSpecialization {
  router: 'App Router' | 'Pages Router' | 'Both routers' | 'Router not identified';
  version?: string;
  majorVersion?: number;
  actionAudit: NextJsActionAudit;
  /** Present on scans after the deep Next.js audit expansion; panel defaults when missing. */
  apiAudit?: NextJsApiAudit;
  bundleAudit: NextJsBundleAudit;
  resilienceAudit: NextJsResilienceAudit;
  configAudit?: NextJsConfigAudit;
  cachingAudit?: NextJsCachingAudit;
  securityAudit?: NextJsSecurityAudit;
  seoAudit?: NextJsSeoAudit;
  improvements: NextJsArchitecturalImprovement[];
  routeGroups: string[];
  parallelRoutes: string[];
  interceptingRoutes: string[];
  dynamicRoutesCount: number;
}

export type RemixImprovementCategory =
  | 'loader-hygiene'
  | 'action-hygiene'
  | 'route-resilience'
  | 'bundle-optimization'
  | 'config-delivery'
  | 'security'
  | 'seo-metadata'
  | 'modernization';

export type RemixImprovementSeverity = 'critical' | 'warning' | 'optimization';

export interface RemixArchitecturalImprovement {
  id: string;
  category: RemixImprovementCategory;
  severity: RemixImprovementSeverity;
  title: string;
  impact: string;
  remediation: string;
  file?: string;
  line?: number;
}

export interface RemixLoaderActionFileAudit {
  path: string;
  hasLoader: boolean;
  hasAction: boolean;
  hasClientLoader: boolean;
  hasClientAction: boolean;
  isResourceRoute: boolean;
  lineCount: number;
  hasValidation: boolean;
  hasAuth: boolean;
}

export interface RemixMutationAudit {
  totalHandlers: number;
  filesCount: number;
  unvalidatedFilesCount: number;
  unprotectedFilesCount: number;
  complexFilesCount: number;
  /** Loaders that appear to mutate state (CSRF-class smell). */
  mutatingFilesCount?: number;
  files: RemixLoaderActionFileAudit[];
}

export interface RemixResilienceAudit {
  hasRoot: boolean;
  hasRootErrorBoundary: boolean;
  hasRootLayoutExport: boolean;
  routeErrorBoundaryCount: number;
  missingErrorBoundaryRoutes: string[];
  hasHydrateFallback: boolean;
}

export interface RemixBundleAudit {
  clientLoaderCount: number;
  clientActionCount: number;
  routeModuleCount: number;
  heavyClientRouteFiles: string[];
}

export interface RemixConfigAudit {
  configFile?: string;
  usesVite: boolean;
  usesClassicCompiler: boolean;
  hasSingleFetchFlag: boolean;
  usesLegacyJsonDefer: boolean;
  missingLintScript: boolean;
  missingTypecheckSignal: boolean;
  issueCount: number;
}

export interface RemixSecurityAudit {
  secretEnvInClientFiles: string[];
  serverImportInClientFiles: string[];
  serverModuleLeakFiles?: string[];
  missingSecurityHeaders?: boolean;
  entryServerFile?: string;
  unsignedCookieFiles?: string[];
  openRedirectFiles?: string[];
  secretInLoaderReturnFiles?: string[];
  issueCount: number;
}

export interface RemixSeoAudit {
  hasRootMeta: boolean;
  hasRootLinks: boolean;
  routesMissingMeta: string[];
  issueCount: number;
}

export interface RemixSpecialization {
  version?: string;
  majorVersion?: number;
  routingStyle: 'flat-routes' | 'nested-folders' | 'mixed' | 'not-identified';
  loaderAudit: RemixMutationAudit;
  actionAudit: RemixMutationAudit;
  resilienceAudit: RemixResilienceAudit;
  bundleAudit: RemixBundleAudit;
  configAudit: RemixConfigAudit;
  securityAudit: RemixSecurityAudit;
  seoAudit: RemixSeoAudit;
  improvements: RemixArchitecturalImprovement[];
  resourceRouteCount: number;
  dynamicRoutesCount: number;
}

export type NodeJsRuntimeStyle =
  | 'express'
  | 'fastify'
  | 'koa'
  | 'hono'
  | 'nestjs'
  | 'node-http'
  | 'mixed'
  | 'not-identified';

export type NodeJsImprovementCategory =
  | 'route-hygiene'
  | 'middleware'
  | 'error-handling'
  | 'config-delivery'
  | 'security'
  | 'async-hygiene'
  | 'modernization';

export type NodeJsImprovementSeverity = 'critical' | 'warning' | 'optimization';

export interface NodeJsArchitecturalImprovement {
  id: string;
  category: NodeJsImprovementCategory;
  severity: NodeJsImprovementSeverity;
  title: string;
  impact: string;
  remediation: string;
  file?: string;
  line?: number;
}

export interface NodeJsRouteFileAudit {
  path: string;
  methodCount: number;
  lineCount: number;
  hasValidation: boolean;
  hasAuth: boolean;
}

export interface NodeJsRouteAudit {
  totalHandlers: number;
  filesCount: number;
  unvalidatedFilesCount: number;
  unprotectedFilesCount: number;
  files: NodeJsRouteFileAudit[];
}

export interface NodeJsMiddlewareAudit {
  helmetOrHeadersPresent: boolean;
  corsPresent: boolean;
  rateLimitPresent: boolean;
  errorMiddlewarePresent: boolean;
  /** Express/Fastify looks reverse-proxied but trust proxy is unset. */
  missingTrustProxy?: boolean;
  issueCount: number;
}

export interface NodeJsResilienceAudit {
  hasUncaughtExceptionHandler: boolean;
  hasUnhandledRejectionHandler: boolean;
  hasGracefulShutdownSignal: boolean;
  issueCount: number;
}

export interface NodeJsConfigAudit {
  hasEnginesField: boolean;
  isEsm: boolean;
  missingLintScript: boolean;
  missingTypecheckSignal: boolean;
  /** engines.node major appears EOL (≤18 as of 2025+). */
  eolNodeEngine?: boolean;
  /** Committed secret env files found in the tree (not .env.example). */
  committedEnvFiles?: string[];
  issueCount: number;
}

export interface NodeJsSecurityAudit {
  missingHelmetOrHeaders: boolean;
  permissiveCorsFiles: string[];
  dangerousPatternFiles: string[];
  openRedirectFiles: string[];
  hardcodedSecretFiles: string[];
  weakCookieFiles?: string[];
  unboundedUploadFiles?: string[];
  errorLeakFiles?: string[];
  sqlInjectionFiles?: string[];
  pathTraversalFiles?: string[];
  webhookUnsignedFiles?: string[];
  weakJwtFiles?: string[];
  dependencyFootguns?: string[];
  issueCount: number;
}

export interface NodeJsSpecialization {
  version?: string;
  majorVersion?: number;
  runtimeStyle: NodeJsRuntimeStyle;
  routeAudit: NodeJsRouteAudit;
  middlewareAudit: NodeJsMiddlewareAudit;
  resilienceAudit: NodeJsResilienceAudit;
  configAudit: NodeJsConfigAudit;
  securityAudit: NodeJsSecurityAudit;
  improvements: NodeJsArchitecturalImprovement[];
  entryFiles: string[];
}

export interface FrameworkProfile<TSpecialization = unknown> {
  id: FrameworkId;
  name: string;
  version?: string;
  ecosystem: 'node' | 'python' | 'go' | 'rust';
  routingModel: 'file-system' | 'code-based' | 'declarative' | 'api-only';
  routes: UniversalRoute[];
  boundaries: UniversalBoundary[];
  stats: Record<string, number | string>;
  specialization: TSpecialization;
}

export interface FrameworkAnalyzer<TSpecialization = unknown> {
  id: FrameworkId;
  name: string;
  detect(source: {
    paths: string[];
    manifests: Record<string, string>;
    sourceContents?: Record<string, string>;
  }): boolean;
  analyze(source: {
    paths: string[];
    manifests: Record<string, string>;
    sourceContents?: Record<string, string>;
  }): FrameworkProfile<TSpecialization>;
}
