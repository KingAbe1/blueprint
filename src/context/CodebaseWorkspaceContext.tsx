import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { QualityOverviewFocus } from '../components/project/CodebaseHeroPulse';
import {
  CodebaseRescanOverlay,
  type CodebaseRescanOverlayState,
} from '../components/project/CodebaseRescanOverlay';

export type CodebaseProjectSection = 'overview' | 'analysis' | 'quality';

const SECTION_LABELS: Record<CodebaseProjectSection, string> = {
  overview: 'Overview',
  analysis: 'Code analysis',
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
  lastScannedLabel?: string;
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
  rescanOverlay: CodebaseRescanOverlayState | null;
  isRescanning: boolean;
  beginRescan: (projectLabel: string) => void;
  updateRescan: (progress: number, phase: string) => void;
  completeRescan: () => void;
  cancelRescan: () => void;
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
  const [rescanOverlay, setRescanOverlay] = useState<CodebaseRescanOverlayState | null>(null);
  const rescanFinishTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setActiveSection(readSavedProjectSection(navigationStorageKey));
  }, [enabled, navigationStorageKey]);

  useEffect(() => {
    if (enabled) return;
    setRescanOverlay(null);
    if (rescanFinishTimerRef.current !== null) {
      window.clearTimeout(rescanFinishTimerRef.current);
      rescanFinishTimerRef.current = null;
    }
  }, [enabled]);

  const selectSection = useCallback(
    (section: CodebaseProjectSection) => {
      if (!enabled || rescanOverlay) return;
      try {
        window.localStorage.setItem(navigationStorageKey, section);
      } catch {
        // ignore
      }
      setActiveSection(section);
    },
    [enabled, navigationStorageKey, rescanOverlay],
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

  const beginRescan = useCallback((projectLabel: string) => {
    if (rescanFinishTimerRef.current !== null) {
      window.clearTimeout(rescanFinishTimerRef.current);
      rescanFinishTimerRef.current = null;
    }
    setRescanOverlay({
      projectLabel,
      progress: 6,
      phase: 'Reading project files…',
    });
  }, []);

  const updateRescan = useCallback((progress: number, phase: string) => {
    setRescanOverlay(prev =>
      prev
        ? {
            ...prev,
            progress: Math.max(prev.progress, Math.min(99, progress)),
            phase,
          }
        : null,
    );
  }, []);

  const completeRescan = useCallback(() => {
    setRescanOverlay(prev =>
      prev
        ? {
            ...prev,
            progress: 100,
            phase: 'Scan complete',
          }
        : null,
    );
    if (rescanFinishTimerRef.current !== null) {
      window.clearTimeout(rescanFinishTimerRef.current);
    }
    rescanFinishTimerRef.current = window.setTimeout(() => {
      setRescanOverlay(null);
      rescanFinishTimerRef.current = null;
    }, 500);
  }, []);

  const cancelRescan = useCallback(() => {
    if (rescanFinishTimerRef.current !== null) {
      window.clearTimeout(rescanFinishTimerRef.current);
      rescanFinishTimerRef.current = null;
    }
    setRescanOverlay(null);
  }, []);

  useEffect(() => {
    if (!enabled) setToolbar({});
  }, [enabled]);

  const isRescanning = Boolean(rescanOverlay);

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
      rescanOverlay: enabled ? rescanOverlay : null,
      isRescanning: enabled ? isRescanning : false,
      beginRescan,
      updateRescan,
      completeRescan,
      cancelRescan,
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
      rescanOverlay,
      isRescanning,
      beginRescan,
      updateRescan,
      completeRescan,
      cancelRescan,
    ],
  );

  return (
    <CodebaseWorkspaceContext.Provider value={value}>
      {children}
      {enabled && rescanOverlay ? <CodebaseRescanOverlay state={rescanOverlay} /> : null}
    </CodebaseWorkspaceContext.Provider>
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
      rescanOverlay: null,
      isRescanning: false,
      beginRescan: () => {},
      updateRescan: () => {},
      completeRescan: () => {},
      cancelRescan: () => {},
    };
  }
  return ctx;
}
