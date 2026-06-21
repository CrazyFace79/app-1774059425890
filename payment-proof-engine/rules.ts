import type { EvidenceLevel, PaymentProvider, SourceKind } from "./types";

export interface Rule {
  label: string;
  provider: PaymentProvider;
  pattern: RegExp;
  level: EvidenceLevel;
  type: "payment-confirmed" | "reservation-confirmed" | "checkout" | "visit";
}

export const SUPPORTED_EXTENSIONS = [
  ".pst",
  ".ost",
  ".mbox",
  ".eml",
  ".msg",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  ".json",
] as const;

export const CONFIRMED_EVIDENCE_RULES: Rule[] = [
  {
    label: "Booking Confirmation",
    provider: "booking",
    pattern: /\bbooking\s+confirmation\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Reservation Confirmed",
    provider: "booking",
    pattern: /\breservation\s+confirmed\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Booking Number",
    provider: "booking",
    pattern: /\bbooking\s+(number|no\.?|id)\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Confirmation Number",
    provider: "booking",
    pattern: /\bconfirmation\s+(number|no\.?|id)\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Hotel Voucher",
    provider: "booking",
    pattern: /\bhotel\s+voucher\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Airbnb Reservation Confirmed",
    provider: "airbnb",
    pattern: /\breservation\s+confirmed\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Trip Confirmed",
    provider: "airbnb",
    pattern: /\btrip\s+confirmed\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Airbnb Receipt",
    provider: "airbnb",
    pattern: /\breceipt\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Airbnb Confirmation Code",
    provider: "airbnb",
    pattern: /\bairbnb\s+confirmation\s+code\b/i,
    level: 3,
    type: "reservation-confirmed",
  },
  {
    label: "Stripe payment_intent",
    provider: "stripe",
    pattern: /\b(payment_intent|pi_[a-z0-9_]+)\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe payment succeeded",
    provider: "stripe",
    pattern: /\bpayment\s+succeeded\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe receipt",
    provider: "stripe",
    pattern: /\b(receipt|receipt_url|receipt\s+number)\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe invoice paid",
    provider: "stripe",
    pattern: /\binvoice\s+paid\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe charge succeeded",
    provider: "stripe",
    pattern: /\bcharge\s+succeeded\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe charge",
    provider: "stripe",
    pattern: /\b(charge|ch_[a-z0-9_]+)\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe invoice",
    provider: "stripe",
    pattern: /\b(invoice|in_[a-z0-9_]+)\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe order confirmation",
    provider: "stripe",
    pattern: /\border\s+confirmation\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Stripe succeeded=true",
    provider: "stripe",
    pattern: /\bsucceeded\s*=\s*true\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "PayPal Payment Completed",
    provider: "paypal",
    pattern: /\bpayment\s+completed\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "PayPal Transaction ID",
    provider: "paypal",
    pattern: /\btransaction\s+id\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "PayPal Receipt",
    provider: "paypal",
    pattern: /\breceipt\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "PayPal Payment Sent",
    provider: "paypal",
    pattern: /\bpayment\s+sent\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "PayPal Pago realizado",
    provider: "paypal",
    pattern: /\bpago\s+realizado\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Bank movement BOOKING",
    provider: "booking",
    pattern: /\bBOOKING\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Bank movement AIRBNB",
    provider: "airbnb",
    pattern: /\bAIRBNB\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Bank movement STRIPE",
    provider: "stripe",
    pattern: /\bSTRIPE\b/i,
    level: 3,
    type: "payment-confirmed",
  },
  {
    label: "Bank movement PAYPAL",
    provider: "paypal",
    pattern: /\bPAYPAL\b/i,
    level: 3,
    type: "payment-confirmed",
  },
];

