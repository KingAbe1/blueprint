import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

export const RenameModal: React.FC = () => {
  const { projects, editingProjectId, setEditingProjectId, renameProject } = useProjects();
  const { isDark } = useTheme();

  const editingProject = projects.find(p => p.id === editingProjectId);
  const [name, setName] = useState(editingProject?.name || '');

  if (!editingProjectId || !editingProject) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    renameProject(editingProjectId, name);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 shadow-2xl ${
        isDark ? 'bg-[#16171C] border-[#2A2B33] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <h3 className="text-sm font-bold">Rename Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            className={`w-full text-sm font-medium px-3.5 py-2 rounded-xl border outline-none ${
              isDark 
                ? 'bg-[#121316] border-[#2B2C33] text-white focus:border-blue-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
            }`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setEditingProjectId(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                isDark ? 'text-[#8E8F99] hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary-blue disabled:opacity-30 disabled:pointer-events-none px-4 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
