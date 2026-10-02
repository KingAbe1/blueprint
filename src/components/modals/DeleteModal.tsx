import React from 'react';
import { Trash2 } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const DeleteModal: React.FC = () => {
  const { projectToDelete, setProjectToDelete, deleteProject } = useProjects();
  const { isDark } = useTheme();

  if (!projectToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl ${
        isDark ? 'bg-[#16171C] border-[#2A2B33] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center space-x-3 text-red-500">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold">Delete Project</h3>
        </div>
        <p className={`text-xs leading-relaxed ${isDark ? 'text-[#9496A1]' : 'text-slate-600'}`}>
          Are you sure you want to delete <span className="font-semibold text-red-400">"{projectToDelete.name}"</span>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={() => setProjectToDelete(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
              isDark ? 'text-[#8E8F99] hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteProject(projectToDelete.id)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors cursor-pointer shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