export const CHECKOUT_RULES: Rule[] = [
  {
    label: "booking visit",
    provider: "booking",
    pattern: /\b(booking\.com|booking visit|visit[aó]?\s+booking)\b/i,
    level: 0,
    type: "visit",
  },
  {
    label: "airbnb visit",
    provider: "airbnb",
    pattern: /\b(airbnb\.com|airbnb visit|visit[aó]?\s+airbnb)\b/i,
    level: 0,
    type: "visit",
  },
  {
    label: "stripe checkout",
    provider: "stripe",
    pattern:
      /\b(stripe\s+checkout|checkout\.stripe\.com|checkout\s+session|merchant-ui-api\.stripe\.com)\b/i,
    level: 1,
    type: "checkout",
  },
  {
    label: "paypal checkout",
    provider: "paypal",
    pattern: /\b(paypal\s+checkout|paypal\.com\/checkout|checkout\s+paypal)\b/i,
    level: 1,
    type: "checkout",
  },
  {
    label: "reserva iniciada",
    provider: "booking",
    pattern: /\b(reserva\s+iniciada|reservation\s+started|start(ed)?\s+reservation|pending\s+reservation)\b/i,
    level: 2,
    type: "checkout",
  },
];

export const STRIPE_ACTIVITY_PATTERN =
  /\b(api\.stripe\.com|checkout\.stripe\.com|merchant-ui-api\.stripe\.com)\b/i;

export const STRIPE_CHECKOUT_FLOW_PATTERN =
  /\b(checkout\.stripe\.com|stripe\s+checkout|checkout\s+session|cs_(?:test|live)_[a-z0-9_]+|merchant-ui-api\.stripe\.com)\b/i;

export const STRIPE_VERIFIED_PAYMENT_PATTERNS = [
  {
    field: "payment_intent",
    label: "payment_intent",
    pattern: /\b(payment_intent|pi_(?:test|live)?_?[a-z0-9_]+|pi_[a-z0-9_]+)\b/i,
  },
  {
    field: "charge",
    label: "charge",
    pattern: /\b(charge|charge\s+succeeded|ch_(?:test|live)?_?[a-z0-9_]+|ch_[a-z0-9_]+)\b/i,
  },
  {
    field: "receipt",
    label: "receipt",
    pattern: /\b(receipt|receipt\s+number|receipt_url|recibo)\b/i,
  },
  {
    field: "invoice",
    label: "invoice",
    pattern: /\b(invoice|invoice\s+paid|in_(?:test|live)?_?[a-z0-9_]+|factura)\b/i,
  },
  {
    field: "order_confirmation",
    label: "order confirmation",
    pattern: /\b(order\s+confirmation|order\s+confirmed|confirmaci[oó]n\s+de\s+pedido)\b/i,
  },
] as const;

export const STRIPE_MERCHANT_PATTERN =
  /\b(?:merchant\s+name|merchant|comercio|nombre\s+comercio|seller|vendor)\s*[:#=]\s*([^\n\r,.;]{2,80})/i;

export const SUBSCRIPTION_PATTERN =
  /\b(subscription|subscription_id|sub_[a-z0-9_]+|recurring|renewal|plan|mensual|suscripci[oó]n|renovaci[oó]n)\b/i;

export const NOISE_PATTERNS = [
  /\bdns\b/i,
  /\bcookie(s)?\b/i,
  /\bbrowser\s+cache\b/i,
  /\bcache\s+(navegador|browser)\b/i,
  /\bhistorial\s+(de\s+)?navegaci[oó]n\b/i,
  /\bbrowsing\s+history\b/i,
  /\b(pop[-\s]?up|ventana\s+emergente)\b/i,
  /\b(advertising|advertisement|publicidad|anuncio)\b/i,
  /\bscript(s)?\s+(de\s+)?b[uú]squeda\b/i,
  /\b(search|tracking|analytics)\s+script\b/i,
  /\brefer(er|ence|encia)\b/i,
  /\b(domain|dominio)\s+(reference|referencia)\b/i,
];

export const BROWSER_ARTIFACT_EXTENSIONS = [
  ".sqlite",
  ".history",
  ".cookie",
  ".cache",
] as const;

export const DOCUMENTARY_SOURCE_KINDS: SourceKind[] = [
  "email",
  "pdf",
  "ocr-image",
  "document",
  "spreadsheet",
  "data",
];

export const BANK_CONTEXT_PATTERN =
  /\b(bank|banco|extracto|statement|movimiento|movimientos|cargo|tarjeta|cuenta|debit|credit|transferencia)\b/i;
