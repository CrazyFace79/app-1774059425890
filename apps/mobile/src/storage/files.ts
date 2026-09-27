import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { detectImageType } from '@lookstudio/domain';

export function projectDir(projectId: string): Directory {
  return new Directory(Paths.document, 'projects', projectId);
}

export function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export async function readUriBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('http:') || uri.startsWith('https:')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('No se pudo leer el archivo.');
    return new Uint8Array(await response.arrayBuffer());
  }
  return new File(uri).bytes();
}

export async function writeProjectFile(projectId: string, name: string, bytes: Uint8Array): Promise<string> {
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

export function deleteProjectTree(projectId: string): void {
  const dir = projectDir(projectId);
  if (dir.exists) dir.delete();
}

export function deleteUri(uri: string): void {
  if (!uri) return;
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
