import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { QualityOverviewFocus } from '../components/project/CodebaseHeroPulse';

export type CodebaseProjectSection = 'overview' | 'analysis' | 'quality';

const SECTION_LABELS: Record<CodebaseProjectSection, string> = {
  overview: 'Overview',
  analysis: 'Code',
  quality: 'Quality',
};

export function getCodebaseSectionLabel(section: CodebaseProjectSection): string {
  return SECTION_LABELS[section];
}

function readSavedProjectSection(storageKey: string): CodebaseProjectSection {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'overview' || saved === 'quality' || saved === 'analysis' ? saved : 'overview';
  } catch {
    return 'overview';
  }
}

export function normalizeTreeFilePath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/^\/+/, '');
}

export interface CodebaseToolbarHandlers {
  rescan?: () => Promise<void>;
  isRescanning?: boolean;
  openPreferredIde?: () => void;
  preferredIdeShortName?: string;
  exportReport?: () => void;
  deleteProject?: () => void;
}

interface CodebaseWorkspaceContextValue {
  enabled: boolean;
  activeSection: CodebaseProjectSection | null;
  qualitySectionFocus: QualityOverviewFocus | null;
  pendingTreeFilePath: string | null;
  toolbar: CodebaseToolbarHandlers;
  selectSection: (section: CodebaseProjectSection) => void;
  openQualitySection: (focus: QualityOverviewFocus) => void;
  openFileInAnalysis: (filePath: string) => void;
  consumePendingTreeFilePath: () => string | null;
  clearQualitySectionFocus: () => void;
  registerToolbar: (handlers: CodebaseToolbarHandlers) => void;
}

const CodebaseWorkspaceContext = createContext<CodebaseWorkspaceContextValue | null>(null);

interface CodebaseWorkspaceProviderProps {
  enabled: boolean;
  projectId?: string;
  rootPath?: string;
  children: React.ReactNode;
}

export const CodebaseWorkspaceProvider: React.FC<CodebaseWorkspaceProviderProps> = ({
  enabled,
  projectId,
  rootPath,
  children,
}) => {
  const navigationStorageKey = `blueprint:project-section:${projectId || rootPath || 'default'}`;

  const [activeSection, setActiveSection] = useState<CodebaseProjectSection>(() =>
    enabled ? readSavedProjectSection(navigationStorageKey) : 'overview',
  );
  const [qualitySectionFocus, setQualitySectionFocus] = useState<QualityOverviewFocus | null>(null);
  const [pendingTreeFilePath, setPendingTreeFilePath] = useState<string | null>(null);
  const [toolbar, setToolbar] = useState<CodebaseToolbarHandlers>({});

  useEffect(() => {
    if (!enabled) return;
    setActiveSection(readSavedProjectSection(navigationStorageKey));
  }, [enabled, navigationStorageKey]);

  const selectSection = useCallback(
    (section: CodebaseProjectSection) => {
      if (!enabled) return;
      try {
        window.localStorage.setItem(navigationStorageKey, section);
      } catch {
        // ignore
      }
      setActiveSection(section);
    },
    [enabled, navigationStorageKey],
  );

  const openQualitySection = useCallback(
    (focus: QualityOverviewFocus) => {
      if (!enabled) return;
      setQualitySectionFocus(focus);
      selectSection('quality');
    },
    [enabled, selectSection],
  );

  const openFileInAnalysis = useCallback(
    (filePath: string) => {
      if (!enabled) return;
      const normalized = normalizeTreeFilePath(filePath.trim());
      if (!normalized) return;
      setPendingTreeFilePath(normalized);
      selectSection('analysis');
    },
    [enabled, selectSection],
  );

  const consumePendingTreeFilePath = useCallback(() => {
    const path = pendingTreeFilePath;
    setPendingTreeFilePath(null);
    return path;
  }, [pendingTreeFilePath]);

  const clearQualitySectionFocus = useCallback(() => {
    setQualitySectionFocus(null);
  }, []);

  const registerToolbar = useCallback((handlers: CodebaseToolbarHandlers) => {
    setToolbar(handlers);
  }, []);

  useEffect(() => {
    if (!enabled) setToolbar({});
  }, [enabled]);

  const value = useMemo<CodebaseWorkspaceContextValue>(
    () => ({
      enabled,
      activeSection: enabled ? activeSection : null,
      qualitySectionFocus: enabled ? qualitySectionFocus : null,
      pendingTreeFilePath: enabled ? pendingTreeFilePath : null,
      toolbar: enabled ? toolbar : {},
      selectSection,
      openQualitySection,
      openFileInAnalysis,
      consumePendingTreeFilePath,
      clearQualitySectionFocus,
      registerToolbar,
    }),
    [
      enabled,
      activeSection,
      qualitySectionFocus,
      pendingTreeFilePath,
      toolbar,
      selectSection,
      openQualitySection,
      openFileInAnalysis,
      consumePendingTreeFilePath,
      clearQualitySectionFocus,
      registerToolbar,
    ],
  );

  return (
    <CodebaseWorkspaceContext.Provider value={value}>{children}</CodebaseWorkspaceContext.Provider>
  );
};

export function useCodebaseWorkspace(): CodebaseWorkspaceContextValue {
  const ctx = useContext(CodebaseWorkspaceContext);
  if (!ctx) {
    return {
      enabled: false,
      activeSection: null,
      qualitySectionFocus: null,
      pendingTreeFilePath: null,
      toolbar: {},
      selectSection: () => {},
      openQualitySection: () => {},
      openFileInAnalysis: () => {},
      consumePendingTreeFilePath: () => null,
      clearQualitySectionFocus: () => {},
      registerToolbar: () => {},
    };
  }
  return ctx;
}
