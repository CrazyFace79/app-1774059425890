import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  extractMentionedAttachments,
  recoverMissingEvidence,
} from "../missing-evidence-recovery";
import type {
  ChatExport,
  ExportedFile,
  MissingEvidenceRecoveryReport,
  RecoveryCandidateRow,
} from "../missing-evidence-recovery";

const EMPTY_REPORT = recoverMissingEvidence({
  chats: [],
  candidateFiles: [],
  exportedFiles: [],
});

const sectionStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  padding: 24,
};

const buttonStyle: CSSProperties = {
  background: "#111827",
  border: 0,
  borderRadius: 12,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "13px 18px",
};

type UploadedRecoveredFile = {
  name: string;
  size: number;
  type: string;
  url: string;
};

type ZipFileRecord = {
  name: string;
  path: string;
  sizeBytes: number;
};

type LocalFileRecord = {
  file: File;
  name: string;
  path: string;
};

type DirectoryHandleLike = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FileHandleLike | DirectoryHandleLike>;
};

type FileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

export default function MissingEvidenceRecoveryPage() {
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const [chatText, setChatText] = useState("");
  const [exportedFilesText, setExportedFilesText] = useState("");
  const [candidateFilesText, setCandidateFilesText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedRecoveredFile[]>([]);
  const [selectedRecoveredKeys, setSelectedRecoveredKeys] = useState<string[]>([]);
  const [zipStatus, setZipStatus] = useState("Ningun ZIP cargado.");
  const [zipFileRecords, setZipFileRecords] = useState<ZipFileRecord[]>([]);
  const [zipRecoveredRows, setZipRecoveredRows] = useState<RecoveryCandidateRow[]>(
    []
  );
  const [realScanStatus, setRealScanStatus] = useState(
    "Modo real listo. Pulsa SCAN REAL SYSTEM y selecciona una carpeta."
  );
  const [realScanStats, setRealScanStats] = useState({
    scanned: 0,
    found: 0,
    recovered: 0,
  });
  const [report, setReport] = useState<MissingEvidenceRecoveryReport>(
    EMPTY_REPORT
  );
  const lostFiles = useMemo(
    () =>
      report.MISSING_ATTACHMENTS.filter(
        (row) => row.estado === "MISSING_FROM_EXPORT"
      ),
    [report]
  );
  const recoveredFiles = useMemo(
    () => mergeRecoveredRows(zipRecoveredRows, report.RECOVERY_CANDIDATES),
    [report, zipRecoveredRows]
  );
  const recoveredCsvRows = useMemo(
    () =>
      recoveredFiles.map((row) => ({
        ...row,
        descargable: Boolean(findUploadedFile(row.nombre_archivo, uploadedFiles))
          ? "SI"
          : "NO",
      })),
    [recoveredFiles, uploadedFiles]
  );
  const selectedUploadedFiles = useMemo(
    () =>
      dedupeUploadedFiles(
        recoveredFiles
          .filter((row) => selectedRecoveredKeys.includes(getRecoveredKey(row)))
          .map((row) => findUploadedFile(row.nombre_archivo, uploadedFiles))
          .filter((file): file is UploadedRecoveredFile => Boolean(file))
      ),
    [recoveredFiles, selectedRecoveredKeys, uploadedFiles]
  );
  const selectedRecoveredRows = useMemo(
    () =>
      recoveredFiles.filter((row) =>
        selectedRecoveredKeys.includes(getRecoveredKey(row))
      ),
    [recoveredFiles, selectedRecoveredKeys]
  );

  const summary = useMemo(
    () => [
      ["ARCHIVOS ESCANEADOS", realScanStats.scanned],
      ["ARCHIVOS ENCONTRADOS", realScanStats.found],
      ["ARCHIVOS RECUPERADOS", realScanStats.recovered],
      ["ADJUNTOS MENCIONADOS", report.stats.mentionedAttachments],
      ["ADJUNTOS FALTANTES", report.stats.missingAttachments],
      ["COPIAS CANDIDATAS", report.stats.possibleCopiesFound],
      ["ARCHIVOS INDEXADOS EN ZIP", zipFileRecords.length],
      ["RECUPERADOS EN ZIP", zipRecoveredRows.length],
      ["FALTANTES PRIORIDAD ALTA", report.stats.highPriorityMissing],
      ["ARCHIVOS SUBIDOS PARA DESCARGA", uploadedFiles.length],
    ],
    [
      report,
      realScanStats.found,
      realScanStats.recovered,
      realScanStats.scanned,
      uploadedFiles.length,
      zipFileRecords.length,
      zipRecoveredRows.length,
    ]
  );

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReport(
      buildReport(chatText, exportedFilesText, candidateFilesText, uploadedFiles)
    );
    setZipRecoveredRows(buildZipRecoveredRows(chatText, exportedFilesText));
  };

  const scanRealSystem = async () => {
    setSelectedRecoveredKeys([]);

    if ((window as WindowWithDirectoryPicker).showDirectoryPicker) {
      try {
        setRealScanStatus("Selecciona tu carpeta de usuario, Downloads, Documents, Desktop, OneDrive, Google Drive o WhatsApp exports.");
        const directoryHandle = await (
          window as WindowWithDirectoryPicker
        ).showDirectoryPicker?.();

        if (!directoryHandle) {
          return;
        }

        setRealScanStatus(`Escaneando carpeta: ${directoryHandle.name}...`);
        const files = await collectDirectoryFiles(directoryHandle);
        await applyRealFilesScan(files, `Escaneo real: ${directoryHandle.name}`);
      } catch (error) {
        setRealScanStatus(
          error instanceof Error
            ? `Escaneo cancelado o bloqueado: ${error.message}`
            : "Escaneo cancelado o bloqueado."
        );
      }

      return;
    }

    setRealScanStatus(
      "Tu navegador requiere seleccionar una carpeta mediante el selector de archivos."
    );
    directoryInputRef.current?.setAttribute("webkitdirectory", "");
    directoryInputRef.current?.click();
  };

  const handleDirectoryFallback = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []).map((file) => ({
      file,
      name: file.name,
      path:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    }));

    await applyRealFilesScan(files, "Escaneo real desde carpeta seleccionada");
  };

  const handleZipUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setZipStatus(`Leyendo ZIP: ${file.name}...`);
    setSelectedRecoveredKeys([]);

    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir);
      const fileRecords = entries.map((entry) => ({
        name: entry.name.split(/[\\/]/).pop() ?? entry.name,
        path: entry.name,
        sizeBytes: 0,
      }));
      const readableEntries = entries.filter((entry) =>
        /\.(txt|csv|json)$/i.test(entry.name)
      );
      const chatExports: ChatExport[] = await Promise.all(
        readableEntries.map(async (entry) => ({
          chat: entry.name,
          sourceFile: entry.name,
          text: await entry.async("string"),
        }))
      );
      const nextChatText = chatExports
        .map((chat) => `--- ${chat.chat} ---\n${chat.text}`)
        .join("\n\n");
      const nextExportedFilesText = fileRecords
        .map((record) => record.path)
        .join("\n");
      const nextReport = recoverMissingEvidence({
        chats: chatExports,
        exportedFiles: fileRecords,
        candidateFiles: fileRecords.map((record) => ({
          name: record.name,
          path: record.path,
          sizeBytes: record.sizeBytes,
        })),
      });
      const recoveredRows = buildZipRecoveredRowsFromChats(
        chatExports,
        fileRecords,
        "ZIP"
      );
      const recoveredPathSet = new Set(
        recoveredRows.map((row) => normalizeZipPath(row.ruta_candidata))
      );
      const zipRecoveredFiles = await Promise.all(
        entries
          .filter((entry) => recoveredPathSet.has(normalizeZipPath(entry.name)))
          .map(async (entry) => {
            const blob = await entry.async("blob");
            const name = entry.name.split(/[\\/]/).pop() ?? entry.name;

            return {
              name,
              size: blob.size,
              type: blob.type || "application/octet-stream",
              url: URL.createObjectURL(blob),
            };
          })
      );

      setChatText(nextChatText);
      setExportedFilesText(nextExportedFilesText);
      setCandidateFilesText(nextExportedFilesText);
      setZipFileRecords(fileRecords);
      setZipRecoveredRows(recoveredRows);
      uploadedFiles.forEach((uploadedFile) => URL.revokeObjectURL(uploadedFile.url));
      setUploadedFiles(zipRecoveredFiles);
      setRealScanStats({
        scanned: fileRecords.length,
        found: fileRecords.length,
        recovered: recoveredRows.length,
      });
      setReport(nextReport);
      setZipStatus(
        `ZIP analizado: ${fileRecords.length} archivos indexados, ${readableEntries.length} TXT/CSV/JSON leidos, ${recoveredRows.length} adjuntos recuperados.`
      );
    } catch (error) {
      setZipStatus(
        error instanceof Error
          ? `Error leyendo ZIP: ${error.message}`
          : "Error leyendo ZIP."
      );
    }
  };

  const handleRecoveredFileUpload = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    uploadedFiles.forEach((file) => URL.revokeObjectURL(file.url));
    setSelectedRecoveredKeys([]);
    const nextUploadedFiles = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      url: URL.createObjectURL(file),
    }));

    setUploadedFiles(nextUploadedFiles);
    setReport(
      buildReport(
        chatText,
        exportedFilesText,
        candidateFilesText,
        nextUploadedFiles
      )
    );
  };

  const applyRealFilesScan = async (
    files: LocalFileRecord[],
    statusPrefix: string
  ) => {
    const fileRecords = files.map((record) => ({
      name: record.name,
      path: record.path,
      sizeBytes: record.file.size,
    }));
    const readableFiles = files.filter((record) =>
      /\.(txt|csv|json)$/i.test(record.name)
    );
    const chatExports: ChatExport[] = await Promise.all(
      readableFiles.map(async (record) => ({
        chat: record.path,
        sourceFile: record.path,
        text: await record.file.text(),
      }))
    );
    const downloadableFiles = files.filter((record) =>
      /\.(pdf|xlsx|jpe?g|png)$/i.test(record.name)
    );
    const nextUploadedFiles = downloadableFiles.map((record) => ({
      name: record.name,
      size: record.file.size,
      type: record.file.type || "application/octet-stream",
      url: URL.createObjectURL(record.file),
    }));
    const nextChatText = chatExports
      .map((chat) => `--- ${chat.chat} ---\n${chat.text}`)
      .join("\n\n");
    const nextFilesText = fileRecords.map((record) => record.path).join("\n");
    const nextReport = recoverMissingEvidence({
      chats: chatExports,
      exportedFiles: fileRecords,
      candidateFiles: fileRecords,
    });
    const recoveredRows = buildZipRecoveredRowsFromChats(
      chatExports,
      fileRecords,
      "Carpeta seleccionada"
    );

    uploadedFiles.forEach((file) => URL.revokeObjectURL(file.url));
    setUploadedFiles(nextUploadedFiles);
    setChatText(nextChatText);
    setExportedFilesText(nextFilesText);
    setCandidateFilesText(nextFilesText);
    setZipRecoveredRows(recoveredRows);
    setReport(nextReport);
    setRealScanStats({
      scanned: files.length,
      found: fileRecords.length,
      recovered: recoveredRows.length,
    });
    setRealScanStatus(
      `${statusPrefix}: ${files.length} archivos escaneados, ${downloadableFiles.length} PDF/XLSX/imagenes cargados en la interfaz, ${recoveredRows.length} adjuntos recuperados.`
    );
  };

  return (
    <div
      style={{
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        minHeight: "100vh",
        padding: "42px 20px",
      }}
    >
      <main style={{ margin: "0 auto", maxWidth: 1180 }}>
        <header style={{ marginBottom: 28 }}>
          <p
            style={{
              color: "#dc2626",
              fontWeight: 900,
              letterSpacing: "0.08em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Missing evidence recovery
          </p>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", margin: "8px 0" }}>
            Adjuntos mencionados, pero no exportados
          </h1>
          <p style={{ color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
            Detecta PDFs, JPG, PNG, DOCX y XLSX mencionados en chats, comprueba
            si faltan en la exportacion y busca copias candidatas en Downloads,
            Desktop, Documents, WhatsApp Media, Android backups, Google Drive y
            OneDrive.
          </p>
        </header>

        <section
          style={{
            ...sectionStyle,
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            marginBottom: 24,
          }}
        >
          <form onSubmit={analyze}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button
                onClick={scanRealSystem}
                style={{ ...buttonStyle, background: "#dc2626" }}
                type="button"
              >
                SCAN REAL SYSTEM
              </button>
              <input
                multiple
                onChange={handleDirectoryFallback}
                ref={directoryInputRef}
                style={{ display: "none" }}
                type="file"
              />
            </div>
            <p style={{ color: "#64748b", lineHeight: 1.5 }}>
              Modo real: selecciona una carpeta fisica. El navegador no permite
              acceder automaticamente a C:\ ni detectar el usuario Windows sin tu
              permiso.
            </p>
            <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
              Subir exportacion ZIP
            </label>
            <input
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleZipUpload}
              style={{
                ...inputStyle,
                fontFamily: "inherit",
                resize: "none",
              }}
              type="file"
            />
            <p style={{ color: "#64748b", lineHeight: 1.5, marginTop: -8 }}>
              Lee la estructura interna del ZIP, indexa todos los archivos y
              analiza automaticamente TXT, CSV y JSON como chats exportados.
            </p>
            <LabeledTextarea
              label="Texto de chats exportados"
              onChange={setChatText}
              rows={8}
              value={chatText}
            />
            <LabeledTextarea
              label="Archivos que SI salieron en la exportacion"
              onChange={setExportedFilesText}
              rows={5}
              value={exportedFilesText}
            />
            <LabeledTextarea
              label="Inventario de rutas donde buscar copias"
              onChange={setCandidateFilesText}
              rows={6}
              value={candidateFilesText}
            />
            <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
              Subir archivos recuperados para descargar
            </label>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              multiple
              onChange={handleRecoveredFileUpload}
              style={{
                ...inputStyle,
                fontFamily: "inherit",
                resize: "none",
              }}
              type="file"
            />
            <p style={{ color: "#64748b", lineHeight: 1.5, marginTop: -8 }}>
              Si subes aqui el archivo fisico original, aparecera en
              ARCHIVOS_RECUPERADOS con boton de descarga. Puedes seleccionar
              cualquier fila; si no hay archivo fisico subido, el boton descarga
              un CSV manifest con las rutas candidatas seleccionadas.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button style={buttonStyle} type="submit">
                Scan Missing Evidence
              </button>
              <button
                onClick={() =>
                  downloadCsv("missing-evidence-report.csv", [
                    ...report.MISSING_ATTACHMENTS,
                    ...recoveredCsvRows,
                  ])
                }
                style={{ ...buttonStyle, background: "#dc2626" }}
                type="button"
              >
                Exportar CSV
              </button>
              <button
                disabled={selectedRecoveredRows.length === 0}
                onClick={() =>
                  downloadSelectedRecoveredFiles(
                    selectedRecoveredRows,
                    selectedUploadedFiles
                  )
                }
                style={{
                  ...buttonStyle,
                  background:
                    selectedRecoveredRows.length === 0 ? "#94a3b8" : "#16a34a",
                  cursor:
                    selectedRecoveredRows.length === 0 ? "not-allowed" : "pointer",
                }}
                type="button"
              >
                Descargar seleccionados
              </button>
            </div>
          </form>

          <div
            style={{
              background: "#0f172a",
              borderRadius: 18,
              color: "#ffffff",
              padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Resumen</h2>
            <p
              style={{
                background: "#1e293b",
                borderRadius: 12,
                lineHeight: 1.5,
                padding: 12,
              }}
            >
              {realScanStatus}
            </p>
            <p
              style={{
                background: "#1e293b",
                borderRadius: 12,
                lineHeight: 1.5,
                padding: 12,
              }}
            >
              {zipStatus}
            </p>
            {summary.map(([label, value]) => (
              <div
                key={label}
                style={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.16)",
                  display: "flex",
                  gap: 16,
                  justifyContent: "space-between",
                  padding: "12px 0",
                }}
              >
                <span style={{ color: "#cbd5e1", fontWeight: 800 }}>
                  {label}
                </span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <ResultSection
          rows={lostFiles}
          title="ARCHIVOS_PERDIDOS"
        />
        <RecoveredFilesSection
          onSelectAll={() =>
            setSelectedRecoveredKeys(recoveredFiles.map(getRecoveredKey))
          }
          onSelectAllDownloadable={() =>
            setSelectedRecoveredKeys(
              recoveredFiles
                .filter((row) => findUploadedFile(row.nombre_archivo, uploadedFiles))
                .map(getRecoveredKey)
            )
          }
          onToggleSelection={(key) =>
            setSelectedRecoveredKeys((current) =>
              current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key]
            )
          }
          rows={recoveredFiles}
          selectedKeys={selectedRecoveredKeys}
          uploadedFiles={uploadedFiles}
          title="ARCHIVOS_RECUPERADOS"
        />
        <ResultSection
          rows={report.MISSING_ATTACHMENTS}
          title="MISSING_ATTACHMENTS"
        />
        <ResultSection
          rows={report.RECOVERY_CANDIDATES}
          title="RECOVERY_CANDIDATES"
        />
      </main>
    </div>
  );
}

function buildReport(
  chatText: string,
  exportedFilesText: string,
  candidateFilesText: string,
  uploadedFiles: UploadedRecoveredFile[]
): MissingEvidenceRecoveryReport {
  return recoverMissingEvidence({
    chats: [{ chat: "CHAT_EXPORT", text: chatText }],
    exportedFiles: parseLines(exportedFilesText).map((line) => ({
      name: line.split(/[\\/]/).pop() ?? line,
      path: line,
    })),
    candidateFiles: [
      ...parseLines(candidateFilesText).map((line) => ({
        name: line.split(/[\\/]/).pop() ?? line,
        path: line,
      })),
      ...uploadedFiles.map((file) => ({
        name: file.name,
        path: `uploaded://${file.name}`,
        sizeBytes: file.size,
      })),
    ],
  });
}

function buildZipRecoveredRows(
  chatText: string,
  exportedFilesText: string
): RecoveryCandidateRow[] {
  const chats: ChatExport[] = [{ chat: "CHAT_EXPORT", text: chatText }];
  const exportedFiles = parseLines(exportedFilesText).map((line) => ({
    name: line.split(/[\\/]/).pop() ?? line,
    path: line,
  }));

  return buildZipRecoveredRowsFromChats(chats, exportedFiles, "Manual");
}

function buildZipRecoveredRowsFromChats(
  chats: ChatExport[],
  exportedFiles: ExportedFile[],
  sourceLabel: string
): RecoveryCandidateRow[] {
  const exportedByName = new Map(
    exportedFiles.map((file) => [normalizeDownloadName(file.name), file])
  );
  const rows = chats
    .flatMap((chat) => extractMentionedAttachments(chat))
    .flatMap((attachment) => {
      const matchedFile = exportedByName.get(
        normalizeDownloadName(attachment.nombre_archivo)
      );

      if (!matchedFile) {
        return [];
      }

      return [
        {
          nombre_archivo: attachment.nombre_archivo,
          tipo: attachment.tipo,
          ruta_candidata: matchedFile.path ?? matchedFile.name,
          carpeta_detectada: sourceLabel,
          prioridad: 100,
          motivo_prioridad: `archivo fisico presente en ${sourceLabel}`,
          estado: "COPY_CANDIDATE" as const,
        },
      ];
    });

  return dedupeRecoveredRows(rows);
}

function mergeRecoveredRows(
  zipRows: RecoveryCandidateRow[],
  candidateRows: RecoveryCandidateRow[]
): RecoveryCandidateRow[] {
  return dedupeRecoveredRows([...zipRows, ...candidateRows]);
}

function dedupeRecoveredRows(rows: RecoveryCandidateRow[]): RecoveryCandidateRow[] {
  const seen = new Set<string>();
  const result: RecoveryCandidateRow[] = [];

  for (const row of rows) {
    const key = getRecoveredKey(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(row);
  }

  return result;
}

async function collectDirectoryFiles(
  directoryHandle: DirectoryHandleLike,
  prefix = directoryHandle.name
): Promise<LocalFileRecord[]> {
  const files: LocalFileRecord[] = [];

  for await (const entry of directoryHandle.values()) {
    const entryPath = `${prefix}/${entry.name}`;

    if (entry.kind === "file") {
      const file = await entry.getFile();
      files.push({
        file,
        name: file.name || entry.name,
        path: entryPath,
      });
      continue;
    }

    files.push(...(await collectDirectoryFiles(entry, entryPath)));
  }

  return files;
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function LabeledTextarea({
  label,
  onChange,
  rows,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <>
      <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
        {label}
      </label>
      <textarea
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        style={inputStyle}
        value={value}
      />
    </>
  );
}

function ResultSection<T extends object>({
  rows,
  title,
}: {
  rows: T[];
  title: string;
}) {
  return (
    <section style={{ ...sectionStyle, marginBottom: 24, overflowX: "auto" }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`${title.toLowerCase()}.csv`, rows)}
          style={{
            ...buttonStyle,
            background: rows.length === 0 ? "#94a3b8" : "#334155",
            cursor: rows.length === 0 ? "not-allowed" : "pointer",
            padding: "10px 14px",
          }}
          type="button"
        >
          Exportar CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>Sin resultados.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", minWidth: 900, width: "100%" }}>
          <thead>
            <tr>
              {Object.keys(rows[0] ?? {}).map((key) => (
                <th key={key} style={cellHeaderStyle}>
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {Object.values(row).map((value, valueIndex) => (
                  <td key={`${title}-${index}-${valueIndex}`} style={cellStyle}>
                    {value ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RecoveredFilesSection({
  onSelectAll,
  onSelectAllDownloadable,
  onToggleSelection,
  rows,
  selectedKeys,
  title,
  uploadedFiles,
}: {
  onSelectAll: () => void;
  onSelectAllDownloadable: () => void;
  onToggleSelection: (key: string) => void;
  rows: RecoveryCandidateRow[];
  selectedKeys: string[];
  title: string;
  uploadedFiles: UploadedRecoveredFile[];
}) {
  const csvRows = rows.map((row) => ({
    ...row,
    descargable: Boolean(findUploadedFile(row.nombre_archivo, uploadedFiles))
      ? "SI"
      : "NO",
  }));

  return (
    <section style={{ ...sectionStyle, marginBottom: 24, overflowX: "auto" }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            disabled={rows.length === 0}
            onClick={onSelectAll}
            style={{
              ...buttonStyle,
              background: rows.length === 0 ? "#94a3b8" : "#dc2626",
              cursor: rows.length === 0 ? "not-allowed" : "pointer",
              padding: "10px 14px",
            }}
            type="button"
          >
            Seleccionar todos
          </button>
          <button
            disabled={!rows.some((row) => findUploadedFile(row.nombre_archivo, uploadedFiles))}
            onClick={onSelectAllDownloadable}
            style={{
              ...buttonStyle,
              background: rows.some((row) =>
                findUploadedFile(row.nombre_archivo, uploadedFiles)
              )
                ? "#16a34a"
                : "#94a3b8",
              cursor: rows.some((row) =>
                findUploadedFile(row.nombre_archivo, uploadedFiles)
              )
                ? "pointer"
                : "not-allowed",
              padding: "10px 14px",
            }}
            type="button"
          >
            Seleccionar descargables
          </button>
          <button
            disabled={rows.length === 0}
            onClick={() => downloadCsv(`${title.toLowerCase()}.csv`, csvRows)}
            style={{
              ...buttonStyle,
              background: rows.length === 0 ? "#94a3b8" : "#334155",
              cursor: rows.length === 0 ? "not-allowed" : "pointer",
              padding: "10px 14px",
            }}
            type="button"
          >
            Exportar CSV
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>Sin resultados.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%" }}>
          <thead>
            <tr>
              <th style={cellHeaderStyle}>seleccionar</th>
              <th style={cellHeaderStyle}>nombre_archivo</th>
              <th style={cellHeaderStyle}>tipo</th>
              <th style={cellHeaderStyle}>ruta_candidata</th>
              <th style={cellHeaderStyle}>carpeta_detectada</th>
              <th style={cellHeaderStyle}>prioridad</th>
              <th style={cellHeaderStyle}>estado</th>
              <th style={cellHeaderStyle}>descarga</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const uploadedFile = findUploadedFile(
                row.nombre_archivo,
                uploadedFiles
              );
              const recoveredKey = getRecoveredKey(row);

              return (
                <tr key={`${title}-${index}`}>
                  <td style={cellStyle}>
                    <input
                      checked={selectedKeys.includes(recoveredKey)}
                      onChange={() => onToggleSelection(recoveredKey)}
                      type="checkbox"
                    />
                  </td>
                  <td style={cellStyle}>{row.nombre_archivo}</td>
                  <td style={cellStyle}>{row.tipo}</td>
                  <td style={cellStyle}>{row.ruta_candidata}</td>
                  <td style={cellStyle}>{row.carpeta_detectada}</td>
                  <td style={cellStyle}>{row.prioridad}</td>
                  <td style={cellStyle}>{row.estado}</td>
                  <td style={cellStyle}>
                    {uploadedFile ? (
                      <button
                        onClick={() => downloadUploadedFiles([uploadedFile])}
                        style={{
                          ...buttonStyle,
                          padding: "9px 12px",
                        }}
                        type="button"
                      >
                        Descargar archivo
                      </button>
                    ) : (
                      <span style={{ color: "#64748b" }}>
                        Seleccionable: descarga manifest CSV
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function findUploadedFile(
  fileName: string,
  uploadedFiles: UploadedRecoveredFile[]
): UploadedRecoveredFile | undefined {
  const normalizedFileName = normalizeDownloadName(fileName);

  return uploadedFiles.find(
    (file) => normalizeDownloadName(file.name) === normalizedFileName
  );
}

function getRecoveredKey(row: RecoveryCandidateRow): string {
  return `${row.nombre_archivo}::${row.ruta_candidata}`;
}

function dedupeUploadedFiles(
  files: UploadedRecoveredFile[]
): UploadedRecoveredFile[] {
  const seen = new Set<string>();
  const result: UploadedRecoveredFile[] = [];

  for (const file of files) {
    const key = normalizeDownloadName(file.name);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(file);
  }

  return result;
}

function downloadUploadedFiles(files: UploadedRecoveredFile[]) {
  dedupeUploadedFiles(files).forEach((file, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");

      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, index * 250);
  });
}

function downloadSelectedRecoveredFiles(
  rows: RecoveryCandidateRow[],
  files: UploadedRecoveredFile[]
) {
  if (rows.length === 0) {
    return;
  }

  downloadCsv(
    "archivos-recuperados-seleccionados.csv",
    rows.map((row) => ({
      ...row,
      archivo_fisico_subido: files.some(
        (file) =>
          normalizeDownloadName(file.name) ===
          normalizeDownloadName(row.nombre_archivo)
      )
        ? "SI"
        : "NO",
    }))
  );

  if (files.length > 0) {
    downloadUploadedFiles(files);
  }
}

function normalizeDownloadName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

function downloadCsv(fileName: string, rows: object[]) {
  if (rows.length === 0) {
    return;
  }

  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCsv(rows: object[]): string {
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
  const lines = rows.map((row) =>
    headers
      .map((header) =>
        escapeCsvValue((row as Record<string, unknown>)[header] ?? "")
      )
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

function escapeCsvValue(value: unknown): string {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxSizing: "border-box",
  fontFamily: "monospace",
  fontSize: 14,
  marginBottom: 16,
  outlineColor: "#dc2626",
  padding: "12px 14px",
  resize: "vertical",
  width: "100%",
};

const cellHeaderStyle: CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
  padding: 10,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
  padding: 10,
  verticalAlign: "top",
};
