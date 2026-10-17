import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { AIProvider } from './context/AIContext';
import { NotificationProvider } from './context/NotificationContext';
import { GitHubProvider } from './context/GitHubContext';
import { Header } from './components/layout/Header';
import { CodebaseWorkspaceProvider } from './context/CodebaseWorkspaceContext';
import { CreateProjectView } from './components/project/CreateProjectView';
import { CodebaseAnalysisView } from './components/project/CodebaseAnalysisView';
import { reanalyzeCodebase } from './services/codebaseAnalysisService';
import { DomainIntentView } from './components/workbench/DomainIntentView';
import { ArchitectureMapView } from './components/workbench/ArchitectureMapView';
import { BuildHandoffView } from './components/workbench/BuildHandoffView';
import { RenameModal } from './components/modals/RenameModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { AISettingsModal } from './components/modals/AISettingsModal';
import { SafeErrorBoundary } from './components/common/SafeErrorBoundary';
import { PhaseTab } from './types/project';
import { Loader2 } from 'lucide-react';

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

  return (
    <CodebaseWorkspaceProvider
      enabled={inBrownfield}
      projectId={activeProject?.id}
      rootPath={activeProject?.codebaseAnalysis?.rootPath}
    >
      <div className={`h-screen w-screen flex font-display transition-colors duration-200 select-none overflow-hidden ${
        isDark 
          ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200 bg-[#101113]'
          : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 bg-slate-50'
      }`}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Header
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />

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
              <CodebaseAnalysisView
                analysis={activeProject.codebaseAnalysis}
                projectId={activeProject.id}
                onDelete={() => setProjectToDelete(activeProject)}
                onUpdateAnalysis={analysis => updateCodebaseAnalysis(activeProject.id, analysis)}
                onRescan={async () => {
                  const analysis = await reanalyzeCodebase(activeProject.codebaseAnalysis!);
                  if (analysis) updateCodebaseAnalysis(activeProject.id, analysis);
                }}
              />
            ) : (
            <div className="flex-1 flex overflow-hidden min-h-0">
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
              <SafeErrorBoundary fallbackTitle="Blueprint couldn't load" variant="page">
                <AppContent />
              </SafeErrorBoundary>
            </AIProvider>
          </GitHubProvider>
        </ProjectProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
