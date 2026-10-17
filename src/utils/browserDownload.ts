/** Trigger a file download in the browser / webview (must run during or right after a user gesture when possible). */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 2_000);
}

/** File System Access API save when available (works for async-generated blobs). */
export async function saveBlobWithPicker(
  blob: Blob,
  filename: string,
  mimeTypes: Record<string, string[]>,
): Promise<boolean> {
  if (!('showSaveFilePicker' in window) || typeof window.showSaveFilePicker !== 'function') {
    return false;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: filename, accept: mimeTypes }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false;
    }
    return false;
  }
}
