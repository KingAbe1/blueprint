import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, ProjectSpec } from '../types/project';
import { CodebaseAnalysis } from '../types/codebase';
import { storageService } from '../services/storageService';

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | undefined;
  isCreatingNew: boolean;
  editingProjectId: string | null;
  projectToDelete: Project | null;
  storageSource: 'disk' | 'local';
  isLoaded: boolean;
  setIsCreatingNew: (isCreating: boolean) => void;
  setEditingProjectId: (id: string | null) => void;
  setProjectToDelete: (project: Project | null) => void;
  setActiveProjectId: (id: string | null) => void;
  createProject: (name: string, description?: string) => Project | null;
  createCodebaseProject: (analysis: CodebaseAnalysis) => Project;
  updateCodebaseAnalysis: (id: string, analysis: CodebaseAnalysis) => void;
  renameProject: (id: string, newName: string) => void;
  updateProjectSpec: (id: string, updatedSpec: Partial<ProjectSpec>) => void;
  deleteProject: (id: string) => void;
  exportProjects: () => void;
  importProjectsFromFile: (file: File) => Promise<void>;
}

const defaultSpec: ProjectSpec = {
  description: '',
  coreEntities: [],
  criticalWorkflows: [],
  nonNegotiables: []
};

const CREATING_NEW_STORAGE_KEY = 'blueprint_is_creating_new';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('blueprint_projects_list');
      if (saved) {
        const parsed: Project[] = JSON.parse(saved);
        return parsed.map(p => ({
          ...p,
          spec: p.spec ? { ...defaultSpec, ...p.spec } : { ...defaultSpec }
        }));
      }
    } catch (e) {}
    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const savedActive = localStorage.getItem('blueprint_active_project_id');
    if (savedActive) return savedActive;
    try {
      const savedList = localStorage.getItem('blueprint_projects_list');
      if (savedList) {
        const parsed = JSON.parse(savedList);
        if (parsed.length > 0) return parsed[0].id;
      }
    } catch (e) {}
    return null;
  });

  const [isCreatingNew, setIsCreatingNew] = useState(() =>
    localStorage.getItem(CREATING_NEW_STORAGE_KEY) === 'true',
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [storageSource, setStorageSource] = useState<'disk' | 'local'>('local');
  const [isLoaded, setIsLoaded] = useState(false);

  const lastSavedJsonRef = React.useRef<string>('');

  // Load from disk API on startup
  useEffect(() => {
    let isSubscribed = true;
    storageService.loadProjects().then(({ projects: loadedProjects, source }) => {
      if (!isSubscribed) return;
      setStorageSource(source);
      if (loadedProjects && loadedProjects.length > 0) {
        lastSavedJsonRef.current = JSON.stringify(loadedProjects);
        setProjects(loadedProjects);
        if (!activeProjectId || !loadedProjects.some(p => p.id === activeProjectId)) {
          setActiveProjectId(loadedProjects[0].id);
        }
      }
      setIsLoaded(true);
    }).catch(err => {
      console.warn('Async disk load fallback:', err);
      setIsLoaded(true);
    });
    return () => { isSubscribed = false; };
  }, []);

  // Sync projects list to storage whenever projects state updates (only if content changed)
  useEffect(() => {
    if (!isLoaded) return;
    const currentJson = JSON.stringify(projects);
    if (currentJson === lastSavedJsonRef.current) return;
    
    lastSavedJsonRef.current = currentJson;
    storageService.saveProjects(projects);
  }, [projects, isLoaded]);

  // Sync active project to localStorage
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('blueprint_active_project_id', activeProjectId);
      const activeProj = projects.find(p => p.id === activeProjectId);
      if (activeProj) {
        localStorage.setItem('blueprint_project_name', activeProj.name);
      }
    } else {
      localStorage.removeItem('blueprint_active_project_id');
      localStorage.removeItem('blueprint_project_name');
    }
  }, [activeProjectId, projects]);

  useEffect(() => {
    localStorage.setItem(CREATING_NEW_STORAGE_KEY, String(isCreatingNew));
  }, [isCreatingNew]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const createProject = (name: string, description: string = ''): Project | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const newProject: Project = {
      id: 'proj_' + Date.now(),
      name: trimmed,
      spec: {
        ...defaultSpec,
        description: description.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setIsCreatingNew(false);
    return newProject;
  };

  const createCodebaseProject = (analysis: CodebaseAnalysis): Project => {
    const summary = [
      `Existing codebase: ${analysis.rootName}`,
      analysis.languages.length > 0
        ? `Languages: ${analysis.languages.slice(0, 5).map(language => language.name).join(', ')}.`
        : '',
      analysis.frameworks.length > 0
        ? `Detected tools and frameworks: ${analysis.frameworks.join(', ')}.`
        : '',
      analysis.entryPoints.length > 0
        ? `Entry points: ${analysis.entryPoints.join(', ')}.`
        : '',
    ].filter(Boolean).join('\n');
    const now = Date.now();
    const project: Project = {
      id: 'proj_' + now,
      name: analysis.rootName,
      spec: { ...defaultSpec, description: summary },
      codebaseAnalysis: analysis,
      createdAt: now,
      updatedAt: now,
    };

    setProjects(previous => [project, ...previous]);
    setActiveProjectId(project.id);
    setIsCreatingNew(false);
    return project;
  };

  const updateCodebaseAnalysis = (id: string, analysis: CodebaseAnalysis) => {
    setProjects(previous => previous.map(project => project.id === id
      ? { ...project, codebaseAnalysis: analysis, updatedAt: Date.now() }
      : project));
  };

  const renameProject = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, name: trimmed, updatedAt: Date.now() };
      }
      return p;
    }));
    setEditingProjectId(null);
  };

  const updateProjectSpec = (id: string, updatedSpec: Partial<ProjectSpec>) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          spec: {
            ...p.spec,
            ...updatedSpec
          },
          updatedAt: Date.now()
        };
      }
      return p;
    }));
  };

  const deleteProject = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);

    if (activeProjectId === id) {
      if (updated.length > 0) {
        setActiveProjectId(updated[0].id);
      } else {
        setActiveProjectId(null);
        setIsCreatingNew(true);
      }
    }
    setProjectToDelete(null);
  };

  const exportProjects = () => {
    storageService.exportProjectsToFile(projects);
  };

  const importProjectsFromFile = async (file: File) => {
    try {
      const imported = await storageService.importProjectsFromFile(file);
      if (imported.length === 0) return;
      
      setProjects(prev => {
        const map = new Map<string, Project>();
        prev.forEach(p => map.set(p.id, p));
        imported.forEach(p => {
          map.set(p.id, {
            ...p,
            spec: p.spec ? { ...defaultSpec, ...p.spec } : { ...defaultSpec }
          });
        });
        const combined = Array.from(map.values());
        storageService.saveProjects(combined);
        return combined;
      });

      if (imported.length > 0) {
        setActiveProjectId(imported[0].id);
        setIsCreatingNew(false);
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import project file. Please check file format.');
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        activeProject,
        isCreatingNew,
        editingProjectId,
        projectToDelete,
        storageSource,
        isLoaded,
        setIsCreatingNew,
        setEditingProjectId,
        setProjectToDelete,
        setActiveProjectId,
        createProject,
        createCodebaseProject,
        updateCodebaseAnalysis,
        renameProject,
        updateProjectSpec,
        deleteProject,
        exportProjects,
        importProjectsFromFile
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
