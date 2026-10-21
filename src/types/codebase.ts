import type { FrameworkProfile } from './framework';

export interface CodebaseSource {
  rootName: string;
  rootPath: string;
  paths: string[];
  directories?: string[];
  directoryHandleId?: string;
  sourceMetrics?: SourceContentMetrics;
  /** Temporary in-memory source text used for local analysis; never copied to saved project data. */
  sourceContents?: Record<string, string>;
  manifests: Record<string, string>;
  truncated?: boolean;
  git?: GitRepositoryInfo;
}

export interface ArchitectureAssessment {
  topology: string;
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  evidence: string[];
  database: {
    name: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  };
}

export interface CodebaseSuggestion {
  title: string;
  detail: string;
  priority: 'high' | 'medium';
}

export interface SourceFileMetric {
  path: string;
  lines: number;
  todoMarkers: number;
}

export interface SourceContentMetrics {
  analyzedFiles: number;
  skippedFiles: number;
  linesOfCode: number;
  todoMarkers: number;
  largeFiles: SourceFileMetric[];
}

export interface QualityFinding {
  id?: string;
  ruleId?: string;
  category?: QualityCategory;
  confidence?: 'high' | 'medium' | 'low';
  source?: 'blueprint-static' | 'blueprint-nextjs' | 'blueprint-remix' | 'blueprint-nodejs' | 'project-tool';
  location?: { path: string; line?: number };
  codeSnippet?: { startLine: number; focusLine: number; lines: string[] };
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  evidence: string[];
}

export type QualityCategory = 'correctness' | 'security' | 'maintainability' | 'testing' | 'structure' | 'delivery' | 'documentation' | 'tooling';

export type QualityCheckStatus = 'passed' | 'issues' | 'not-configured' | 'not-run' | 'unsupported' | 'incomplete';

export interface QualityCheck {
  id: string;
  name: string;
  category: QualityCategory;
  status: QualityCheckStatus;
  summary: string;
  findingCount: number;
}

export interface QualityDimension {
  name: string;
  score: number;
  maxScore: number;
  summary: string;
  assessmentStatus?: 'reviewed' | 'partial' | 'not-assessed';
  scoreEvidence?: Array<{ label: string; points: number; detail: string }>;
}

export interface LockedDependency {
  name: string;
  version: string;
  direct: boolean;
  development: boolean;
}

export interface DependencyInventory {
  ecosystem: 'npm';
  lockfiles: string[];
  packages: LockedDependency[];
  declaredDependencies: number;
  unresolvedDeclaredDependencies: number;
}

export type DependencySeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export interface DependencyAdvisory {
  id: string;
  packageName: string;
  version: string;
  severity: DependencySeverity;
  summary: string;
  fixedVersions: string[];
  references: string[];
}

export interface DependencyRiskAssessment {
  provider: 'OSV.dev';
  scannedAt: number;
  packagesChecked: number;
  advisories: DependencyAdvisory[];
  incomplete: boolean;
}

export interface QualityAssessment {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  dimensions: QualityDimension[];
  findings: QualityFinding[];
  findingsOmitted?: number;
  analyzedSourceFiles: number;
  linesOfCode: number;
  todoMarkers: number;
  deepAnalysis: {
    parsedJavaScriptFiles: number;
    skippedJavaScriptFiles: number;
    sourceFilesAvailable: number;
  };
  checks?: QualityCheck[];
}

export interface GitRepositoryInfo {
  tracked: boolean;
  branch?: string;
  remote?: string;
  changedFiles?: number;
  untrackedFiles?: number;
  latestCommit?: string;
}

export interface PipelineAssessment {
  workflows: Array<{ path: string; name: string; triggers: string[]; jobs: string[]; deploySignals: string[] }>;
  deploymentTargets: string[];
  liveStatus: string;
}

export interface GitHubRepositoryStatus {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  runs: Array<{ id: number; name: string; event: string; status: string; conclusion: string | null; updatedAt: string; htmlUrl: string; branch: string }>;
  deployments: Array<{ id: number; environment: string; state: string; updatedAt: string; environmentUrl?: string; htmlUrl: string }>;
  warnings: string[];
  fetchedAt: number;
}

export interface NextJsOverview {
  version?: string;
  router: 'App Router' | 'Pages Router' | 'Both routers' | 'Router not identified';
  appRouteCount: number;
  pagesRouteCount: number;
  apiRouteCount: number;
  routeExamples: string[];
  configFiles: string[];
  requestBoundaryFiles: string[];
  requestBoundaryNote?: string;
}

export interface CodebaseAnalysis {
  rootName: string;
  rootPath: string;
  directoryHandleId?: string;
  scannedAt: number;
  filesScanned: number;
  sourceFiles: number;
  truncated: boolean;
  languages: Array<{ name: string; files: number }>;
  frameworks: string[];
  nextjs?: NextJsOverview;
  frameworkProfile?: FrameworkProfile;
  dependencyInventory?: DependencyInventory;
  dependencyRisk?: DependencyRiskAssessment;
  entryPoints: string[];
  testSignals: string[];
  topLevelDirectories: Array<{ name: string; files: number }>;
  /** Relative file paths captured during the scan, used to render the expandable project tree. */
  structurePaths?: string[];
  /** Relative folder paths captured during the scan, including empty folders. */
  structureDirectories?: string[];
  scripts?: Array<{ name: string; command: string; runCommand?: string }>;
  nestedDirectories?: Array<{ parent: string; name: string; files: number }>;
  testFilesCount?: number;
  quality?: QualityAssessment;
  architecture?: ArchitectureAssessment;
  suggestions?: CodebaseSuggestion[];
  git?: GitRepositoryInfo;
  pipeline?: PipelineAssessment;
}
