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

export type MapExportScene = {
  width: number;
  height: number;
  title: string;
  isDark: boolean;
  nodes: MapExportNode[];
  positions: Record<string, Point>;
  edges: MapExportEdge[];
};

const NODE_WIDTH = 192;
const NODE_HEIGHT = 96;
const EXPORT_PAD = 28;
const EXPORT_TITLE_BAND = 40;
const EXPORT_EDGE_PAD = 28;
const PNG_SCALE = 2;

type ExportFrame = {
  width: number;
  height: number;
  mapOriginX: number;
  mapOriginY: number;
  contentTransform: { x: number; y: number };
  titleX: number;
  titleY: number;
};

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

function computeExportFrame(scene: MapExportScene): ExportFrame {
  const { nodes, positions, edges } = scene;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const p = positions[node.id];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + NODE_HEIGHT);
  }

  for (const edge of edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;
    const samples = [
      from,
      to,
      { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 },
      { x: to.x, y: to.y + NODE_HEIGHT / 2 },
      { x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT },
      { x: to.x + NODE_WIDTH / 2, y: to.y },
    ];
    for (const pt of samples) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  if (!Number.isFinite(minX)) {
    return {
      width: scene.width,
      height: scene.height,
      mapOriginX: 0,
      mapOriginY: 0,
      contentTransform: { x: EXPORT_PAD, y: EXPORT_PAD + EXPORT_TITLE_BAND },
      titleX: EXPORT_PAD,
      titleY: EXPORT_PAD + 16,
    };
  }

  minX -= EXPORT_EDGE_PAD;
  minY -= EXPORT_EDGE_PAD;
  maxX += EXPORT_EDGE_PAD;
  maxY += EXPORT_EDGE_PAD;

  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;
  const width = Math.ceil(mapWidth + EXPORT_PAD * 2);
  const height = Math.ceil(EXPORT_TITLE_BAND + mapHeight + EXPORT_PAD * 2);

  return {
    width,
    height,
    mapOriginX: minX,
    mapOriginY: minY,
    contentTransform: {
      x: EXPORT_PAD - minX,
      y: EXPORT_PAD + EXPORT_TITLE_BAND - minY,
    },
    titleX: EXPORT_PAD,
    titleY: EXPORT_PAD + 16,
  };
}

function edgeMidpoint(from: Point, to: Point): Point {
  return {
    x: (from.x + NODE_WIDTH / 2 + to.x + NODE_WIDTH / 2) / 2,
    y: (from.y + NODE_HEIGHT / 2 + to.y + NODE_HEIGHT / 2) / 2,
  };
}

/** Stagger edge labels that would share the same anchor. */
function buildEdgeLabelOffsets(
  edges: MapExportEdge[],
  positions: Record<string, Point>,
): Map<string, { dx: number; dy: number }> {
  const buckets = new Map<string, string[]>();
  for (const edge of edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;
    const mid = edgeMidpoint(from, to);
    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
    const key = horizontal
      ? `h:${Math.round(mid.x / 32)}:${Math.round(mid.y / 20)}`
      : `v:${Math.round(mid.x / 20)}:${Math.round(mid.y / 32)}`;
    const list = buckets.get(key) ?? [];
    list.push(`${edge.from}-${edge.to}`);
    buckets.set(key, list);
  }

  const offsets = new Map<string, { dx: number; dy: number }>();
  for (const [, edgeIds] of buckets) {
    edgeIds.forEach((edgeId, index) => {
      const from = edgeId.split('-')[0];
      const to = edgeId.slice(from.length + 1);
      const fromP = positions[from];
      const toP = positions[to];
      if (!fromP || !toP) return;
      const horizontal = Math.abs(toP.x - fromP.x) >= Math.abs(toP.y - fromP.y);
      const slot = index - (edgeIds.length - 1) / 2;
      offsets.set(edgeId, horizontal ? { dx: 0, dy: slot * 16 } : { dx: slot * 18, dy: 0 });
    });
  }
  return offsets;
}

