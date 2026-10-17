import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Check,
  Copy,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  FileBraces,
  FileImage,
  Settings,
} from 'lucide-react';
import { CodebaseAnalysis } from '../../types/codebase';
import { useTheme } from '../../context/ThemeContext';
import { normalizeTreeFilePath, useCodebaseWorkspace } from '../../context/CodebaseWorkspaceContext';
import { overviewBorderClass, overviewPanelClass, overviewSeverityLabel } from './overviewUi';

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
      node.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
      node.children.forEach(sortChildren);
    };
    sortChildren(root);
    return root;
  }

  for (const directory of analysis.topLevelDirectories) {
    const parent: ProjectTreeNode = {
      name: directory.name,
      path: directory.name,
      kind: 'folder',
      files: directory.files,
      children: [],
    };
    for (const child of (analysis.nestedDirectories || []).filter(item => item.parent === directory.name)) {
      parent.children.push({
        name: child.name,
        path: `${directory.name}/${child.name}`,
        kind: 'folder',
        files: child.files,
        children: [],
      });
    }
    parent.children.sort((a, b) => a.name.localeCompare(b.name));
    root.children.push(parent);
  }
  return root;
}

function folderPathsForFile(filePath: string): string[] {
  const normalized = normalizeTreeFilePath(filePath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) return ['.'];
  const folders = new Set<string>(['.']);
  for (let i = 0; i < segments.length - 1; i++) {
    folders.add(segments.slice(0, i + 1).join('/'));
  }
  return [...folders];
}

const TREE_INDENT_PX = 20;
const TREE_GUTTER_PX = 8;

