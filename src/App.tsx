import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { AIProvider } from './context/AIContext';
import { NotificationProvider } from './context/NotificationContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CreateProjectView } from './components/project/CreateProjectView';
import { DomainIntentView } from './components/workbench/DomainIntentView';
import { InvariantWorkbench } from './components/workbench/InvariantWorkbench';
import { RenameModal } from './components/modals/RenameModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { AISettingsModal } from './components/modals/AISettingsModal';
import { PhaseTab } from './types/project';

const AppContent: React.FC = () => {
  const { activeProject, isCreatingNew } = useProjects();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<PhaseTab>('domain-intent');
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('blueprint_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('blueprint_sidebar_collapsed', String(next));
      return next;
    });
  };

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
    <div className={`h-screen w-screen flex flex-col font-display transition-colors duration-200 select-none overflow-hidden ${
      isDark 
        ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200' 
        : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900'
    }`}>
      <Header 
        isSidebarCollapsed={isSidebarCollapsed} 
        onToggleSidebar={toggleSidebar} 
      />

      <main className="flex-1 flex overflow-hidden min-h-0">
        {!activeProject || isCreatingNew ? (
          <CreateProjectView />
        ) : (
          <div className="flex-1 flex overflow-hidden min-h-0">
            <Sidebar 
              activeTab={activeTab} 
              onSelectTab={setActiveTab}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebar}
            />
            
            {activeTab === 'domain-intent' ? (
              <DomainIntentView onProceedToInvariants={() => setActiveTab('invariants')} />
            ) : (
              <InvariantWorkbench />
            )}
          </div>
        )}
      </main>

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
