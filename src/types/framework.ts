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

export interface NextJsComponentDistribution {
  serverComponentsCount: number;
  clientComponentsCount: number;
  totalComponents: number;
  serverRatio: number; // 0 to 100
  clientRatio: number; // 0 to 100
  clientComponentFiles: string[];
}

export interface NextJsServerActionFile {
  path: string;
  exportedActions: string[];
  lineCount: number;
}

export interface NextJsServerActionsOverview {
  totalActionsCount: number;
  actionFilesCount: number;
  actionFiles: NextJsServerActionFile[];
}

export interface NextJsBoundaryHealth {
  hasRootLayout: boolean;
  hasRootLoading: boolean;
  hasRootError: boolean;
  hasRootNotFound: boolean;
  layoutCount: number;
  loadingCount: number;
  errorCount: number;
  notFoundCount: number;
  middlewareFiles: string[];
  requestBoundaryNote?: string;
}

export interface NextJsModernization {
  version?: string;
  majorVersion?: number;
  isNext14OrHigher: boolean;
  isNext15OrHigher: boolean;
  isNext16OrHigher: boolean;
  deprecatedMiddlewareDetected: boolean;
  legacyPagesRouterCount: number;
  appRouterCount: number;
  recommendations: Array<{
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'action-required';
  }>;
}

export interface NextJsSpecialization {
  router: 'App Router' | 'Pages Router' | 'Both routers' | 'Router not identified';
  componentDistribution: NextJsComponentDistribution;
  serverActions: NextJsServerActionsOverview;
  boundaryHealth: NextJsBoundaryHealth;
  modernization: NextJsModernization;
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
