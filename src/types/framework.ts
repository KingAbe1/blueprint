export type FrameworkId =
  | 'nextjs'
  | 'remix'
  | 'vite'
  | 'express'
  | 'fastapi'
  | 'nestjs'
  | 'go-fiber'
  | 'django'
  | 'generic';

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
  detect(source: { paths: string[]; manifests: Record<string, string> }): boolean;
  analyze(source: {
    paths: string[];
    manifests: Record<string, string>;
    sourceContents?: Record<string, string>;
  }): FrameworkProfile<TSpecialization>;
}
