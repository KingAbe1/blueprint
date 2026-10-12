import React, { useRef, useEffect } from 'react';
import { 
  FolderOpen, 
  FolderCode, 
  ChevronDown, 
  Check, 
  Edit3, 
  Trash2, 
  Plus 
} from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';

interface ProjectDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  compact?: boolean;
}

export const ProjectDropdown: React.FC<ProjectDropdownProps> = ({ 
  isOpen, 
  onClose, 
  onToggle,
  compact = false 
}) => {
  const { 
    projects, 
    activeProjectId, 
    activeProject, 
    setActiveProjectId, 
    setIsCreatingNew, 
    setEditingProjectId, 
    setProjectToDelete,
    exportProjects,
    importProjectsFromFile
  } = useProjects();
  const { isDark } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className={`relative min-w-0 ${compact ? 'w-max max-w-full' : 'flex-1'}`} ref={dropdownRef}>
      <div className="flex min-w-0 items-center w-full">
        {!compact && (
          <div className="flex items-center space-x-2 mr-2 shrink-0">
            <span className={`font-bold text-xs tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Blueprint
            </span>
            <span className={`text-[11px] ${isDark ? 'text-[#60616B]' : 'text-slate-400'}`}>/</span>
          </div>
        )}
        
        {activeProject ? (
          <button
            onClick={onToggle}
            className={`flex min-w-0 items-center justify-between space-x-1 rounded-md border px-1.5 py-1 text-xs font-medium transition-all cursor-pointer ${compact ? 'w-max max-w-full' : 'flex-1'} ${
              isDark 
                ? 'bg-[#18191E] border-[#2B2C33] text-white hover:bg-[#20222A]' 
                : 'bg-slate-100/80 border-slate-200 text-slate-900 hover:bg-slate-200/80 shadow-xs'
            }`}
            title={activeProject.name}
          >
            <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
              <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate text-xs">{activeProject.name}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-[#7A7B85] shrink-0 ml-0.5" />
          </button>
        ) : (
          <span className={`text-xs ${isDark ? 'text-[#9496A1]' : 'text-slate-500'}`}>
            Workspace Setup
          </span>
        )}
      </div>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1.5 w-64 rounded-2xl border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-[#16171C] border-[#2A2B33] text-white' 
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}>
          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-1.5 ${
            isDark ? 'text-[#71727D]' : 'text-slate-400'
          }`}>
            Projects ({projects.length})
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 py-1">
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isActive
                      ? isDark
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                      : isDark
                        ? 'hover:bg-white/[0.05] text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    setIsCreatingNew(false);
                    onClose();
                  }}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {isActive ? (
                      <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <FolderCode className="w-3.5 h-3.5 text-[#7A7B85] shrink-0" />
                    )}
                    <span className="font-medium truncate">{proj.name}</span>
                  </div>

                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingProjectId(proj.id);
                        onClose();
                      }}
                      className={`p-1 rounded transition-colors ${
                        isDark ? 'text-[#8E8F99] hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200'
                      }`}
                      title="Rename project"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setProjectToDelete(proj);
                        onClose();
                      }}
                      className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`pt-1.5 mt-1 border-t space-y-0.5 ${isDark ? 'border-[#23242A]' : 'border-slate-100'}`}>
            <button
              onClick={() => {
                setIsCreatingNew(true);
                onClose();
              }}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark 
                  ? 'text-blue-400 hover:bg-blue-500/10' 
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Project</span>
            </button>

            <div className="flex items-center space-x-1 pt-1">
              <button
                onClick={() => {
                  exportProjects();
                  onClose();
                }}
                className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                  isDark
                    ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Export all projects as JSON backup"
              >
                <span>Export JSON</span>
              </button>

              <label
                className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                  isDark
                    ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Import projects from JSON file"
              >
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      importProjectsFromFile(file);
                      onClose();
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

