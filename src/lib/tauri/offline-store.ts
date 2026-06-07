/**
 * IndexedDB-based offline storage for Tanuki PWA.
 * Stores stories, user data, and pending mutations when offline.
 */

const DB_NAME = 'tanuki-offline';
const DB_VERSION = 1;

// Schema definition for IndexedDB stores (used for documentation)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface OfflineStore {
  stories: { id: string; data: unknown; timestamp: number };
  userData: { key: string; value: unknown; timestamp: number };
  mutations: { id?: number; type: string; payload: string; createdAt: string; synced: boolean };
  config: { key: string; value: string; updatedAt: string };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('stories')) {
        const store = db.createObjectStore('stories', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('userData')) {
        db.createObjectStore('userData', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('mutations')) {
        const store = db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };
  });
}

// ---- Stories ----

export async function saveStoryOffline(id: string, data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('stories', 'readwrite');
  tx.objectStore('stories').put({ id, data, timestamp: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoryOffline(id: string): Promise<unknown | null> {
  const db = await openDB();
  const tx = db.transaction('stories', 'readonly');
  const request = tx.objectStore('stories').get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.data ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllStoriesOffline(): Promise<Array<{ id: string; data: unknown }>> {
  const db = await openDB();
  const tx = db.transaction('stories', 'readonly');
  const request = tx.objectStore('stories').getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

// ---- Mutations (offline queue) ----

export async function queueMutationOffline(type: string, payload: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('mutations', 'readwrite');
  tx.objectStore('mutations').add({
    type,
    payload,
    createdAt: new Date().toISOString(),
    synced: false,
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingMutationsOffline(): Promise<Array<{ id: number; type: string; payload: string; createdAt: string }>> {
  const db = await openDB();
  const tx = db.transaction('mutations', 'readonly');
  const index = tx.objectStore('mutations').index('synced');
  const request = index.getAll(IDBKeyRange.only(false));
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function markMutationsSynced(ids: number[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');

  await Promise.all(
    ids.map((id) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const record = request.result;
          if (record) {
            record.synced = true;
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    })
  );

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Config ----

export async function setConfigOffline(key: string, value: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('config', 'readwrite');
  tx.objectStore('config').put({ key, value, updatedAt: new Date().toISOString() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getConfigOffline(key: string): Promise<string | null> {
  const db = await openDB();
  const tx = db.transaction('config', 'readonly');
  const request = tx.objectStore('config').get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

// ---- User Data ----

export async function setUserDataOffline(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('userData', 'readwrite');
  tx.objectStore('userData').put({ key, value, timestamp: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUserDataOffline(key: string): Promise<unknown | null> {
  const db = await openDB();
  const tx = db.transaction('userData', 'readonly');
  const request = tx.objectStore('userData').get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}
