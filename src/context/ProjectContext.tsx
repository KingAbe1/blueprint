import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, ProjectSpec } from '../types/project';

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | undefined;
  isCreatingNew: boolean;
  editingProjectId: string | null;
  projectToDelete: Project | null;
  setIsCreatingNew: (isCreating: boolean) => void;
  setEditingProjectId: (id: string | null) => void;
  setProjectToDelete: (project: Project | null) => void;
  setActiveProjectId: (id: string | null) => void;
  createProject: (name: string, description?: string) => Project | null;
  renameProject: (id: string, newName: string) => void;
  updateProjectSpec: (id: string, updatedSpec: Partial<ProjectSpec>) => void;
  deleteProject: (id: string) => void;
}

const defaultSpec: ProjectSpec = {
  description: '',
  coreEntities: [],
  criticalWorkflows: [],
  nonNegotiables: []
};

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
      const legacyName = localStorage.getItem('blueprint_project_name');
      if (legacyName && legacyName.trim()) {
        const initial: Project = {
          id: 'proj_' + Date.now(),
          name: legacyName.trim(),
          spec: { ...defaultSpec },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        return [initial];
      }
    } catch (e) {
      console.error('Failed to parse projects from localStorage', e);
    }
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

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Sync projects list to localStorage
  useEffect(() => {
    localStorage.setItem('blueprint_projects_list', JSON.stringify(projects));
  }, [projects]);

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

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        activeProject,
        isCreatingNew,
        editingProjectId,
        projectToDelete,
        setIsCreatingNew,
        setEditingProjectId,
        setProjectToDelete,
        setActiveProjectId,
        createProject,
        renameProject,
        updateProjectSpec,
        deleteProject
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
