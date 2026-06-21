import type { PaymentProvider, SourceKind } from "./types";
import {
  BROWSER_ARTIFACT_EXTENSIONS,
  SUPPORTED_EXTENSIONS,
} from "./rules";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const TIME_PATTERN = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const SLASH_DATE_PATTERN = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const LABELED_DATE_PATTERN =
  /\b(?:date|fecha|payment\s+date|paid\s+on|booking\s+date|fecha\s+reserva)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i;
const RESERVATION_PATTERN =
  /\b(?:booking|confirmation|reservation)\s+(?:number|no\.?|id|code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})\b/i;
const AIRBNB_CODE_PATTERN =
  /\bairbnb\s+confirmation\s+code\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i;
const STRIPE_ID_PATTERN = /\b((?:pi|ch|in)_[A-Za-z0-9_]+)\b/;
const PAYPAL_TRANSACTION_PATTERN =
  /\btransaction\s+id\s*[:#-]?\s*([A-Z0-9-]{6,})\b/i;

const AMOUNT_PATTERNS = [
  {
    amountIndex: 2,
    currencyIndex: 1,
    pattern:
      /(EUR|USD|GBP|€|\$|£)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?)/i,
  },
  {
    amountIndex: 1,
    currencyIndex: 2,
    pattern:
      /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?)\s*(EUR|USD|GBP|€|\$|£)\b/i,
  },
];

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getExtension(fileName: string): string {
  const cleanName = fileName.split("?")[0] ?? fileName;
  const dotIndex = cleanName.lastIndexOf(".");

  if (dotIndex === -1) {
    return "";
  }

  return cleanName.slice(dotIndex).toLowerCase();
}

export function isSupportedSourceFile(fileName: string): boolean {
  const extension = getExtension(fileName);

  return SUPPORTED_EXTENSIONS.includes(
    extension as (typeof SUPPORTED_EXTENSIONS)[number]
  );
}

export function inferSourceKind(fileName: string): SourceKind {
  const extension = getExtension(fileName);

  if (
    BROWSER_ARTIFACT_EXTENSIONS.includes(
      extension as (typeof BROWSER_ARTIFACT_EXTENSIONS)[number]
    )
  ) {
    return "browser-artifact";
  }

  if ([".pst", ".ost", ".mbox", ".eml", ".msg"].includes(extension)) {
    return "email";
  }

  if (extension === ".pdf") {
    return "pdf";
  }

  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    return "ocr-image";
  }

  if ([".docx", ".txt"].includes(extension)) {
    return "document";
  }

  if ([".xlsx", ".csv"].includes(extension)) {
    return "spreadsheet";
  }

  if (extension === ".json") {
    return "data";
  }

  return "unknown";
}

export function detectProvider(text: string): PaymentProvider {
  const normalized = normalizeText(text);

  if (/\bbooking\b|booking\.com/.test(normalized)) {
    return "booking";
  }

  if (/\bairbnb\b|airbnb\.com/.test(normalized)) {
    return "airbnb";
  }

  if (/\bstripe\b|payment_intent|\bpi_[a-z0-9_]+/.test(normalized)) {
    return "stripe";
  }

  if (/\bpaypal\b/.test(normalized)) {
    return "paypal";
  }

  return "unknown";
}

export function extractEmail(text: string): string | null {
  return text.match(EMAIL_PATTERN)?.[0] ?? null;
}

export function extractTime(text: string): string | null {
  return text.match(TIME_PATTERN)?.[0] ?? null;
}

export function extractDate(text: string): string | null {
  return (
    text.match(LABELED_DATE_PATTERN)?.[1] ??
    text.match(ISO_DATE_PATTERN)?.[0] ??
    text.match(SLASH_DATE_PATTERN)?.[0] ??
    null
  );
}

export function extractStayDate(text: string): string | null {
  const stayPattern =
    /\b(?:check[-\s]?in|arrival|llegada|fecha\s+estancia|estancia)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i;

  return text.match(stayPattern)?.[1] ?? null;
}

export function extractAmount(text: string): {
  amount: number | null;
  currency: string | null;
} {
  for (const { amountIndex, currencyIndex, pattern } of AMOUNT_PATTERNS) {
    const match = text.match(pattern);

    if (!match?.[amountIndex] || !match?.[currencyIndex]) {
      continue;
    }

    return {
      amount: parseAmount(match[amountIndex]),
      currency: normalizeCurrency(match[currencyIndex]),
    };
  }

  return { amount: null, currency: null };
}

export function extractReservationNumber(text: string): string | null {
  return (
    text.match(AIRBNB_CODE_PATTERN)?.[1] ??
    text.match(STRIPE_ID_PATTERN)?.[1] ??
    text.match(PAYPAL_TRANSACTION_PATTERN)?.[1] ??
    text.match(RESERVATION_PATTERN)?.[1] ??
    null
  );
}

export function extractHotel(text: string): string | null {
  const patterns = [
    /\bhotel\s*[:#-]?\s*([^\n\r,.;]{3,80})/i,
    /\bproperty\s*[:#-]?\s*([^\n\r,.;]{3,80})/i,
    /\balojamiento\s*[:#-]?\s*([^\n\r,.;]{3,80})/i,
  ];

  return extractFirstCleanGroup(text, patterns);
}

export function extractCity(text: string): string | null {
  const patterns = [
    /\bciudad\s*[:#-]?\s*([^\n\r,.;]{2,60})/i,
    /\bcity\s*[:#-]?\s*([^\n\r,.;]{2,60})/i,
    /\bdestino\s*[:#-]?\s*([^\n\r,.;]{2,60})/i,
    /\bdestination\s*[:#-]?\s*([^\n\r,.;]{2,60})/i,
  ];

  return extractFirstCleanGroup(text, patterns);
}

export function createSnippet(text: string, index: number, length = 180): string {
  const half = Math.floor(length / 2);
  const start = Math.max(0, index - half);
  const end = Math.min(text.length, index + half);

  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function providerFromBankText(text: string): PaymentProvider {
  const normalized = normalizeText(text);

  if (/\bbooking\b/.test(normalized)) {
    return "booking";
  }

  if (/\bairbnb\b/.test(normalized)) {
    return "airbnb";
  }

  if (/\bstripe\b/.test(normalized)) {
    return "stripe";
  }

  if (/\bpaypal\b/.test(normalized)) {
    return "paypal";
  }

  return "bank";
}

function parseAmount(value: string): number | null {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: string): string {
  const upper = value.toUpperCase();

  if (upper === "€") {
    return "EUR";
  }

  if (upper === "$") {
    return "USD";
  }

  if (upper === "£") {
    return "GBP";
  }

  return upper;
}

function extractFirstCleanGroup(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();

    if (match) {
      return match.replace(/\s+/g, " ");
    }
  }

  return null;
}
