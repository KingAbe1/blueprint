import { Project } from '../types/project';

const LOCAL_STORAGE_KEY = 'blueprint_projects_list';

export const storageService = {
  /** Load projects from browser localStorage only (never sent to a Blueprint cloud). */
  async loadProjects(): Promise<{ projects: Project[] }> {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed: Project[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return { projects: parsed };
        }
      }
    } catch (err) {
      console.error('Error loading projects from localStorage:', err);
    }

    return { projects: [] };
  },

  /** Persist projects to browser localStorage only. */
  async saveProjects(projects: Project[]): Promise<boolean> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      return false;
    }
  },

  /** Export projects as a downloadable JSON file. */
  exportProjectsToFile(projects: Project[], filename = 'blueprint-projects.json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /** Read and parse projects from an imported JSON file. */
  importProjectsFromFile(file: File): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            resolve(parsed as Project[]);
          } else if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
            resolve([parsed as Project]);
          } else {
            reject(new Error('Invalid project file format'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },
};
