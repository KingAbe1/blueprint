import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CreateProjectView } from './components/project/CreateProjectView';
import { InvariantWorkbench } from './components/workbench/InvariantWorkbench';
import { RenameModal } from './components/modals/RenameModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { PhaseTab } from './types/project';

const AppContent: React.FC = () => {
  const { activeProject, isCreatingNew } = useProjects();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<PhaseTab>('pre-flight');

  return (
    <div className={`min-h-screen flex flex-col font-display transition-colors duration-200 select-none ${
      isDark 
        ? 'text-[#F4F4F6] selection:bg-blue-500/30 selection:text-blue-200' 
        : 'text-slate-900 selection:bg-blue-500/20 selection:text-blue-900'
    }`}>
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {!activeProject || isCreatingNew ? (
          <CreateProjectView />
        ) : (
          <div className="flex-1 flex">
            <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
            <InvariantWorkbench />
          </div>
        )}
      </main>

      <RenameModal />
      <DeleteModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </ThemeProvider>
  );
};

export default App;
