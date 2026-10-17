import { HandoffFile } from '../types/project';
import { isDesktopApp } from '../utils/platform';
import { triggerBrowserDownload } from '../utils/browserDownload';

/** Builds a ZIP blob from handoff files (store-only, no compression). */
export async function buildHandoffZipBlob(files: HandoffFile[]): Promise<Blob> {
  const parts: BlobPart[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    const localHeader = new DataView(new ArrayBuffer(30 + nameBytes.length));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, 0, true);
    localHeader.setUint16(10, 0, true);
    localHeader.setUint16(12, 0, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, dataBytes.length, true);
    localHeader.setUint32(22, dataBytes.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    const localChunk = concatUint8(
      new Uint8Array(localHeader.buffer),
      nameBytes,
      dataBytes,
    );
    parts.push(toBlobPart(localChunk));

    const cdHeader = new DataView(new ArrayBuffer(46 + nameBytes.length));
    cdHeader.setUint32(0, 0x02014b50, true);
    cdHeader.setUint16(4, 20, true);
    cdHeader.setUint16(6, 20, true);
    cdHeader.setUint16(8, 0, true);
    cdHeader.setUint16(10, 0, true);
    cdHeader.setUint16(12, 0, true);
    cdHeader.setUint16(14, 0, true);
    cdHeader.setUint32(16, crc, true);
    cdHeader.setUint32(20, dataBytes.length, true);
    cdHeader.setUint32(24, dataBytes.length, true);
    cdHeader.setUint16(28, nameBytes.length, true);
    cdHeader.setUint16(30, 0, true);
    cdHeader.setUint16(32, 0, true);
    cdHeader.setUint16(34, 0, true);
    cdHeader.setUint16(36, 0, true);
    cdHeader.setUint32(38, 0, true);
    cdHeader.setUint32(42, offset, true);

    centralDirectory.push(concatUint8(new Uint8Array(cdHeader.buffer), nameBytes));
    offset += localChunk.length;
  }

  const cdBlob = concatUint8(...centralDirectory);
  const cdSize = cdBlob.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  parts.push(toBlobPart(cdBlob), toBlobPart(new Uint8Array(end.buffer)));
  return new Blob(parts, { type: 'application/zip' });
}

function handoffZipFilename(projectName: string): string {
  const slug = projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'handoff';
  return `${slug}-handoff.zip`;
}

/** @returns true when saved/downloaded; false if the user cancelled a save dialog. */
export async function downloadHandoffZip(files: HandoffFile[], projectName: string): Promise<boolean> {
  const filename = handoffZipFilename(projectName);

  if (isDesktopApp()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: filename,
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
    });
    if (!path) return false;

    const blob = await buildHandoffZipBlob(files);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_export_file', { path, data: Array.from(bytes) });
    return true;
  }

  if ('showSaveFilePicker' in window && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const blob = await buildHandoffZipBlob(files);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
    }
  }

  const blob = await buildHandoffZipBlob(files);
  triggerBrowserDownload(blob, filename);
  return true;
}

function toBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function concatUint8(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
