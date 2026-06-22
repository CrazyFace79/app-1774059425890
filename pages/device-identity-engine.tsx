import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import {
  analyzeDeviceIdentity,
  type DeviceIdentityReport,
} from "../device-identity-engine";

const defaultEvidence = `HOSTNAME: CRAZY_FACE
SISTEMA: WINDOWS
api2.cursor.sh
api3.cursor.sh
chatgpt.com
web.whatsapp.com
go-updater.brave.com
studio-api.prod.suno.com
api-eu-north-1.protect.glasswire.com
supabase.co

+9203177469
+1921681154
+19216811049
+1921681104
+860892437799233
+1000000000000
+00000000000

1816 llamadas
0 segundos
0 kbps
0 bytes

VPN eventos: 41
Total eventos: 373378`;

export default function DeviceIdentityEnginePage() {
  const [rawText, setRawText] = useState(defaultEvidence);
  const [report, setReport] = useState<DeviceIdentityReport>(() =>
    analyzeFromText(defaultEvidence)
  );

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReport(analyzeFromText(rawText));
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
      <main style={{ margin: "0 auto", maxWidth: 1120 }}>
        <header style={{ marginBottom: 28 }}>
          <p style={eyebrowStyle}>Device identity engine</p>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", margin: "8px 0" }}>
            Identidad por evidencia, no por numeros contaminados
          </h1>
          <p style={{ color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
            Filtra IPs, IMEIs, tokens e IDs internos antes de asignar identidad.
            Si hay hostname + Windows/Brave/Cursor/GlassWire, prioriza
            WINDOWS_DEVICE.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <form onSubmit={analyze} style={cardStyle}>
            <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
              Evidencia
            </label>
            <textarea
              onChange={(event) => setRawText(event.target.value)}
              rows={20}
              style={inputStyle}
              value={rawText}
            />
            <button style={buttonStyle} type="submit">
              Analyze Device Identity
            </button>
          </form>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Resultado</h2>
            <SummaryLine label="identity" value={report.identity} />
            <SummaryLine label="classification" value={report.classification} />
            <SummaryLine label="device_label" value={report.device_label} />
            <SummaryLine label="identity_source" value={report.identity_source} />
            <SummaryLine
              label="identity_confidence"
              value={`${report.identity_confidence}%`}
            />
            <SummaryLine label="identity_reason" value={report.identity_reason} />
            <SummaryLine
              label="communication"
              value={report.communication_classification}
            />
            <SummaryLine label="vpn_signal_used" value={String(report.vpn_signal_used)} />

            <h3>Rejected identifiers</h3>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={cellHeaderStyle}>value</th>
                  <th style={cellHeaderStyle}>reason</th>
                </tr>
              </thead>
              <tbody>
                {report.rejected_identifiers.map((item) => (
                  <tr key={item.value}>
                    <td style={cellStyle}>{item.value}</td>
                    <td style={cellStyle}>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </main>
    </div>
  );
}

function analyzeFromText(rawText: string): DeviceIdentityReport {
  return analyzeDeviceIdentity({
    rawText,
    callEvents: rawText.includes("1816 llamadas")
      ? Array.from({ length: 3 }, () => ({
          bitrateKbps: 0,
          bytes: 0,
          durationSeconds: 0,
        }))
      : [],
    totalEvents: Number(rawText.match(/Total eventos:\s*(\d+)/i)?.[1] ?? 0),
    vpnEvents: Number(rawText.match(/VPN eventos:\s*(\d+)/i)?.[1] ?? 0),
  });
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderBottom: "1px solid #e2e8f0",
        display: "grid",
        gap: 12,
        gridTemplateColumns: "180px 1fr",
        padding: "10px 0",
      }}
    >
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  color: "#2563eb",
  fontWeight: 900,
  letterSpacing: "0.08em",
  margin: 0,
  textTransform: "uppercase",
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  padding: 24,
};

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxSizing: "border-box",
  fontFamily: "monospace",
  fontSize: 14,
  marginBottom: 16,
  outlineColor: "#2563eb",
  padding: "12px 14px",
  resize: "vertical",
  width: "100%",
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

const cellHeaderStyle: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  color: "#1e3a8a",
  fontSize: 13,
  padding: 10,
  textAlign: "left",
};

const cellStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
  padding: 10,
  verticalAlign: "top",
};
