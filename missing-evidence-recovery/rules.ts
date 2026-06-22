import type { RecoverableAttachmentType } from "./types";

export const RECOVERABLE_EXTENSIONS = {
  ".pdf": "PDF",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".png": "PNG",
  ".docx": "DOCX",
  ".xlsx": "XLSX",
} as const;

export const HIGH_PRIORITY_KEYWORDS = [
  "hotel",
  "booking",
  "airbnb",
  "reservation",
  "reserva",
  "invoice",
  "receipt",
  "villa",
  "ceuti",
  "trip",
  "travel",
] as const;

export const SEARCH_ROOT_LABELS = [
  {
    label: "Downloads",
    pattern: /(^|[\\/])(downloads|descargas)([\\/]|$)/i,
  },
  {
    label: "Desktop",
    pattern: /(^|[\\/])(desktop|escritorio)([\\/]|$)/i,
  },
  {
    label: "Documents",
    pattern: /(^|[\\/])(documents|documentos)([\\/]|$)/i,
  },
  {
    label: "WhatsApp Media",
    pattern: /(^|[\\/])(whatsapp\s+media|whatsapp[\\/]media|media[\\/]whatsapp)([\\/]|$)/i,
  },
  {
    label: "Android backups",
    pattern: /(^|[\\/])(android|backup|backups|phone\s+backup)([\\/]|$)/i,
  },
  {
    label: "Google Drive",
    pattern: /(^|[\\/])(google\s+drive|gdrive|my\s+drive|drive)([\\/]|$)/i,
  },
  {
    label: "OneDrive",
    pattern: /(^|[\\/])(onedrive|one\s+drive)([\\/]|$)/i,
  },
] as const;

export function getRecoverableType(fileName: string): RecoverableAttachmentType | null {
  const extension = getExtension(fileName);

  return (
    RECOVERABLE_EXTENSIONS[extension as keyof typeof RECOVERABLE_EXTENSIONS] ??
    null
  );
}

export function getExtension(fileName: string): string {
  const clean = fileName.split("?")[0] ?? fileName;
  const dot = clean.lastIndexOf(".");

  return dot === -1 ? "" : clean.slice(dot).toLowerCase();
}
