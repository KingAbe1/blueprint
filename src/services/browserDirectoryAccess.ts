export interface BrowserDirectoryHandle {
  name: string;
  entries(): AsyncIterable<[string, BrowserFileHandle | BrowserDirectoryHandle]>;
  queryPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' }): Promise<PermissionState>;
}

interface StoredDirectoryHandle {
  id: string;
  handle: BrowserDirectoryHandle;
}

const DIRECTORY_HANDLE_DB = 'blueprint-codebase-access';
const DIRECTORY_HANDLE_STORE = 'directory-handles';
const inMemoryDirectoryHandles = new Map<string, BrowserDirectoryHandle>();

function openDirectoryHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_HANDLE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DIRECTORY_HANDLE_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local folder access storage.'));
  });
}

export async function saveDirectoryHandle(handle: BrowserDirectoryHandle): Promise<string> {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  inMemoryDirectoryHandles.set(id, handle);
  try {
    const db = await openDirectoryHandleDb();
    const transaction = db.transaction(DIRECTORY_HANDLE_STORE, 'readwrite');
    transaction.objectStore(DIRECTORY_HANDLE_STORE).put({ id, handle } satisfies StoredDirectoryHandle);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save folder access.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not save folder access.'));
    });
    db.close();
  } catch {
    // Keep the handle for this session when IndexedDB is unavailable.
  }
  return id;
}

export async function loadDirectoryHandle(id: string): Promise<BrowserDirectoryHandle | null> {
  const cached = inMemoryDirectoryHandles.get(id);
  if (cached) return cached;
  try {
    const db = await openDirectoryHandleDb();
    const request = db.transaction(DIRECTORY_HANDLE_STORE, 'readonly').objectStore(DIRECTORY_HANDLE_STORE).get(id);
    const record = await new Promise<StoredDirectoryHandle | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredDirectoryHandle | undefined);
      request.onerror = () => reject(request.error || new Error('Could not read saved folder access.'));
    });
    db.close();
    if (!record?.handle) return null;
    inMemoryDirectoryHandles.set(id, record.handle);
    return record.handle;
  } catch {
    return null;
  }
}

export interface BrowserFileHandle {
  name: string;
  getFile(): Promise<File>;
}

export function isDirectoryHandle(entry: BrowserFileHandle | BrowserDirectoryHandle): entry is BrowserDirectoryHandle {
  return 'entries' in entry;
}

