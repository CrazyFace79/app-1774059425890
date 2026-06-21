import {
  BANK_CONTEXT_PATTERN,
  CHECKOUT_RULES,
  CONFIRMED_EVIDENCE_RULES,
  DOCUMENTARY_SOURCE_KINDS,
  NOISE_PATTERNS,
  type Rule,
} from "./rules";
import {
  createSnippet,
  detectProvider,
  extractAmount,
  extractCity,
  extractDate,
  extractEmail,
  extractHotel,
  extractReservationNumber,
  extractStayDate,
  extractTime,
  inferSourceKind,
  normalizeText,
  providerFromBankText,
} from "./extractors";
import type {
  EvidenceLevel,
  EvidenceMatch,
  FindingKind,
  PagosConfirmadosRow,
  PaymentProofDocument,
  PaymentProofFinding,
  PaymentProofOptions,
  PaymentProofReport,
  PaymentProofSummary,
  PaymentProvider,
  ReservasConfirmadasRow,
  SospechaSinConfirmarRow,
  SourceKind,
} from "./types";

const NO_EVIDENCE_MESSAGE =
  "NO HAY EVIDENCIA SUFICIENTE PARA AFIRMAR QUE EXISTIÓ UN PAGO O RESERVA CONFIRMADA";

export function analyzePaymentProofDocuments(
  documents: PaymentProofDocument[],
  options: PaymentProofOptions = {}
): PaymentProofReport {
  const minimumVisibleLevel = options.minimumVisibleLevel ?? 3;
  const findings = documents.flatMap((document) => analyzeDocument(document));
  const visibleFindings = findings.filter(
    (finding) => finding.level >= minimumVisibleLevel
  );
  const PAGOS_CONFIRMADOS = findings
    .filter((finding) => finding.level >= 3 && finding.kind === "payment")
    .map(toPagoConfirmadoRow);
  const RESERVAS_CONFIRMADAS = findings
    .filter(isConfirmedReservationFinding)
    .map(toReservaConfirmadaRow);
  const SOSPECHAS_SIN_CONFIRMAR = findings
    .filter((finding) => finding.level < 3)
    .map(toSospechaSinConfirmarRow);
  const summary = buildSummary(PAGOS_CONFIRMADOS, RESERVAS_CONFIRMADAS, findings);

  return {
    findings,
    visibleFindings,
    PAGOS_CONFIRMADOS,
    RESERVAS_CONFIRMADAS,
    SOSPECHAS_SIN_CONFIRMAR,
    summary,
  };
}

export function analyzeDocument(
  document: PaymentProofDocument
): PaymentProofFinding[] {
  const sourceKind = document.sourceKind ?? inferSourceKind(document.fileName);
  const text = document.text.trim();

  if (!text) {
    return [];
  }

  const confirmedMatches = findConfirmedMatches(text, sourceKind);

  if (confirmedMatches.length > 0 && sourceKind !== "browser-artifact") {
    const confirmedFinding = buildConfirmedFinding(
      document,
      sourceKind,
      confirmedMatches
    );
    const confirmedProviders = new Set(
      confirmedMatches.map((match) => match.rule.provider)
    );
    const unresolvedSuspicionMatches = findSuspicionMatches(text).filter(
      (match) => !confirmedProviders.has(match.rule.provider)
    );

    return [
      confirmedFinding,
      ...buildSuspicionFindings(
        document,
        sourceKind,
        unresolvedSuspicionMatches
      ),
    ];
  }

  const suspicionMatches = findSuspicionMatches(text);

  if (suspicionMatches.length > 0 || isNoiseOnly(text, sourceKind)) {
    return buildSuspicionFindings(document, sourceKind, suspicionMatches);
  }

  return [];
}

