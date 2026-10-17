import React, { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { AIProvider } from './context/AIContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { GreenfieldAiBanner } from './components/workbench/GreenfieldAiBanner';
import { NotificationProvider } from './context/NotificationContext';
import { GitHubProvider } from './context/GitHubContext';
import { Header } from './components/layout/Header';
import { CodebaseWorkspaceProvider } from './context/CodebaseWorkspaceContext';
import { CreateProjectView } from './components/project/CreateProjectView';
import { RouteLoadingFallback } from './components/common/RouteLoadingFallback';
import { reanalyzeCodebase } from './services/codebaseAnalysisLoader';
import { RenameModal } from './components/modals/RenameModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { AISettingsModal } from './components/modals/AISettingsModal';
import { SafeErrorBoundary } from './components/common/SafeErrorBoundary';
import { PhaseTab } from './types/project';
import { Loader2 } from 'lucide-react';

const CodebaseAnalysisView = lazy(() =>
  import('./components/project/CodebaseAnalysisView').then(module => ({
    default: module.CodebaseAnalysisView,
  })),
);

const DomainIntentView = lazy(() =>
  import('./components/workbench/DomainIntentView').then(module => ({
    default: module.DomainIntentView,
  })),
);

const ArchitectureMapView = lazy(() =>
  import('./components/workbench/ArchitectureMapView').then(module => ({
    default: module.ArchitectureMapView,
  })),
);

const BuildHandoffView = lazy(() =>
  import('./components/workbench/BuildHandoffView').then(module => ({
    default: module.BuildHandoffView,
  })),
);

const ACTIVE_TAB_STORAGE_KEY = 'blueprint_active_tab_v1';
const AVAILABLE_TABS: PhaseTab[] = ['domain-intent', 'architecture-map', 'in-flight'];

const AppContent: React.FC = () => {
  const {
    activeProject,
    isCreatingNew,
    isLoaded,
    setIsCreatingNew,
    updateCodebaseAnalysis,
    setProjectToDelete,
  } = useProjects();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<PhaseTab>(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as PhaseTab | null;
    return savedTab && AVAILABLE_TABS.includes(savedTab) ? savedTab : 'domain-intent';
  });
  
  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const inBrownfield = Boolean(activeProject?.codebaseAnalysis && !isCreatingNew);
  const inGreenfield = Boolean(activeProject && !activeProject.codebaseAnalysis && !isCreatingNew);

  return (
    <CodebaseWorkspaceProvider
      enabled={inBrownfield}
      projectId={activeProject?.id}
      rootPath={activeProject?.codebaseAnalysis?.rootPath}
    >
      <div className={`h-screen w-screen flex font-sans transition-colors duration-200 select-none overflow-hidden ${
        isDark 
          ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200 bg-[#101113]'
          : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 bg-slate-50'
      }`}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Header
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />

          {inGreenfield ? <GreenfieldAiBanner /> : null}

          <main className="flex-1 flex overflow-hidden min-h-0">
            {!isLoaded ? (
              <div
                className={`flex flex-1 flex-col items-center justify-center gap-3 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className={`h-8 w-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <p className="text-sm font-medium">Loading workspace…</p>
              </div>
            ) : !activeProject || isCreatingNew ? (
              <CreateProjectView />
            ) : activeProject.codebaseAnalysis ? (
              <Suspense fallback={<RouteLoadingFallback label="Loading codebase workspace…" />}>
                <CodebaseAnalysisView
                  analysis={activeProject.codebaseAnalysis}
                  projectId={activeProject.id}
                  onDelete={() => setProjectToDelete(activeProject)}
                  onUpdateAnalysis={analysis => updateCodebaseAnalysis(activeProject.id, analysis)}
                  onRescan={() => reanalyzeCodebase(activeProject.codebaseAnalysis!)}
                />
              </Suspense>
            ) : (
            <div className={`flex-1 flex overflow-hidden min-h-0 ${isDark ? 'bg-[#0E0F12]' : 'bg-[#F6F7F9]'}`}>
              <Suspense
                fallback={
                  <RouteLoadingFallback
                    label={
                      activeTab === 'in-flight'
                        ? 'Loading build handoff…'
                        : activeTab === 'architecture-map'
                          ? 'Loading architecture map…'
                          : 'Loading product blueprint…'
                    }
                  />
                }
              >
                {activeTab === 'in-flight' ? (
                  <BuildHandoffView />
                ) : activeTab === 'architecture-map' ? (
                  <ArchitectureMapView
                    onEditDecisions={() => setActiveTab('domain-intent')}
                    onProceedToHandoff={() => setActiveTab('in-flight')}
                  />
                ) : (
                  <DomainIntentView
                    onOpenArchitectureMap={() => setActiveTab('architecture-map')}
                  />
                )}
              </Suspense>
            </div>
          )}
          </main>
        </div>

        <RenameModal />
        <DeleteModal />
        <AISettingsModal />
      </div>
    </CodebaseWorkspaceProvider>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ProjectProvider>
          <GitHubProvider>
            <AIProvider>
              <ConfirmProvider>
                <SafeErrorBoundary fallbackTitle="Blueprint couldn't load" variant="page">
                  <AppContent />
                </SafeErrorBoundary>
              </ConfirmProvider>
            </AIProvider>
          </GitHubProvider>
        </ProjectProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
