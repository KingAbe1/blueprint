import { Project } from '../types/project';

const LOCAL_STORAGE_KEY = 'blueprint_projects_list';
const API_URL = '/api/projects';

export const storageService = {
  /**
   * Fetch projects from disk endpoint (/api/projects).
   * Fallback to localStorage if API call fails or is unavailable.
   */
  async loadProjects(): Promise<{ projects: Project[]; source: 'disk' | 'local' }> {
    try {
      const response = await fetch(API_URL, {
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const rawText = await response.text();
        if (rawText && rawText.trim()) {
          const diskData: Project[] = JSON.parse(rawText);
          if (Array.isArray(diskData) && diskData.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(diskData));
            return { projects: diskData, source: 'disk' };
          }
        }
      }
    } catch (err) {
      console.warn('Backend disk API unavailable, falling back to localStorage:', err);
    }

    // Fallback to localStorage
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed: Project[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.saveProjects(parsed).catch(() => {});
          return { projects: parsed, source: 'local' };
        }
      }
    } catch (err) {
      console.error('Error loading projects from localStorage:', err);
    }

    return { projects: [], source: 'local' };
  },

  /**
   * Save projects to both disk (/api/projects) and localStorage.
   */
  async saveProjects(projects: Project[]): Promise<boolean> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects)
      });
      return response.ok;
    } catch (err) {
      console.warn('Could not persist projects to disk API:', err);
      return false;
    }
  },

  /**
   * Export projects as a downloadable JSON file.
   */
  exportProjectsToFile(projects: Project[], filename = 'blueprint-projects.json') {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Read and parse projects from an imported JSON file.
   */
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
  }
};
