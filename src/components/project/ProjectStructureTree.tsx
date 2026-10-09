import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface ProjectTreeNode {
  name: string;
  path: string;
  kind: 'folder' | 'file';
  files?: number;
  children: ProjectTreeNode[];
}

function createProjectTree(analysis: CodebaseAnalysis): ProjectTreeNode {
  const root: ProjectTreeNode = { name: analysis.rootName, path: '.', kind: 'folder', files: analysis.filesScanned, children: [] };
  const childIndexes = new Map<ProjectTreeNode, Map<string, ProjectTreeNode>>();
  const getChild = (parent: ProjectTreeNode, name: string, path: string, kind: ProjectTreeNode['kind']) => {
    let children = childIndexes.get(parent);
    if (!children) {
      children = new Map();
      childIndexes.set(parent, children);
    }
    let node = children.get(name);
    if (!node) {
      node = { name, path, kind, files: kind === 'folder' ? 0 : undefined, children: [] };
      children.set(name, node);
      parent.children.push(node);
    }
    return node;
  };

  if (analysis.structurePaths !== undefined || analysis.structureDirectories !== undefined) {
    for (const directoryPath of analysis.structureDirectories || []) {
      const segments = directoryPath.split('/').filter(Boolean);
      let parent = root;
      segments.forEach((name, index) => {
        parent = getChild(parent, name, segments.slice(0, index + 1).join('/'), 'folder');
      });
    }
    for (const filePath of analysis.structurePaths || []) {
      const segments = filePath.split('/').filter(Boolean);
      let parent = root;
      segments.forEach((name, index) => {
        const isFile = index === segments.length - 1;
        const node = getChild(parent, name, segments.slice(0, index + 1).join('/'), isFile ? 'file' : 'folder');
        if (node.kind === 'folder') node.files = (node.files || 0) + 1;
        parent = node;
      });
    }
    const sortChildren = (node: ProjectTreeNode) => {
      node.children.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1);
      node.children.forEach(sortChildren);
    };
    sortChildren(root);
    return root;
  }

  // Older saved scans contain only a small directory summary. Keep it browsable
  // and explain that a rescan is needed to populate the full file tree.
  for (const directory of analysis.topLevelDirectories) {
    const parent: ProjectTreeNode = { name: directory.name, path: directory.name, kind: 'folder', files: directory.files, children: [] };
    for (const child of (analysis.nestedDirectories || []).filter(item => item.parent === directory.name)) {
      parent.children.push({ name: child.name, path: `${directory.name}/${child.name}`, kind: 'folder', files: child.files, children: [] });
    }
    parent.children.sort((a, b) => a.name.localeCompare(b.name));
    root.children.push(parent);
  }
  return root;
}

function getExpandableFolderPaths(node: ProjectTreeNode): string[] {
  if (node.kind !== 'folder' || node.children.length === 0) return [];
  return [node.path, ...node.children.flatMap(getExpandableFolderPaths)];
}

interface ProjectStructureTreeProps { analysis: CodebaseAnalysis; }

export const ProjectStructureTree: React.FC<ProjectStructureTreeProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200 bg-white';
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['.']));
  const projectTree = createProjectTree(analysis);
  const hasDetailedTree = Boolean(analysis.structurePaths);

  const renderTreeNode = (node: ProjectTreeNode, depth: number): React.ReactNode => {
    const expanded = expandedFolders.has(node.path);
    const canExpand = node.kind === 'folder' && node.children.length > 0;
    const rowClass = `flex min-h-8 items-center gap-1.5 rounded-md pr-2 text-left transition-colors ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`;
    const rowContent = <>
      {node.kind === 'folder'
        ? (expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />)
        : <span className="w-3.5 shrink-0" />}
      {node.kind === 'folder'
        ? (expanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />)
        : <FileText className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
      <span className={`min-w-0 flex-1 truncate font-mono text-[11px] ${node.path === '.' ? (isDark ? 'font-semibold text-slate-100' : 'font-semibold text-slate-800') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{node.name}{node.kind === 'folder' && '/'}</span>
      {typeof node.files === 'number' && <span className={`shrink-0 text-[9px] ${muted}`}>{node.files} {node.files === 1 ? 'file' : 'files'}</span>}
    </>;

    return <React.Fragment key={node.path}>
      {node.kind === 'folder' ? <button type="button" onClick={() => setExpandedFolders(current => {
        const next = new Set(current);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      })} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`} aria-expanded={expanded} disabled={!canExpand} className={`${rowClass} w-full disabled:cursor-default disabled:hover:bg-transparent`} style={{ paddingLeft: `${depth * 16 + 4}px` }}>{rowContent}</button>
        : <div className={rowClass} style={{ paddingLeft: `${depth * 16 + 4}px` }}>{rowContent}</div>}
      {node.kind === 'folder' && expanded && node.children.map(child => renderTreeNode(child, depth + 1))}
    </React.Fragment>;
  };

  return <section className={`rounded-2xl border p-5 ${panel}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-amber-500" /><h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Project structure</h2></div>
      {projectTree.children.length > 0 && <button type="button" onClick={() => setExpandedFolders(current => current.size > 1 ? new Set(['.']) : new Set(getExpandableFolderPaths(projectTree)))} className={`text-[10px] font-medium ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'}`}>
        {expandedFolders.size > 1 ? 'Collapse all' : 'Expand folders'}
      </button>}
    </div>
    {projectTree.children.length > 0 ? <div className={`mt-3 max-h-64 overflow-y-auto rounded-lg border p-1.5 ${isDark ? 'border-white/[0.06] bg-black/10' : 'border-slate-100 bg-slate-50/50'}`}>
      {renderTreeNode(projectTree, 0)}
    </div> : <p className={`mt-4 text-xs ${muted}`}>No project files were found.</p>}
    {!hasDetailedTree && projectTree.children.length > 0 && <p className={`mt-2 text-[10px] ${muted}`}>Rescan this codebase to see its files and full folder tree.</p>}
  </section>;
};