function findConfirmedMatches(
  text: string,
  sourceKind: SourceKind
): Array<{ rule: Rule; evidence: EvidenceMatch }> {
  if (sourceKind === "browser-artifact") {
    return [];
  }

  const detectedProvider = detectProvider(text);
  const amount = extractAmount(text).amount;

  return CONFIRMED_EVIDENCE_RULES.flatMap((rule) => {
    if (!isRuleApplicable(rule, text, detectedProvider, amount)) {
      return [];
    }

    const matchIndex = text.search(rule.pattern);

    if (matchIndex === -1) {
      return [];
    }

    if (isNegatedEvidence(text, matchIndex)) {
      return [];
    }

    return [
      {
        rule,
        evidence: {
          label: rule.label,
          pattern: rule.pattern.source,
          snippet: createSnippet(text, matchIndex),
        },
      },
    ];
  });
}

function buildSuspicionFindings(
  document: PaymentProofDocument,
  sourceKind: SourceKind,
  matches: Array<{ rule: Rule; evidence: EvidenceMatch }>
): PaymentProofFinding[] {
  if (matches.length === 0) {
    return [buildSuspicionFinding(document, sourceKind, [])];
  }

  const bestMatchByProvider = new Map<
    PaymentProvider,
    { rule: Rule; evidence: EvidenceMatch }
  >();

  for (const match of matches) {
    const current = bestMatchByProvider.get(match.rule.provider);

    if (!current || match.rule.level > current.rule.level) {
      bestMatchByProvider.set(match.rule.provider, match);
    }
  }

  return Array.from(bestMatchByProvider.values()).map((match) =>
    buildSuspicionFinding(document, sourceKind, [match])
  );
}

function findSuspicionMatches(
  text: string
): Array<{ rule: Rule; evidence: EvidenceMatch }> {
  return CHECKOUT_RULES.flatMap((rule) => {
    const matchIndex = text.search(rule.pattern);

    if (matchIndex === -1) {
      return [];
    }

    return [
      {
        rule,
        evidence: {
          label: rule.label,
          pattern: rule.pattern.source,
          snippet: createSnippet(text, matchIndex),
        },
      },
    ];
  });
}

function buildConfirmedFinding(
  document: PaymentProofDocument,
  sourceKind: SourceKind,
  matches: Array<{ rule: Rule; evidence: EvidenceMatch }>
): PaymentProofFinding {
  const { amount, currency } = extractAmount(document.text);
  const numeroReserva = extractReservationNumber(document.text);
  const provider = chooseConfirmedProvider(document.text, matches);
  const hasReservationEvidence = matches.some(
    (match) => match.rule.type === "reservation-confirmed"
  );
  const level = calculateConfirmedLevel(sourceKind, {
    amount,
    numeroReserva,
    matches,
  });
  const kind: FindingKind = "payment";

  return {
    level,
    kind,
    provider,
    fileName: document.fileName,
    filePath: document.filePath,
    sourceKind,
    tipoEvidencia: matches.map((match) => match.rule.label).join(", "),
    matchedEvidence: matches.map((match) => match.evidence),
    confidenceScore: calculateConfidenceScore(level, {
      amount,
      numeroReserva,
      hasEmail: Boolean(extractEmail(document.text)),
      hasReservationEvidence,
    }),
    fecha: extractDate(document.text),
    hora: extractTime(document.text),
    importe: amount,
    moneda: currency,
    hotel: extractHotel(document.text),
    ciudad: extractCity(document.text),
    correoAsociado: extractEmail(document.text),
    numeroReserva,
    fechaEstancia: extractStayDate(document.text),
    evidenceText: matches[0]?.evidence.snippet ?? "",
  };
}