function explorerFileIcon(fileName: string, isDark: boolean): React.ReactNode {
  const lower = fileName.toLowerCase();
  const iconClass = 'h-4 w-4 shrink-0';

  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) {
    return <FileCode className={`${iconClass} ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) {
    return <FileCode className={`${iconClass} ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />;
  }
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return <FileCode className={`${iconClass} ${isDark ? 'text-yellow-400/90' : 'text-yellow-700'}`} />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.lock')) {
    return <FileJson className={`${iconClass} ${isDark ? 'text-amber-400/90' : 'text-amber-700'}`} />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass')) {
    return <FileBraces className={`${iconClass} ${isDark ? 'text-pink-400/90' : 'text-pink-600'}`} />;
  }
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) {
    return <FileText className={`${iconClass} ${isDark ? 'text-sky-300/90' : 'text-sky-700'}`} />;
  }
  if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(lower)) {
    return <FileImage className={`${iconClass} ${isDark ? 'text-violet-400/90' : 'text-violet-600'}`} />;
  }
  if (lower.startsWith('.env') || lower.includes('config.') || lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return <Settings className={`${iconClass} ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />;
  }
  return <FileText className={`${iconClass} ${isDark ? 'text-slate-500' : 'text-slate-500'}`} />;
}

function explorerFolderIcon(expanded: boolean, isDark: boolean): React.ReactNode {
  const iconClass = `h-4 w-4 shrink-0 ${isDark ? 'text-amber-400/95' : 'text-amber-600'}`;
  return expanded ? <FolderOpen className={iconClass} /> : <Folder className={iconClass} />;
}

interface ProjectStructureTreeProps {
  analysis: CodebaseAnalysis;
}

export const ProjectStructureTree: React.FC<ProjectStructureTreeProps> = React.memo(({ analysis }) => {
  const { isDark } = useTheme();
  const { pendingTreeFilePath, consumePendingTreeFilePath } = useCodebaseWorkspace();
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const title = isDark ? 'text-slate-100' : 'text-slate-900';
  const panel = overviewPanelClass(isDark);
  const border = overviewBorderClass(isDark);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['.']));
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState(false);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  const projectTree = useMemo(() => createProjectTree(analysis), [analysis]);
  const hasDetailedTree = Boolean(analysis.structurePaths);

  useEffect(() => {
    if (!pendingTreeFilePath) return;
    const normalized = normalizeTreeFilePath(pendingTreeFilePath);
    setFilterQuery('');
    setExpandedFolders(current => {
      const next = new Set(current);
      folderPathsForFile(normalized).forEach(path => next.add(path));
      return next;
    });
    setSelectedFile(normalized);
    consumePendingTreeFilePath();
    const timer = window.setTimeout(() => {
      selectedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pendingTreeFilePath, consumePendingTreeFilePath]);

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
    if (matchingPaths && !matchingPaths.has(node.path)) {
      return null;
    }

    const expanded = filterQuery.trim() ? true : expandedFolders.has(node.path);
    const canExpand = node.kind === 'folder' && node.children.length > 0;
    const isSelected = selectedFile === node.path;
    const isRoot = node.path === '.';
    const isFolder = node.kind === 'folder';

    const rowPad = { paddingLeft: `${depth * TREE_INDENT_PX + TREE_GUTTER_PX}px` };
    const baseRow =
      'flex w-full min-h-[26px] items-center gap-0.5 py-[3px] pr-3 text-left transition-colors select-none sm:pr-4';
    const rowState = isSelected
      ? isDark
        ? 'bg-[#094771]/90 text-slate-100'
        : 'bg-[#0060c0]/12 text-slate-900'
      : isDark
        ? 'hover:bg-white/[0.06]'
        : 'hover:bg-black/[0.04]';

    const labelClass = `min-w-0 flex-1 truncate text-[13px] leading-none ${
      isRoot ? 'font-medium' : 'font-normal'
    } ${isSelected ? (isDark ? 'text-slate-50' : 'text-slate-900') : isDark ? 'text-slate-300' : 'text-slate-800'}`;

    const twistie = (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {isFolder && canExpand ? (
          expanded ? (
            <ChevronDown className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          ) : (
            <ChevronRight className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          )
        ) : (
          <span className="h-3.5 w-3.5" aria-hidden />
        )}
      </span>
    );

    const nodeIcon = isFolder ? (
      explorerFolderIcon(expanded && canExpand, isDark)
    ) : (
      explorerFileIcon(node.name, isDark)
    );

    const rowInner = (
      <>
        {twistie}
        {nodeIcon}
        <span className={labelClass}>{node.name}</span>
      </>
    );

    if (isFolder) {
      return (
        <React.Fragment key={node.path}>
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
            className={`${baseRow} ${rowState} disabled:cursor-default disabled:hover:bg-transparent`}
            style={rowPad}
          >
            {rowInner}
          </button>
          {expanded ? node.children.map(child => renderTreeNode(child, depth + 1)) : null}
        </React.Fragment>
      );
    }

    return (
      <button
        key={node.path}
        ref={isSelected ? selectedRowRef : undefined}
        type="button"
        onClick={() => setSelectedFile(node.path)}
        className={`${baseRow} ${rowState}`}
        style={rowPad}
      >
        {rowInner}
      </button>
    );
  };

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border ${panel}`}>
      <header className={`shrink-0 border-b px-5 py-4 sm:px-6 ${border}`}>
        <h2 className={`text-[15px] font-medium ${title}`}>Project structure</h2>
        <p className={`mt-0.5 text-[13px] ${muted}`}>
          {analysis.filesScanned.toLocaleString()} paths
          {!hasDetailedTree && projectTree.children.length > 0 ? ' · summary only' : ''}
        </p>
      </header>

      <div className={`shrink-0 border-b px-5 py-3 sm:px-6 ${border}`}>
        <div className="relative">
          <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${muted}`} />
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Filter by path or name…"
            className={`w-full rounded-lg border py-1.5 pl-8 pr-8 text-xs outline-none ${
              isDark
                ? 'border-white/[0.08] bg-black/20 text-slate-100 placeholder:text-slate-500 focus:border-blue-500/50'
                : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-400'
            }`}
          />
          {filterQuery ? (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 ${muted}`}
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {selectedFile ? (
        <div className={`shrink-0 border-b px-5 py-3 sm:px-6 ${border}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={`min-w-0 truncate font-mono text-xs ${title}`} title={selectedFile}>
              {selectedFile}
            </p>
            <div className="flex shrink-0 items-center gap-x-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => copyFilePath(selectedFile)}
                className={
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                }
              >
                {copiedFile ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" />
                    Copy path
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className={isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800'}
              >
                Clear
              </button>
            </div>
          </div>
          {matchingFindings.length > 0 ? (
            <ul className={`mt-2 space-y-1 border-t pt-2 text-xs ${border}`}>
              {matchingFindings.map((f, i) => (
                <li key={i} className={`truncate ${muted}`}>
                  <span className={overviewSeverityLabel(isDark, f.priority === 'high' ? 'critical' : 'warning')}>
                    {f.priority}
                  </span>
                  <span className="mx-1.5 opacity-40">·</span>
                  {f.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div
        className={`min-h-0 flex-1 overflow-y-auto py-1.5 font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] ${
          isDark ? 'bg-[#1e1f22]/40' : 'bg-slate-50/80'
        }`}
      >
        {projectTree.children.length > 0 ? (
          renderTreeNode(projectTree, 0)
        ) : (
          <p className={`px-5 py-10 text-center text-sm sm:px-6 ${muted}`}>No project files were found.</p>
        )}
      </div>

      {!hasDetailedTree && projectTree.children.length > 0 ? (
        <p className={`shrink-0 border-t px-5 py-2.5 text-xs sm:px-6 ${border} ${muted}`}>
          Rescan to capture the full file tree.
        </p>
      ) : null}
    </section>
  );
});
