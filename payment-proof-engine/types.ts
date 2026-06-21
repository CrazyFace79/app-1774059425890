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

export type PaymentConfidence = "LOW" | "MEDIUM" | "HIGH";

export type StripeClassification =
  | "STRIPE_ACTIVITY"
  | "VERIFIED_PAYMENT"
  | "SUBSCRIPTION_DETECTED";

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
  paymentConfidence: PaymentConfidence | null;
  stripeClassification: StripeClassification | null;
  fecha: string | null;
  hora: string | null;
  importe: number | null;
  moneda: string | null;
  hotel: string | null;
  ciudad: string | null;
  correoAsociado: string | null;
  merchantName: string | null;
  numeroReserva: string | null;
  fechaEstancia: string | null;
  evidenceText: string;
}

export interface StripeActivityRow {
  fecha: string | null;
  hora: string | null;
  dominio: string | null;
  actividad: string;
  archivo_origen: string;
  PAYMENT_CONFIDENCE: PaymentConfidence;
  evidencia: string;
}

export interface VerifiedPaymentRow {
  fecha: string | null;
  hora: string | null;
  proveedor: PaymentProvider;
  merchant_name: string | null;
  importe: number | null;
  moneda: string | null;
  payment_intent: string | null;
  charge: string | null;
  receipt: string | null;
  invoice: string | null;
  order_confirmation: string | null;
  archivo_origen: string;
  PAYMENT_CONFIDENCE: PaymentConfidence;
  confidence_score: number;
}

export interface SuscripcionDetectadaRow {
  fecha: string | null;
  proveedor: PaymentProvider;
  merchant_name: string | null;
  subscription_id: string | null;
  plan: string | null;
  importe: number | null;
  moneda: string | null;
  archivo_origen: string;
  evidencia: string;
  PAYMENT_CONFIDENCE: PaymentConfidence;
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
  STRIPE_ACTIVITY: StripeActivityRow[];
  VERIFIED_PAYMENT: VerifiedPaymentRow[];
  SUSCRIPCIONES_DETECTADAS: SuscripcionDetectadaRow[];
  summary: PaymentProofSummary;
}
