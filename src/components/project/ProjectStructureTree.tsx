import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Search,
  X,
  FileCode,
  FileJson,
  FileCog,
  FileSpreadsheet,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';

interface ProjectTreeNode {
  name: string;
  path: string;
  kind: 'folder' | 'file';
  files?: number;
  children: ProjectTreeNode[];
}

function getFileIcon(fileName: string, isDark: boolean) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
    return <FileCode className="h-3.5 w-3.5 shrink-0 text-cyan-400" />;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.mjs')) {
    return <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.lock')) {
    return <FileJson className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss')) {
    return <FileText className="h-3.5 w-3.5 shrink-0 text-pink-400" />;
  }
  if (lower.endsWith('.prisma') || lower.endsWith('.sql')) {
    return <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  }
  if (lower.startsWith('.env') || lower.endsWith('.config.js') || lower.endsWith('.config.ts')) {
    return <FileCog className="h-3.5 w-3.5 shrink-0 text-purple-400" />;
  }
  return <FileText className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />;
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

interface ProjectStructureTreeProps {
  analysis: CodebaseAnalysis;
}

export const ProjectStructureTree: React.FC<ProjectStructureTreeProps> = ({ analysis }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const panel = isDark ? 'border-white/[0.08] bg-[#141518]' : 'border-slate-200/90 bg-white shadow-2xs';
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['.']));
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState(false);

  const projectTree = useMemo(() => createProjectTree(analysis), [analysis]);
  const hasDetailedTree = Boolean(analysis.structurePaths);

  // Filter matching paths when searching
  const matchingPaths = useMemo(() => {
    if (!filterQuery.trim()) return null;
    const q = filterQuery.toLowerCase();
    const set = new Set<string>();
    const checkNode = (node: ProjectTreeNode): boolean => {
      let hasMatch = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      for (const child of node.children) {
        if (checkNode(child)) hasMatch = true;
      }
      if (hasMatch) set.add(node.path);
      return hasMatch;
    };
    checkNode(projectTree);
    return set;
  }, [projectTree, filterQuery]);

  // Check if selected file has quality findings
  const matchingFindings = useMemo(() => {
    if (!selectedFile || !analysis.quality?.findings) return [];
    return analysis.quality.findings.filter(f => f.location?.path === selectedFile);
  }, [selectedFile, analysis.quality]);

  const copyFilePath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 1500);
    } catch {
      // Ignore
    }
  };

  const renderTreeNode = (node: ProjectTreeNode, depth: number): React.ReactNode => {
    // If filter active, skip if not in matching paths
    if (matchingPaths && !matchingPaths.has(node.path)) {
      return null;
    }

    const expanded = filterQuery.trim() ? true : expandedFolders.has(node.path);
    const canExpand = node.kind === 'folder' && node.children.length > 0;
    const isSelected = selectedFile === node.path;

    const rowClass = `flex min-h-7 items-center gap-1.5 rounded-md pr-2 text-left transition-colors cursor-pointer select-none ${
      isSelected
        ? (isDark ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/40' : 'bg-blue-50 text-blue-900 ring-1 ring-blue-500/30 font-medium')
        : (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100/70')
    }`;

    const rowContent = (
      <>
        {node.kind === 'folder' ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {node.kind === 'folder' ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )
        ) : (
          getFileIcon(node.name, isDark)
        )}

        <span
          className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
            node.path === '.'
              ? isDark
                ? 'font-semibold text-slate-100'
                : 'font-semibold text-slate-800'
              : isSelected
              ? isDark
                ? 'text-white'
                : 'text-blue-900'
              : isDark
              ? 'text-slate-300'
              : 'text-slate-700'
          }`}
        >
          {node.name}
          {node.kind === 'folder' && '/'}
        </span>

        {typeof node.files === 'number' && (
          <span className={`shrink-0 text-[9px] font-mono ${muted}`}>
            {node.files} {node.files === 1 ? 'file' : 'files'}
          </span>
        )}
      </>
    );

    return (
      <React.Fragment key={node.path}>
        {node.kind === 'folder' ? (
          <button
            type="button"
            onClick={() =>
              setExpandedFolders(current => {
                const next = new Set(current);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })
            }
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
            aria-expanded={expanded}
            disabled={!canExpand}
            className={`${rowClass} w-full disabled:cursor-default disabled:hover:bg-transparent`}
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
          >
            {rowContent}
          </button>
        ) : (
          <div
            onClick={() => setSelectedFile(node.path)}
            className={rowClass}
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
          >
            {rowContent}
          </div>
        )}
        {node.kind === 'folder' && expanded && node.children.map(child => renderTreeNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <Folder className="h-3.5 w-3.5" />
          </div>
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            Project Structure Tree
          </h2>
        </div>
        {projectTree.children.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setExpandedFolders(current =>
                current.size > 1 ? new Set(['.']) : new Set(getExpandableFolderPaths(projectTree))
              )
            }
            className={`text-[10px] font-medium transition-colors ${
              isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {expandedFolders.size > 1 ? 'Collapse all' : 'Expand folders'}
          </button>
        )}
      </div>

      {/* Filter / Search file tree */}
      <div className="relative mb-3">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${muted}`} />
        <input
          type="text"
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          placeholder="Filter files (e.g. *.tsx, api, schema)…"
          className={`w-full rounded-lg border pl-8 pr-7 py-1.5 text-xs outline-none transition-colors ${
            isDark
              ? 'border-white/[0.08] bg-black/20 text-white placeholder:text-slate-600 focus:border-blue-500'
              : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
          }`}
        />
        {filterQuery && (
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${muted}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tree scroll canvas */}
      {projectTree.children.length > 0 ? (
        <div
          className={`max-h-[460px] overflow-y-auto rounded-lg border p-1.5 ${
            isDark ? 'border-white/[0.06] bg-black/15' : 'border-slate-100 bg-slate-50/50'
          }`}
        >
          {renderTreeNode(projectTree, 0)}
        </div>
      ) : (
        <p className={`mt-4 text-xs ${muted}`}>No project files were found.</p>
      )}

      {/* Selected File Telemetry Drawer */}
      {selectedFile && (
        <div
          className={`mt-3 p-3 rounded-xl border animate-in fade-in duration-150 ${
            isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-mono text-xs font-semibold truncate" title={selectedFile}>
                {selectedFile}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => copyFilePath(selectedFile)}
                className={`p-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Copy relative file path"
              >
                {copiedFile ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copiedFile ? 'Copied' : 'Copy path'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className={`p-1 rounded ${muted} hover:text-slate-200`}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {matchingFindings.length > 0 && (
            <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200/70'} space-y-1`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider text-rose-400`}>
                Quality Signals Flagged ({matchingFindings.length}):
              </p>
              {matchingFindings.map((f, i) => (
                <div key={i} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">{f.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasDetailedTree && projectTree.children.length > 0 && (
        <p className={`mt-2 text-[10px] ${muted}`}>
          Rescan this codebase to capture its full file structure.
        </p>
      )}
    </section>
  );
};
