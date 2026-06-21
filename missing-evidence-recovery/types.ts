export type RecoverableAttachmentType = "PDF" | "JPG" | "PNG" | "DOCX" | "XLSX";

export type MissingAttachmentStatus =
  | "MISSING_FROM_EXPORT"
  | "POSSIBLE_COPY_FOUND"
  | "EXPORTED_PRESENT";

export interface ChatExport {
  chat: string;
  text: string;
  fecha?: string | null;
  sourceFile?: string;
}

export interface ExportedFile {
  name: string;
  path?: string;
}

export interface CandidateFile {
  name: string;
  path: string;
  textPreview?: string;
  sizeBytes?: number;
  modifiedAt?: string;
}

export interface MissingAttachmentRow {
  chat: string;
  fecha: string | null;
  nombre_archivo: string;
  tipo: RecoverableAttachmentType;
  ruta_original: string | null;
  estado: MissingAttachmentStatus;
}

export interface RecoveryCandidateRow {
  nombre_archivo: string;
  tipo: RecoverableAttachmentType;
  ruta_candidata: string;
  carpeta_detectada: string;
  prioridad: number;
  motivo_prioridad: string;
  estado: "COPY_CANDIDATE";
}

export interface MissingEvidenceRecoveryReport {
  MISSING_ATTACHMENTS: MissingAttachmentRow[];
  RECOVERY_CANDIDATES: RecoveryCandidateRow[];
  prioritizedMissingAttachments: MissingAttachmentRow[];
  stats: {
    mentionedAttachments: number;
    missingAttachments: number;
    possibleCopiesFound: number;
    highPriorityMissing: number;
  };
}

export interface MissingEvidenceRecoveryInput {
  chats: ChatExport[];
  exportedFiles?: ExportedFile[];
  candidateFiles?: CandidateFile[];
}
