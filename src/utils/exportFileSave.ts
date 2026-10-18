import { isDesktopApp } from './platform';
import { saveBlobWithPicker, triggerBrowserDownload } from './browserDownload';

/** Save a blob via native save dialog on desktop, or browser download / File System Access API. */
export async function saveExportBlob(options: {
  blob: Blob;
  filename: string;
  extension: string;
  filterLabel: string;
  mimeTypes?: Record<string, string[]>;
}): Promise<boolean> {
  const { blob, filename, extension, filterLabel, mimeTypes } = options;

  if (isDesktopApp()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: filename,
      filters: [{ name: filterLabel, extensions: [extension] }],
    });
    if (!path) return false;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_export_file', { path, data: Array.from(bytes) });
    return true;
  }

  const accept = mimeTypes ?? { [blob.type || 'application/octet-stream']: [`.${extension}`] };
  const saved = await saveBlobWithPicker(blob, filename, accept);
  if (saved) return true;

  triggerBrowserDownload(blob, filename);
  return true;
}

export async function saveExportText(content: string, filename: string, extension = 'md'): Promise<boolean> {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  return saveExportBlob({
    blob,
    filename,
    extension,
    filterLabel: extension === 'md' ? 'Markdown' : 'Text file',
    mimeTypes: { 'text/markdown': ['.md'], 'text/plain': [`.${extension}`] },
  });
}
