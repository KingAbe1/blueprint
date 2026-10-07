import React, { useState } from 'react';
import {
  Code2,
  FileText,
  Network,
  PanelLeftClose,
} from 'lucide-react';
import { PhaseTab } from '../../types/project';
import { useProjects } from '../../context/ProjectContext';
import { useTheme } from '../../context/ThemeContext';
import { ProjectDropdown } from '../project/ProjectDropdown';

interface SidebarProps {
  activeTab: PhaseTab;
  onSelectTab: (tab: PhaseTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavigationItem {
  id: PhaseTab;
  icon: typeof FileText;
  label: string;
  step: string;
  available: boolean;
}

const NAVIGATION: NavigationItem[] = [
  { id: 'domain-intent', icon: FileText, label: 'Product blueprint', step: '1', available: true },
  { id: 'architecture-map', icon: Network, label: 'Architecture map', step: '2', available: true },
  { id: 'in-flight', icon: Code2, label: 'Build handoff', step: '3', available: false },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { activeProject } = useProjects();
  const { isDark } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!activeProject) return null;

  return (
    <aside className={`flex shrink-0 flex-col border-r transition-[width] duration-200 ${
      isCollapsed ? 'w-[60px]' : 'w-56'
    } ${isDark ? 'border-white/[0.07] bg-[#0C0D0F]' : 'border-slate-200 bg-white'}`}>
      <div className={`flex h-14 shrink-0 items-center border-b px-3 ${
        isDark ? 'border-white/[0.07]' : 'border-slate-200'
      }`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <div className="h-3 w-3 rotate-45 rounded-[2px] border-2 border-white" />
        </div>
        {!isCollapsed && (
          <div className="ml-2 min-w-0 flex-1">
            <ProjectDropdown
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onToggle={() => setIsDropdownOpen(value => !value)}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-5">
        {!isCollapsed && (
          <p className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isDark ? 'text-[#62646B]' : 'text-slate-400'
          }`}>Blueprint</p>
        )}

        <nav className="space-y-1">
          {NAVIGATION.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isHandoffReady = Boolean(
              activeProject.spec.interview?.status === 'completed'
              && (activeProject.spec.frameworkRecommendation || activeProject.spec.frameworkRecommendations?.[0]),
            );
            const isAvailable = item.id === 'in-flight' ? isHandoffReady : item.available;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && onSelectTab(item.id)}
                title={isAvailable ? item.label : item.id === 'in-flight' ? `${item.label} · Complete the architecture first` : `${item.label} · Coming soon`}
                className={`group flex w-full items-center rounded-lg text-left transition-colors ${
                  isCollapsed ? 'h-10 justify-center' : 'h-10 gap-3 px-2.5'
                } ${
                  isActive
                    ? isDark ? 'bg-white/[0.07] text-white' : 'bg-slate-100 text-slate-950'
                    : isAvailable
                      ? isDark ? 'text-[#92949C] hover:bg-white/[0.04] hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      : isDark ? 'cursor-not-allowed text-[#494B51]' : 'cursor-not-allowed text-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-500' : ''}`} />
                {!isCollapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.label}</span>
                    {isAvailable ? (
                      <span className={`text-[10px] tabular-nums ${isDark ? 'text-[#62646B]' : 'text-slate-400'}`}>{item.step}</span>
                    ) : (
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                        isDark ? 'bg-white/[0.04] text-[#62646B]' : 'bg-slate-100 text-slate-400'
                      }`}>Soon</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={`flex h-12 shrink-0 items-center border-t px-3 ${
        isCollapsed ? 'justify-center' : 'justify-between'
      } ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        {!isCollapsed && <span className={`text-[10px] ${isDark ? 'text-[#62646B]' : 'text-slate-400'}`}>Blueprint Studio</span>}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`rounded-md p-1.5 transition-colors ${
              isDark ? 'text-[#7B7D85] hover:bg-white/[0.06] hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={isCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
          >
            <PanelLeftClose className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </aside>
  );
};
