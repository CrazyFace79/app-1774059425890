import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { recoverMissingEvidence } from "../missing-evidence-recovery";
import type { MissingEvidenceRecoveryReport } from "../missing-evidence-recovery";

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

export default function MissingEvidenceRecoveryPage() {
  const [chatText, setChatText] = useState(sampleChat);
  const [exportedFilesText, setExportedFilesText] = useState(sampleExportedFiles);
  const [candidateFilesText, setCandidateFilesText] = useState(sampleCandidateFiles);
  const [report, setReport] = useState<MissingEvidenceRecoveryReport>(() =>
    buildReport(sampleChat, sampleExportedFiles, sampleCandidateFiles)
  );

  const summary = useMemo(
    () => [
      ["ADJUNTOS MENCIONADOS", report.stats.mentionedAttachments],
      ["ADJUNTOS FALTANTES", report.stats.missingAttachments],
      ["COPIAS CANDIDATAS", report.stats.possibleCopiesFound],
      ["FALTANTES PRIORIDAD ALTA", report.stats.highPriorityMissing],
    ],
    [report]
  );

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReport(buildReport(chatText, exportedFilesText, candidateFilesText));
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
            <button style={buttonStyle} type="submit">
              Localizar adjuntos faltantes
            </button>
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
  candidateFilesText: string
): MissingEvidenceRecoveryReport {
  return recoverMissingEvidence({
    chats: [{ chat: "CHAT_EXPORT", text: chatText }],
    exportedFiles: parseLines(exportedFilesText).map((line) => ({
      name: line.split(/[\\/]/).pop() ?? line,
      path: line,
    })),
    candidateFiles: parseLines(candidateFilesText).map((line) => ({
      name: line.split(/[\\/]/).pop() ?? line,
      path: line,
    })),
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
      <h2 style={{ marginTop: 0 }}>{title}</h2>
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
