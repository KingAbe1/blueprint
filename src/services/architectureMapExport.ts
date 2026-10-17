import { isDesktopApp } from '../utils/platform';
import { saveBlobWithPicker, triggerBrowserDownload } from '../utils/browserDownload';

type Point = { x: number; y: number };

export type MapExportNode = {
  id: string;
  eyebrow: string;
  label: string;
};

export type MapExportEdge = {
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
};

const NODE_WIDTH = 192;
const NODE_HEIGHT = 96;

function sanitizeXmlText(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
}

function escapeXml(value: string) {
  return sanitizeXmlText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function edgePath(from: Point, to: Point) {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;

  if (endX > startX + 24) {
    const curve = Math.max(42, (endX - startX) * 0.5);
    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  }

  const fromCenterX = from.x + NODE_WIDTH / 2;
  const toCenterX = to.x + NODE_WIDTH / 2;
  const flowsDown = to.y > from.y;
  const verticalStartY = flowsDown ? from.y + NODE_HEIGHT : from.y;
  const verticalEndY = flowsDown ? to.y : to.y + NODE_HEIGHT;
  const direction = flowsDown ? 1 : -1;
  const curve = Math.max(42, Math.abs(verticalEndY - verticalStartY) * 0.45);
  return `M ${fromCenterX} ${verticalStartY} C ${fromCenterX} ${verticalStartY + direction * curve}, ${toCenterX} ${verticalEndY - direction * curve}, ${toCenterX} ${verticalEndY}`;
}

function isPrimaryEdge(from: string, to: string) {
  const primary: Array<[string, string]> = [
    ['people', 'experience'],
    ['experience', 'services'],
    ['services', 'data'],
  ];
  return primary.some(([a, b]) => a === from && b === to);
}

export function buildArchitectureMapSvg(options: {
  width: number;
  height: number;
  title: string;
  isDark: boolean;
  nodes: MapExportNode[];
  positions: Record<string, Point>;
  edges: MapExportEdge[];
}): string {
  const { width, height, title, isDark, nodes, positions, edges } = options;
  const bg = isDark ? '#0E0F12' : '#F6F7F9';
  const edgeStroke = isDark ? '#64748b' : '#94a3b8';
  const primaryStroke = isDark ? '#60a5fa' : '#2563eb';
  const nodeFill = isDark ? '#131417' : '#ffffff';
  const nodeStroke = isDark ? '#2a2b31' : '#cbd5e1';
  const titleFill = isDark ? '#e2e8f0' : '#0f172a';
  const mutedFill = isDark ? '#94a3b8' : '#64748b';

  const edgeMarkup = edges
    .map(edge => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) return '';
      const path = edgePath(from, to);
      const primary = isPrimaryEdge(edge.from, edge.to);
      const stroke = primary ? primaryStroke : edgeStroke;
      const labelX = (from.x + NODE_WIDTH / 2 + to.x + NODE_WIDTH / 2) / 2;
      const labelY = (from.y + NODE_HEIGHT / 2 + to.y + NODE_HEIGHT / 2) / 2 - 7;
      return `<g>
  <path d="${path}" fill="none" stroke="${stroke}" stroke-width="${primary ? 2.25 : 1.5}" stroke-opacity="0.9"${edge.dashed ? ' stroke-dasharray="6 6"' : ''} marker-end="url(#arrow)" />
  <rect x="${labelX - 34}" y="${labelY - 8}" width="68" height="16" rx="8" fill="${primary ? (isDark ? '#1e3a5f' : '#eff6ff') : bg}" />
  <text x="${labelX}" y="${labelY + 3}" text-anchor="middle" font-size="9" font-weight="600" fill="${primary ? primaryStroke : mutedFill}">${escapeXml(edge.label)}</text>
</g>`;
    })
    .join('\n');

  const nodeMarkup = nodes
    .map(node => {
      const position = positions[node.id];
      if (!position) return '';
      const label = escapeXml(node.label.slice(0, 120));
      const eyebrow = escapeXml(node.eyebrow);
      return `<g>
  <rect x="${position.x}" y="${position.y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1" />
  <text x="${position.x + 14}" y="${position.y + 22}" font-size="9" font-weight="600" fill="${mutedFill}">${eyebrow.toUpperCase()}</text>
  <text x="${position.x + 14}" y="${position.y + 42}" font-size="11" font-weight="500" fill="${titleFill}">${label}</text>
</g>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(title)}</title>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="${edgeStroke}" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${bg}" />
  <text x="16" y="24" font-size="13" font-weight="600" fill="${titleFill}">${escapeXml(title)}</text>
  ${edgeMarkup}
  ${nodeMarkup}
</svg>`;
}

async function writeDesktopExportFile(path: string, data: Uint8Array): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('write_export_file', { path, data: Array.from(data) });
}

async function saveViaDesktopDialog(filename: string, data: Uint8Array, extension: string, label: string): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: filename,
    filters: [{ name: label, extensions: [extension] }],
  });
  if (!path) return false;
  await writeDesktopExportFile(path, data);
  return true;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function renderArchitectureMapPngBlob(
  svg: string,
  width: number,
  height: number,
  background: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('PNG export failed'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Could not render map preview for PNG export'));
    img.src = svgDataUrl(svg);
  });
}

/** @returns true when a file was written or downloaded; false when the user cancelled a save dialog. */
export async function exportArchitectureMapFile(options: {
  format: 'svg' | 'png';
  filename: string;
  svg: string;
  width: number;
  height: number;
  isDark: boolean;
}): Promise<boolean> {
  const { format, filename, svg, width, height, isDark } = options;
  const background = isDark ? '#0E0F12' : '#F6F7F9';

  if (format === 'svg') {
    const bytes = new TextEncoder().encode(svg);
    const blob = new Blob([bytes], { type: 'image/svg+xml;charset=utf-8' });

    if (isDesktopApp()) {
      return saveViaDesktopDialog(filename, bytes, 'svg', 'SVG image');
    }

    const saved = await saveBlobWithPicker(blob, filename, { 'image/svg+xml': ['.svg'] });
    if (!saved) triggerBrowserDownload(blob, filename);
    return true;
  }

  const pngBlob = await renderArchitectureMapPngBlob(svg, width, height, background);
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  if (isDesktopApp()) {
    return saveViaDesktopDialog(filename, pngBytes, 'png', 'PNG image');
  }

  const saved = await saveBlobWithPicker(pngBlob, filename, { 'image/png': ['.png'] });
  if (!saved) triggerBrowserDownload(pngBlob, filename);
  return true;
}