function buildSuspicionFinding(
  document: PaymentProofDocument,
  sourceKind: SourceKind,
  matches: Array<{ rule: Rule; evidence: EvidenceMatch }>
): PaymentProofFinding {
  const strongest = matches.reduce<
    { rule: Rule; evidence: EvidenceMatch } | undefined
  >((current, next) => {
    if (!current || next.rule.level > current.rule.level) {
      return next;
    }

    return current;
  }, undefined);
  const provider = strongest?.rule.provider ?? detectProvider(document.text);
  const level = strongest?.rule.level ?? 0;

  return {
    level,
    kind: "suspicion",
    provider,
    fileName: document.fileName,
    filePath: document.filePath,
    sourceKind,
    tipoEvidencia: strongest?.rule.label ?? "ruido no documental",
    matchedEvidence: matches.map((match) => match.evidence),
    confidenceScore: calculateSuspicionConfidence(level),
    fecha: extractDate(document.text),
    hora: extractTime(document.text),
    importe: extractAmount(document.text).amount,
    moneda: extractAmount(document.text).currency,
    hotel: extractHotel(document.text),
    ciudad: extractCity(document.text),
    correoAsociado: extractEmail(document.text),
    numeroReserva: extractReservationNumber(document.text),
    fechaEstancia: extractStayDate(document.text),
    evidenceText:
      strongest?.evidence.snippet ??
      "Artefacto sin prueba documental o financiera confirmada.",
  };
}

function isRuleApplicable(
  rule: Rule,
  text: string,
  detectedProvider: PaymentProvider,
  amount: number | null
): boolean {
  const normalized = normalizeText(text);
  const isBankMovementRule = rule.label.startsWith("Bank movement");

  if (isBankMovementRule) {
    return amount !== null && BANK_CONTEXT_PATTERN.test(text);
  }

  if (
    ["Airbnb Receipt", "Stripe receipt", "PayPal Receipt"].includes(rule.label)
  ) {
    return detectedProvider === rule.provider;
  }

  if (
    rule.label === "Reservation Confirmed" ||
    rule.label === "Airbnb Reservation Confirmed"
  ) {
    return detectedProvider === rule.provider;
  }

  if (detectedProvider !== "unknown" && detectedProvider !== rule.provider) {
    return false;
  }

  if (detectedProvider === "unknown") {
    return normalized.includes(rule.provider);
  }

  return true;
}

function isNegatedEvidence(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 50);
  const windowEnd = Math.min(text.length, matchIndex + 90);
  const windowText = normalizeText(text.slice(windowStart, windowEnd));

  return (
    /\b(without|sin|no|not|missing|falta|ausente)\b.{0,45}\b(receipt|recibo|confirmation|confirmacion|payment|pago|invoice|factura|transaction|reserva|reservation)\b/.test(
      windowText
    ) ||
    /\b(receipt|recibo|confirmation|confirmacion|payment|pago|invoice|factura|transaction|reserva|reservation)\b.{0,45}\b(missing|falta|ausente|not\s+available|no\s+disponible)\b/.test(
      windowText
    )
  );
}

function chooseConfirmedProvider(
  text: string,
  matches: Array<{ rule: Rule; evidence: EvidenceMatch }>
): PaymentProvider {
  const bankProvider = providerFromBankText(text);

  if (bankProvider !== "bank") {
    return bankProvider;
  }

  return matches[0]?.rule.provider ?? detectProvider(text);
}

function calculateConfirmedLevel(
  sourceKind: SourceKind,
  details: {
    amount: number | null;
    numeroReserva: string | null;
    matches: Array<{ rule: Rule; evidence: EvidenceMatch }>;
  }
): EvidenceLevel {
  const isDocumentarySource = DOCUMENTARY_SOURCE_KINDS.includes(sourceKind);
  const hasHardIdentifier =
    details.amount !== null ||
    details.numeroReserva !== null ||
    details.matches.some((match) =>
      /\b(receipt|invoice|voucher|transaction|payment_intent|number|code)\b/i.test(
        match.rule.label
      )
    );

  return isDocumentarySource && hasHardIdentifier ? 4 : 3;
}

function calculateConfidenceScore(
  level: EvidenceLevel,
  details: {
    amount: number | null;
    numeroReserva: string | null;
    hasEmail: boolean;
    hasReservationEvidence: boolean;
  }
): number {
  let score = level === 4 ? 0.88 : 0.72;

  if (details.amount !== null) {
    score += 0.04;
  }

  if (details.numeroReserva) {
    score += 0.04;
  }

  if (details.hasEmail) {
    score += 0.02;
  }

  if (details.hasReservationEvidence) {
    score += 0.02;
  }

  return roundScore(Math.min(score, 0.99));
}

