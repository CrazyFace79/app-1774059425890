import type { CSSProperties, ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { recoverMissingEvidence } from "../missing-evidence-recovery";
import type {
  MissingEvidenceRecoveryReport,
  RecoveryCandidateRow,
} from "../missing-evidence-recovery";

const sampleChat = `2026-06-21 12:42
Cliente: Te paso adjunto MENU'S HOTEL VILLA CEUTI.pdf
Otro archivo: booking_invoice_villa_ceuti.xlsx
Imagen enviada: reserva_hotel_ceuti.png`;

const sampleExportedFiles = `chat.txt
reserva_hotel_ceuti.png`;

const sampleCandidateFiles = `C:\\Users\\Usuario\\Downloads\\MENU'S HOTEL VILLA CEUTI.pdf
C:\\Users\\Usuario\\Documents\\booking_invoice_villa_ceuti.xlsx
C:\\Users\\Usuario\\OneDrive\\Travel\\MENU'S HOTEL VILLA CEUTI.pdf`;

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

export default function MissingEvidenceRecoveryPage() {
  const [chatText, setChatText] = useState(sampleChat);
  const [exportedFilesText, setExportedFilesText] = useState(sampleExportedFiles);
  const [candidateFilesText, setCandidateFilesText] = useState(sampleCandidateFiles);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedRecoveredFile[]>([]);
  const [selectedRecoveredKeys, setSelectedRecoveredKeys] = useState<string[]>([]);
  const [report, setReport] = useState<MissingEvidenceRecoveryReport>(() =>
    buildReport(sampleChat, sampleExportedFiles, sampleCandidateFiles, [])
  );
  const lostFiles = useMemo(
    () =>
      report.MISSING_ATTACHMENTS.filter(
        (row) => row.estado === "MISSING_FROM_EXPORT"
      ),
    [report]
  );
  const recoveredFiles = useMemo(
    () => report.RECOVERY_CANDIDATES,
    [report]
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

  const summary = useMemo(
    () => [
      ["ADJUNTOS MENCIONADOS", report.stats.mentionedAttachments],
      ["ADJUNTOS FALTANTES", report.stats.missingAttachments],
      ["COPIAS CANDIDATAS", report.stats.possibleCopiesFound],
      ["FALTANTES PRIORIDAD ALTA", report.stats.highPriorityMissing],
      ["ARCHIVOS SUBIDOS PARA DESCARGA", uploadedFiles.length],
    ],
    [report, uploadedFiles.length]
  );

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReport(
      buildReport(chatText, exportedFilesText, candidateFilesText, uploadedFiles)
    );
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
              ARCHIVOS_RECUPERADOS con boton de descarga. Una ruta tipo C:\ no se
              puede descargar por si sola desde el navegador.
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
                disabled={selectedUploadedFiles.length === 0}
                onClick={() => downloadUploadedFiles(selectedUploadedFiles)}
                style={{
                  ...buttonStyle,
                  background:
                    selectedUploadedFiles.length === 0 ? "#94a3b8" : "#16a34a",
                  cursor:
                    selectedUploadedFiles.length === 0 ? "not-allowed" : "pointer",
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
  onSelectAllDownloadable,
  onToggleSelection,
  rows,
  selectedKeys,
  title,
  uploadedFiles,
}: {
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
            disabled={!rows.some((row) => findUploadedFile(row.nombre_archivo, uploadedFiles))}
            onClick={onSelectAllDownloadable}
            style={{
              ...buttonStyle,
              background: "#16a34a",
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
                      disabled={!uploadedFile}
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
                        Sube el archivo para descargarlo
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

function normalizeDownloadName(fileName: string): string {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
