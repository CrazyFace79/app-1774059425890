import {
  getRecoverableType,
  HIGH_PRIORITY_KEYWORDS,
  SEARCH_ROOT_LABELS,
} from "./rules";
import type {
  CandidateFile,
  ChatExport,
  ExportedFile,
  MissingAttachmentRow,
  MissingEvidenceRecoveryInput,
  MissingEvidenceRecoveryReport,
  RecoveryCandidateRow,
} from "./types";

const ATTACHMENT_PATTERN =
  /(?:^|[\s"([{<])([^"\n\r()<>[\]{}]{1,180}?\.(?:pdf|jpe?g|png|docx|xlsx))(?=$|[\s"',.;:)\]}>])/gi;

export function recoverMissingEvidence(
  input: MissingEvidenceRecoveryInput
): MissingEvidenceRecoveryReport {
  const exportedIndex = buildExportedIndex(input.exportedFiles ?? []);
  const candidateFiles = input.candidateFiles ?? [];
  const mentionedAttachments = dedupeMentionedAttachments(input.chats);
  const MISSING_ATTACHMENTS = mentionedAttachments
    .map((attachment) => {
      const normalizedName = normalizeFileName(attachment.nombre_archivo);
      const candidateCopies = findCandidateCopies(
        attachment.nombre_archivo,
        candidateFiles
      );
      const exportedPresent = exportedIndex.has(normalizedName);

      return {
        ...attachment,
        estado: exportedPresent
          ? "EXPORTED_PRESENT"
          : candidateCopies.length > 0
            ? "POSSIBLE_COPY_FOUND"
            : "MISSING_FROM_EXPORT",
      } satisfies MissingAttachmentRow;
    })
    .filter((row) => row.estado !== "EXPORTED_PRESENT");
  const RECOVERY_CANDIDATES = MISSING_ATTACHMENTS.flatMap((row) =>
    findCandidateCopies(row.nombre_archivo, candidateFiles).map((candidate) =>
      toRecoveryCandidate(row.nombre_archivo, candidate)
    )
  ).sort((left, right) => right.prioridad - left.prioridad);
  const prioritizedMissingAttachments = [...MISSING_ATTACHMENTS].sort(
    (left, right) => scoreAttachment(right.nombre_archivo) - scoreAttachment(left.nombre_archivo)
  );

  return {
    MISSING_ATTACHMENTS,
    RECOVERY_CANDIDATES,
    prioritizedMissingAttachments,
    stats: {
      mentionedAttachments: mentionedAttachments.length,
      missingAttachments: MISSING_ATTACHMENTS.length,
      possibleCopiesFound: MISSING_ATTACHMENTS.filter(
        (row) => row.estado === "POSSIBLE_COPY_FOUND"
      ).length,
      highPriorityMissing: MISSING_ATTACHMENTS.filter(
        (row) => scoreAttachment(row.nombre_archivo) >= 50
      ).length,
    },
  };
}

export function extractMentionedAttachments(chat: ChatExport): MissingAttachmentRow[] {
  const rows: MissingAttachmentRow[] = [];
  const matches = chat.text.matchAll(ATTACHMENT_PATTERN);

  for (const match of matches) {
    const rawName = cleanupFileName(match[1] ?? "");
    const tipo = getRecoverableType(rawName);

    if (!tipo) {
      continue;
    }

    rows.push({
      chat: chat.chat,
      fecha: extractDateNearMatch(chat.text, match.index ?? 0) ?? chat.fecha ?? null,
      nombre_archivo: rawName,
      tipo,
      ruta_original: extractPathNearFileName(chat.text, rawName),
      estado: "MISSING_FROM_EXPORT",
    });
  }

  return rows;
}

export function scoreAttachment(fileName: string): number {
  const normalized = normalizeComparable(fileName);
  const keywordScore = HIGH_PRIORITY_KEYWORDS.reduce((score, keyword) => {
    return normalized.includes(keyword) ? score + 20 : score;
  }, 0);
  const typeScore = fileName.toLowerCase().endsWith(".pdf") ? 10 : 0;

  return keywordScore + typeScore;
}

function dedupeMentionedAttachments(chats: ChatExport[]): MissingAttachmentRow[] {
  const seen = new Set<string>();
  const rows: MissingAttachmentRow[] = [];

  for (const chat of chats) {
    for (const row of extractMentionedAttachments(chat)) {
      const key = `${row.chat}::${normalizeFileName(row.nombre_archivo)}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

function findCandidateCopies(
  fileName: string,
  candidateFiles: CandidateFile[]
): CandidateFile[] {
  const normalizedTarget = normalizeFileName(fileName);
  const targetWithoutExtension = normalizedTarget.replace(/\.[^.]+$/, "");
  const targetTokens = tokenizeFileName(targetWithoutExtension);

  return candidateFiles.filter((candidate) => {
    const normalizedCandidate = normalizeFileName(candidate.name || candidate.path);
    const candidateWithoutExtension = normalizedCandidate.replace(/\.[^.]+$/, "");

    return (
      normalizedCandidate === normalizedTarget ||
      candidateWithoutExtension === targetWithoutExtension ||
      hasPartialTokenMatch(targetTokens, tokenizeFileName(candidateWithoutExtension))
    );
  });
}

function toRecoveryCandidate(
  fileName: string,
  candidate: CandidateFile
): RecoveryCandidateRow {
  const tipo = getRecoverableType(fileName) ?? "PDF";
  const folderLabel = detectSearchRoot(candidate.path);
  const priority = scoreAttachment(fileName) + scoreSearchRoot(candidate.path);

  return {
    nombre_archivo: fileName,
    tipo,
    ruta_candidata: candidate.path,
    carpeta_detectada: folderLabel,
    prioridad: priority,
    motivo_prioridad: buildPriorityReason(fileName, candidate.path),
    estado: "COPY_CANDIDATE",
  };
}

function buildExportedIndex(exportedFiles: ExportedFile[]): Set<string> {
  return new Set(
    exportedFiles.map((file) => normalizeFileName(file.name || file.path || ""))
  );
}

function cleanupFileName(fileName: string): string {
  const withoutChatLabel = fileName.includes(":")
    ? fileName.split(":").pop() ?? fileName
    : fileName;

  return withoutChatLabel
    .replace(/^.*\b(adjunto|attachment|file|archivo|imagen enviada|documento)\b\s*/i, "")
    .replace(/^[\s"'([{<]+/, "")
    .replace(/[\s"',.;:)\]}>]+$/, "")
    .trim();
}

function normalizeFileName(fileName: string): string {
  const lastPathSegment = fileName.split(/[\\/]/).pop() ?? fileName;

  return normalizeComparable(lastPathSegment);
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenizeFileName(value: string): string[] {
  return normalizeComparable(value)
    .replace(/\.[^.]+$/, "")
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function hasPartialTokenMatch(leftTokens: string[], rightTokens: string[]): boolean {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const rightTokenSet = new Set(rightTokens);
  const matchingTokens = leftTokens.filter((token) => rightTokenSet.has(token));
  const minimumMatches = Math.min(3, leftTokens.length);

  return matchingTokens.length >= minimumMatches;
}

function extractPathNearFileName(text: string, fileName: string): string | null {
  const index = text.indexOf(fileName);

  if (index === -1) {
    return null;
  }

  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + fileName.length + 180);
  const windowText = text.slice(start, end);
  const escapedName = escapeRegExp(fileName);
  const pathPattern = new RegExp(
    `([A-Za-z]:[\\\\/][^\\n\\r"'<>|]*${escapedName}|[~/][^\\n\\r"'<>|]*${escapedName})`,
    "i"
  );

  return windowText.match(pathPattern)?.[1]?.trim() ?? null;
}

function extractDateNearMatch(text: string, index: number): string | null {
  const start = Math.max(0, index - 120);
  const end = Math.min(text.length, index + 120);
  const windowText = text.slice(start, end);

  return (
    windowText.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ??
    windowText.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] ??
    null
  );
}

function detectSearchRoot(path: string): string {
  return (
    SEARCH_ROOT_LABELS.find((root) => root.pattern.test(path))?.label ??
    "Unknown"
  );
}

function scoreSearchRoot(path: string): number {
  const label = detectSearchRoot(path);

  if (["WhatsApp Media", "Downloads", "Documents"].includes(label)) {
    return 15;
  }

  if (["Google Drive", "OneDrive", "Android backups", "Desktop"].includes(label)) {
    return 10;
  }

  return 0;
}

function buildPriorityReason(fileName: string, path: string): string {
  const normalized = normalizeComparable(fileName);
  const keywords = HIGH_PRIORITY_KEYWORDS.filter((keyword) =>
    normalized.includes(keyword)
  );
  const folder = detectSearchRoot(path);
  const reasons = [];

  if (keywords.length > 0) {
    reasons.push(`keywords: ${keywords.join(", ")}`);
  }

  if (folder !== "Unknown") {
    reasons.push(`folder: ${folder}`);
  }

  return reasons.length > 0 ? reasons.join(" | ") : "filename match";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