function calculateSuspicionConfidence(level: EvidenceLevel): number {
  if (level === 2) {
    return 0.5;
  }

  if (level === 1) {
    return 0.35;
  }

  return 0.2;
}

function isNoiseOnly(text: string, sourceKind: SourceKind): boolean {
  if (sourceKind === "browser-artifact") {
    return true;
  }

  const hasNoise = NOISE_PATTERNS.some((pattern) => pattern.test(text));
  const mentionsProvider = /\b(booking\.com|airbnb\.com|stripe|paypal)\b/i.test(
    text
  );

  return hasNoise && mentionsProvider;
}

function isConfirmedReservationFinding(finding: PaymentProofFinding): boolean {
  if (finding.level < 3) {
    return false;
  }

  if (!["booking", "airbnb"].includes(finding.provider)) {
    return false;
  }

  return (
    finding.numeroReserva !== null ||
    /\b(reservation|booking|confirmation|trip|voucher)\b/i.test(
      finding.tipoEvidencia
    )
  );
}

function toPagoConfirmadoRow(
  finding: PaymentProofFinding
): PagosConfirmadosRow {
  return {
    fecha: finding.fecha,
    hora: finding.hora,
    proveedor: finding.provider,
    importe: finding.importe,
    moneda: finding.moneda,
    hotel: finding.hotel,
    ciudad: finding.ciudad,
    correo_asociado: finding.correoAsociado,
    archivo_origen: finding.filePath ?? finding.fileName,
    tipo_evidencia: finding.tipoEvidencia,
    confidence_score: finding.confidenceScore,
  };
}

function toReservaConfirmadaRow(
  finding: PaymentProofFinding
): ReservasConfirmadasRow {
  return {
    fecha_reserva: finding.fecha,
    fecha_estancia: finding.fechaEstancia,
    hotel: finding.hotel,
    destino: finding.ciudad,
    plataforma: finding.provider,
    numero_reserva: finding.numeroReserva,
    importe: finding.importe,
    evidencia: finding.evidenceText,
  };
}

function toSospechaSinConfirmarRow(
  finding: PaymentProofFinding
): SospechaSinConfirmarRow {
  return {
    fecha: finding.fecha,
    proveedor: finding.provider,
    archivo_origen: finding.filePath ?? finding.fileName,
    tipo_sospecha: finding.tipoEvidencia,
    nivel: finding.level,
    motivo_no_confirmado:
      "No contiene prueba documental o financiera de pago/reserva confirmada.",
    evidencia: finding.evidenceText,
  };
}

function buildSummary(
  pagos: PagosConfirmadosRow[],
  reservas: ReservasConfirmadasRow[],
  findings: PaymentProofFinding[]
): PaymentProofSummary {
  const importeTotalDetectado = pagos.reduce(
    (total, row) => total + (row.importe ?? 0),
    0
  );
  const evidenciasDocumentales = findings.filter(
    (finding) => finding.level === 4
  ).length;
  const monedaPrincipal = getMainCurrency(pagos);
  const hasSufficientEvidence =
    pagos.length > 0 || reservas.length > 0 || evidenciasDocumentales > 0;

  return {
    pagosConfirmadosEncontrados: pagos.length,
    reservasConfirmadasEncontradas: reservas.length,
    importeTotalDetectado,
    monedaPrincipal,
    evidenciasDocumentales,
    finalMessage: hasSufficientEvidence
      ? "Se encontraron evidencias documentales o financieras suficientes para los hallazgos confirmados."
      : NO_EVIDENCE_MESSAGE,
  };
}

function getMainCurrency(rows: PagosConfirmadosRow[]): string | null {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.moneda) {
      continue;
    }

    counts.set(row.moneda, (counts.get(row.moneda) ?? 0) + 1);
  }

  return (
    Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null
  );
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
