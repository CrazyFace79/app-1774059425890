export type EvidenceLevel = 0 | 1 | 2 | 3 | 4;

export type PaymentProvider =
  | "booking"
  | "airbnb"
  | "stripe"
  | "paypal"
  | "bank"
  | "unknown";

export type SourceKind =
  | "email"
  | "pdf"
  | "ocr-image"
  | "document"
  | "spreadsheet"
  | "data"
  | "browser-artifact"
  | "unknown";

export type FindingKind = "payment" | "reservation" | "suspicion";

export interface PaymentProofDocument {
  fileName: string;
  text: string;
  filePath?: string;
  extension?: string;
  sourceKind?: SourceKind;
  extractedBy?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PaymentProofOptions {
  /**
   * Default is LEVEL 3, so visits/checkouts are retained in
   * SOSPECHAS_SIN_CONFIRMAR but hidden from visible findings.
   */
  minimumVisibleLevel?: EvidenceLevel;
}

export interface EvidenceMatch {
  label: string;
  pattern: string;
  snippet: string;
}

export interface PaymentProofFinding {
  level: EvidenceLevel;
  kind: FindingKind;
  provider: PaymentProvider;
  fileName: string;
  filePath?: string;
  sourceKind: SourceKind;
  tipoEvidencia: string;
  matchedEvidence: EvidenceMatch[];
  confidenceScore: number;
  fecha: string | null;
  hora: string | null;
  importe: number | null;
  moneda: string | null;
  hotel: string | null;
  ciudad: string | null;
  correoAsociado: string | null;
  numeroReserva: string | null;
  fechaEstancia: string | null;
  evidenceText: string;
}

export interface PagosConfirmadosRow {
  fecha: string | null;
  hora: string | null;
  proveedor: PaymentProvider;
  importe: number | null;
  moneda: string | null;
  hotel: string | null;
  ciudad: string | null;
  correo_asociado: string | null;
  archivo_origen: string;
  tipo_evidencia: string;
  confidence_score: number;
}

export interface ReservasConfirmadasRow {
  fecha_reserva: string | null;
  fecha_estancia: string | null;
  hotel: string | null;
  destino: string | null;
  plataforma: PaymentProvider;
  numero_reserva: string | null;
  importe: number | null;
  evidencia: string;
}

export interface SospechaSinConfirmarRow {
  fecha: string | null;
  proveedor: PaymentProvider;
  archivo_origen: string;
  tipo_sospecha: string;
  nivel: EvidenceLevel;
  motivo_no_confirmado: string;
  evidencia: string;
}

export interface PaymentProofSummary {
  pagosConfirmadosEncontrados: number;
  reservasConfirmadasEncontradas: number;
  importeTotalDetectado: number;
  monedaPrincipal: string | null;
  evidenciasDocumentales: number;
  finalMessage: string;
}

export interface PaymentProofReport {
  findings: PaymentProofFinding[];
  visibleFindings: PaymentProofFinding[];
  PAGOS_CONFIRMADOS: PagosConfirmadosRow[];
  RESERVAS_CONFIRMADAS: ReservasConfirmadasRow[];
  SOSPECHAS_SIN_CONFIRMAR: SospechaSinConfirmarRow[];
  summary: PaymentProofSummary;
}