export function buildArchitectureMapSvg(scene: MapExportScene): string {
  const { title, isDark, nodes, positions, edges } = scene;
  const frame = computeExportFrame(scene);
  const labelOffsets = buildEdgeLabelOffsets(edges, positions);
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
      const mid = edgeMidpoint(from, to);
      const offset = labelOffsets.get(`${edge.from}-${edge.to}`) ?? { dx: 0, dy: 0 };
      const labelX = mid.x + offset.dx;
      const labelY = mid.y + offset.dy - 7;
      const pillW = Math.min(96, Math.max(52, edge.label.length * 6 + 20));
      return `<g>
  <path d="${path}" fill="none" stroke="${stroke}" stroke-width="${primary ? 2.25 : 1.5}" stroke-opacity="0.9"${edge.dashed ? ' stroke-dasharray="6 6"' : ''} marker-end="url(#arrow)" />
  <rect x="${labelX - pillW / 2}" y="${labelY - 8}" width="${pillW}" height="16" rx="8" fill="${primary ? (isDark ? '#1e3a5f' : '#eff6ff') : bg}" />
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

  const { x: tx, y: ty } = frame.contentTransform;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">
  <title>${escapeXml(title)}</title>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="${edgeStroke}" />
    </marker>
  </defs>
  <rect width="${frame.width}" height="${frame.height}" fill="${bg}" />
  <text x="${frame.titleX}" y="${frame.titleY}" font-size="13" font-weight="600" fill="${titleFill}">${escapeXml(title)}</text>
  <g transform="translate(${tx} ${ty})">
  ${edgeMarkup}
  ${nodeMarkup}
  </g>
</svg>`;
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = sanitizeXmlText(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  lines.push(current);
  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const last = trimmed[maxLines - 1];
    trimmed[maxLines - 1] = last.length > 3 ? `${last.slice(0, last.length - 1)}…` : last;
    return trimmed;
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string) {
  const size = 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.55);
  ctx.lineTo(-size, size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Renders the map with Canvas2D (works in Tauri/WKWebView where SVG-as-image often fails). */
export function renderArchitectureMapPngBlob(scene: MapExportScene): Promise<Blob> {
  const { title, isDark, nodes, positions, edges } = scene;
  const frame = computeExportFrame(scene);
  const labelOffsets = buildEdgeLabelOffsets(edges, positions);
  const bg = isDark ? '#0E0F12' : '#F6F7F9';
  const edgeStroke = isDark ? '#64748b' : '#94a3b8';
  const primaryStroke = isDark ? '#60a5fa' : '#2563eb';
  const nodeFill = isDark ? '#131417' : '#ffffff';
  const nodeStroke = isDark ? '#2a2b31' : '#cbd5e1';
  const titleFill = isDark ? '#e2e8f0' : '#0f172a';
  const mutedFill = isDark ? '#94a3b8' : '#64748b';
  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width = frame.width * PNG_SCALE;
  canvas.height = frame.height * PNG_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Canvas unavailable'));
  }

  ctx.scale(PNG_SCALE, PNG_SCALE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, frame.width, frame.height);

  ctx.fillStyle = titleFill;
  ctx.font = `600 13px ${font}`;
  ctx.fillText(sanitizeXmlText(title).slice(0, 120), frame.titleX, frame.titleY);

  ctx.save();
  ctx.translate(frame.contentTransform.x, frame.contentTransform.y);

  for (const edge of edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;

    const primary = isPrimaryEdge(edge.from, edge.to);
    const stroke = primary ? primaryStroke : edgeStroke;
    const pathD = edgePath(from, to);

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = primary ? 2.25 : 1.5;
    ctx.globalAlpha = 0.9;
    if (edge.dashed) ctx.setLineDash([6, 6]);
    const path = new Path2D(pathD);
    ctx.stroke(path);
    ctx.setLineDash([]);

    const endX = to.x;
    const endY = to.y + NODE_HEIGHT / 2;
    const startX = from.x + NODE_WIDTH;
    const startY = from.y + NODE_HEIGHT / 2;
    const angle = Math.atan2(endY - startY, endX - startX);
    drawArrowHead(ctx, endX, endY, angle, stroke);
    ctx.restore();

    const mid = edgeMidpoint(from, to);
    const offset = labelOffsets.get(`${edge.from}-${edge.to}`) ?? { dx: 0, dy: 0 };
    const labelX = mid.x + offset.dx;
    const labelY = mid.y + offset.dy;
    ctx.font = `600 9px ${font}`;
    const pillW = Math.min(96, Math.max(52, ctx.measureText(edge.label).width + 16));
    const pillH = 16;
    ctx.fillStyle = primary ? (isDark ? '#1e3a5f' : '#eff6ff') : bg;
    drawRoundedRect(ctx, labelX - pillW / 2, labelY - pillH / 2 - 2, pillW, pillH, 8);
    ctx.fill();
    ctx.fillStyle = primary ? primaryStroke : mutedFill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.label, labelX, labelY - 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  for (const node of nodes) {
    const position = positions[node.id];
    if (!position) continue;

    ctx.fillStyle = nodeFill;
    ctx.strokeStyle = nodeStroke;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, position.x, position.y, NODE_WIDTH, NODE_HEIGHT, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = mutedFill;
    ctx.font = `600 9px ${font}`;
    ctx.fillText(node.eyebrow.toUpperCase().slice(0, 32), position.x + 14, position.y + 22);

    ctx.fillStyle = titleFill;
    ctx.font = `500 11px ${font}`;
    const lines = wrapCanvasLines(ctx, node.label, NODE_WIDTH - 28, 3);
    lines.forEach((line, index) => {
      ctx.fillText(line, position.x + 14, position.y + 42 + index * 14);
    });
  }

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNG export failed'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
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

/** @returns true when a file was written or downloaded; false when the user cancelled a save dialog. */
export async function exportArchitectureMapFile(options: {
  format: 'svg' | 'png';
  filename: string;
  scene: MapExportScene;
}): Promise<boolean> {
  const { format, filename, scene } = options;

  if (format === 'svg') {
    const svg = buildArchitectureMapSvg(scene);
    const bytes = new TextEncoder().encode(svg);
    const blob = new Blob([bytes], { type: 'image/svg+xml;charset=utf-8' });

    if (isDesktopApp()) {
      return saveViaDesktopDialog(filename, bytes, 'svg', 'SVG image');
    }

    const saved = await saveBlobWithPicker(blob, filename, { 'image/svg+xml': ['.svg'] });
    if (!saved) triggerBrowserDownload(blob, filename);
    return true;
  }

  const pngBlob = await renderArchitectureMapPngBlob(scene);
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  if (isDesktopApp()) {
    return saveViaDesktopDialog(filename, pngBytes, 'png', 'PNG image');
  }

  const saved = await saveBlobWithPicker(pngBlob, filename, { 'image/png': ['.png'] });
  if (!saved) triggerBrowserDownload(pngBlob, filename);
  return true;
}
