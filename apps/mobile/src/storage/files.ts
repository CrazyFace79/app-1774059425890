import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { detectImageType } from '@lookstudio/domain';

const blobCache = new Map<string, string>();

type WebDatabase = {
  objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore: (name: string) => void;
  transaction: (name: string, mode: 'readonly' | 'readwrite') => WebTransaction;
};

type WebTransaction = {
  objectStore: (name: string) => WebStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
};

type WebRequest = {
  result?: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
};

type WebStore = {
  put: (value: Uint8Array, key: string) => WebRequest;
  get: (key: string) => WebRequest;
  delete: (key: string) => WebRequest;
  openCursor: () => WebRequest;
};

type WebCursor = {
  key: string;
  delete: () => void;
  continue: () => void;
};

function openWebFiles(): Promise<WebDatabase> {
  const factory = (globalThis as { indexedDB?: { open: (name: string, version: number) => WebRequest & { result: WebDatabase } } }).indexedDB;
  if (!factory) return Promise.reject(new Error('Este navegador no puede guardar archivos.'));
  return new Promise((resolve, reject) => {
    const request = factory.open('lookstudio-files', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo abrir el almacén de archivos.'));
  });
}

function requestToPromise(request: WebRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo leer el archivo guardado.'));
  });
}

async function webPut(key: string, bytes: Uint8Array): Promise<void> {
  const db = await openWebFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('No se pudo guardar el archivo.'));
    tx.objectStore('files').put(bytes, key);
  });
}

async function webGet(key: string): Promise<Uint8Array | null> {
  const db = await openWebFiles();
  const tx = db.transaction('files', 'readonly');
  const result = await requestToPromise(tx.objectStore('files').get(key));
  return result instanceof Uint8Array ? result : null;
}

async function webDelete(key: string): Promise<void> {
  const db = await openWebFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('No se pudo borrar el archivo.'));
    tx.objectStore('files').delete(key);
  });
}

async function webDeletePrefix(prefix: string): Promise<void> {
  const db = await openWebFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const cursorRequest = tx.objectStore('files').openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result as WebCursor | null;
      if (!cursor) return;
      if (cursor.key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('No se pudo borrar la carpeta.'));
  });
}

function browserUrl(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const create = (URL as unknown as { createObjectURL?: (blob: Blob) => string }).createObjectURL;
  if (!create) throw new Error('Este navegador no puede mostrar el archivo.');
  return create(new Blob([copy]));
}

export function projectDir(projectId: string): Directory {
  return new Directory(Paths.document, 'projects', projectId);
}

export function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export async function readUriBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('idb:')) {
    const stored = await webGet(uri.slice('idb:'.length));
    if (!stored) throw new Error('El archivo local ya no está.');
    return stored;
  }
  if (uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('http:') || uri.startsWith('https:')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('No se pudo leer el archivo.');
    return new Uint8Array(await response.arrayBuffer());
  }
  return new File(uri).bytes();
}

export async function hydrateLocalUri(uri: string): Promise<string> {
  if (!uri.startsWith('idb:')) return uri;
  const cached = blobCache.get(uri);
  if (cached) return cached;
  const url = browserUrl(await readUriBytes(uri));
  blobCache.set(uri, url);
  return url;
}

export function downloadInBrowser(uri: string, filename: string): void {
  const documentRef = (globalThis as { document?: { createElement: (tag: string) => { href: string; download: string; click: () => void } } }).document;
  if (!documentRef) return;
  const anchor = documentRef.createElement('a');
  anchor.href = uri;
  anchor.download = filename;
  anchor.click();
}

export async function writeProjectFile(projectId: string, name: string, bytes: Uint8Array): Promise<string> {
  if (Platform.OS === 'web') {
    const key = `${projectId}/${name}`;
    await webPut(key, bytes);
    const uri = `idb:${key}`;
    const previous = blobCache.get(uri);
    if (previous) {
      const revoke = (URL as unknown as { revokeObjectURL?: (value: string) => void }).revokeObjectURL;
      revoke?.(previous);
      blobCache.delete(uri);
    }
    return uri;
  }
  const dir = projectDir(projectId);
  ensureDir(dir);
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function extForBytes(bytes: Uint8Array): { ext: string; mime: string } {
  const type = detectImageType(bytes);
  if (type === 'png') return { ext: 'png', mime: 'image/png' };
  if (type === 'webp') return { ext: 'webp', mime: 'image/webp' };
  if (type === 'jpeg') return { ext: 'jpg', mime: 'image/jpeg' };
  throw new Error('Formato no soportado. Usa JPEG, PNG o WebP.');
}

export async function deleteProjectTree(projectId: string): Promise<void> {
  if (Platform.OS === 'web') {
    await webDeletePrefix(`${projectId}/`);
    return;
  }
  const dir = projectDir(projectId);
  if (dir.exists) dir.delete();
}

export async function deleteUri(uri: string): Promise<void> {
  if (!uri) return;
  if (uri.startsWith('idb:')) {
    blobCache.delete(uri);
    await webDelete(uri.slice('idb:'.length));
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // El archivo ya no está en el dispositivo.
  }
}

export function newId(): string {
  return Crypto.randomUUID();
}
