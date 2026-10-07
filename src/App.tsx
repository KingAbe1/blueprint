import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { AIProvider } from './context/AIContext';
import { NotificationProvider } from './context/NotificationContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CreateProjectView } from './components/project/CreateProjectView';
import { DomainIntentView } from './components/workbench/DomainIntentView';
import { ArchitectureMapView } from './components/workbench/ArchitectureMapView';
import { BuildHandoffView } from './components/workbench/BuildHandoffView';
import { RenameModal } from './components/modals/RenameModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { AISettingsModal } from './components/modals/AISettingsModal';
import { PhaseTab } from './types/project';

const ACTIVE_TAB_STORAGE_KEY = 'blueprint_active_tab_v1';
const AVAILABLE_TABS: PhaseTab[] = ['domain-intent', 'architecture-map', 'in-flight'];

const AppContent: React.FC = () => {
  const { activeProject, isCreatingNew } = useProjects();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<PhaseTab>(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as PhaseTab | null;
    return savedTab && AVAILABLE_TABS.includes(savedTab) ? savedTab : 'domain-intent';
  });
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('blueprint_sidebar_collapsed_v2') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('blueprint_sidebar_collapsed_v2', String(next));
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Keyboard shortcut ⌘B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`h-screen w-screen flex font-display transition-colors duration-200 select-none overflow-hidden ${
      isDark 
        ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200 bg-[#101113]'
        : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900 bg-slate-50'
    }`}>
      {/* Full-Height Left Sidebar */}
      {activeProject && !isCreatingNew && (
        <Sidebar 
          activeTab={activeTab} 
          onSelectTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      )}

      {/* Right Column: Top Header + Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed} 
          onToggleSidebar={toggleSidebar} 
        />

        <main className="flex-1 flex overflow-hidden min-h-0">
          {!activeProject || isCreatingNew ? (
            <CreateProjectView />
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
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ProjectProvider>
          <AIProvider>
            <AppContent />
          </AIProvider>
        </ProjectProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;
