import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { analyzePaymentProofDocuments } from "../payment-proof-engine";
import type { PaymentProofReport } from "../payment-proof-engine";

const sampleEvidence = `api.stripe.com request observed
checkout.stripe.com checkout flow opened
merchant-ui-api.stripe.com dashboard activity

Merchant name: Inferno Demo Shop
payment_intent: pi_live_123456789
charge succeeded: ch_live_987654321
receipt_url: https://pay.stripe.com/receipts/demo
invoice paid: in_live_555555
Order confirmation: ORD-777
Date: 2026-06-21
Time: 14:36
Total: EUR 249.90
customer@example.com

subscription: sub_live_222222
plan: Premium mensual`;

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

export default function PaymentProofEnginePage() {
  const [fileName, setFileName] = useState("stripe-receipt.eml");
  const [text, setText] = useState(sampleEvidence);
  const [showSuspicions, setShowSuspicions] = useState(false);
  const [report, setReport] = useState<PaymentProofReport>(() =>
    analyzePaymentProofDocuments([{ fileName, text }])
  );

  const totalLabel = useMemo(() => {
    const { importeTotalDetectado, monedaPrincipal } = report.summary;

    return `${importeTotalDetectado.toFixed(2)}${
      monedaPrincipal ? ` ${monedaPrincipal}` : ""
    }`;
  }, [report]);

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReport(analyzePaymentProofDocuments([{ fileName, text }]));
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
              color: "#2563eb",
              fontWeight: 900,
              letterSpacing: "0.08em",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Payment proof engine
          </p>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", margin: "8px 0" }}>
            Evidencia real, no visitas web
          </h1>
          <p style={{ color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
            Clasifica hallazgos en LEVEL 0-4. Por defecto muestra solo pagos o
            reservas confirmadas con evidencia LEVEL 3 y LEVEL 4. Los dominios
            Stripe se separan como actividad y no se cuentan como pago.
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
            <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
              Archivo origen
            </label>
            <input
              onChange={(event) => setFileName(event.target.value)}
              style={inputStyle}
              value={fileName}
            />

            <label style={{ display: "block", fontWeight: 800, marginBottom: 8 }}>
              Texto extraido del correo/PDF/OCR/documento
            </label>
            <textarea
              onChange={(event) => setText(event.target.value)}
              rows={15}
              style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
              value={text}
            />

            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                marginTop: 16,
              }}
            >
              <button style={buttonStyle} type="submit">
                Analizar evidencia
              </button>
              <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input
                  checked={showSuspicions}
                  onChange={(event) => setShowSuspicions(event.target.checked)}
                  type="checkbox"
                />
                Mostrar sospechas LEVEL 0-2
              </label>
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
            <h2 style={{ marginTop: 0 }}>Informe final</h2>
            <SummaryLine
              label="PAGOS CONFIRMADOS ENCONTRADOS"
              value={report.summary.pagosConfirmadosEncontrados}
            />
            <SummaryLine
              label="RESERVAS CONFIRMADAS ENCONTRADAS"
              value={report.summary.reservasConfirmadasEncontradas}
            />
            <SummaryLine label="IMPORTE TOTAL DETECTADO" value={totalLabel} />
            <SummaryLine
              label="EVIDENCIAS DOCUMENTALES"
              value={report.summary.evidenciasDocumentales}
            />
            <p
              style={{
                background: "#1e293b",
                borderRadius: 12,
                lineHeight: 1.5,
                marginBottom: 0,
                padding: 14,
              }}
            >
              {report.summary.finalMessage}
            </p>
          </div>
        </section>

        <ResultSection
          rows={report.STRIPE_ACTIVITY}
          title="STRIPE_ACTIVITY"
        />
        <ResultSection
          rows={report.VERIFIED_PAYMENT}
          title="VERIFIED_PAYMENT"
        />
        <ResultSection
          rows={report.SUSCRIPCIONES_DETECTADAS}
          title="SUSCRIPCIONES_DETECTADAS"
        />
        <ResultSection
          rows={report.PAGOS_CONFIRMADOS}
          title="PAGOS_CONFIRMADOS"
        />
        <ResultSection
          rows={report.RESERVAS_CONFIRMADAS}
          title="RESERVAS_CONFIRMADAS"
        />

        {showSuspicions && (
          <ResultSection
            rows={report.SOSPECHAS_SIN_CONFIRMAR}
            title="SOSPECHAS_SIN_CONFIRMAR"
          />
        )}
      </main>
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxSizing: "border-box",
  fontSize: 15,
  marginBottom: 16,
  outlineColor: "#2563eb",
  padding: "12px 14px",
  width: "100%",
};

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.16)",
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
      }}
    >
      <span style={{ color: "#cbd5e1", fontWeight: 800 }}>{label}</span>
      <strong>{value}</strong>
    </div>
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

const cellHeaderStyle: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  color: "#1e3a8a",
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
