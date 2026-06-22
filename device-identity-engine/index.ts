export type DeviceClassification =
  | "WINDOWS_DEVICE"
  | "PHONE_IDENTITY"
  | "UNKNOWN_DEVICE";

export type CommunicationClassification =
  | "CONFIRMED_CALL"
  | "POSSIBLE_COMMUNICATION_SIGNAL";

export interface DeviceIdentityInput {
  rawText?: string;
  hostnames?: string[];
  domains?: string[];
  candidatePhones?: string[];
  callEvents?: Array<{
    durationSeconds?: number;
    bytes?: number;
    bitrateKbps?: number;
  }>;
  vpnEvents?: number;
  totalEvents?: number;
}

export interface RejectedIdentifier {
  value: string;
  reason: string;
}

export interface DeviceIdentityReport {
  identity: string;
  classification: DeviceClassification;
  device_label: string;
  identity_source: string;
  identity_confidence: number;
  identity_reason: string;
  valid_phones: string[];
  rejected_identifiers: RejectedIdentifier[];
  communication_classification: CommunicationClassification;
  communication_reason: string;
  vpn_signal_used: boolean;
  vpn_reason: string;
}

const WINDOWS_SIGNAL_PATTERNS = [
  /\bwindows\b/i,
  /\bwindows\s+update\b/i,
  /\bbrave\b/i,
  /\bcursor\b/i,
  /\bglasswire\b/i,
  /\bapi2\.cursor\.sh\b/i,
  /\bapi3\.cursor\.sh\b/i,
  /\bgo-updater\.brave\.com\b/i,
  /\bapi-eu-north-1\.protect\.glasswire\.com\b/i,
];

const PHONE_CONTEXT_PATTERN =
  /\b(sms|call|calls|llamada|llamadas|agenda|contact|contacts|contacto|phone|telefono|teléfono|whatsapp)\b/i;

export function analyzeDeviceIdentity(
  input: DeviceIdentityInput
): DeviceIdentityReport {
  const rawText = input.rawText ?? "";
  const domains = unique([
    ...(input.domains ?? []),
    ...extractDomains(rawText),
  ]);
  const hostnames = unique([
    ...(input.hostnames ?? []),
    ...extractHostnames(rawText),
  ]);
  const candidateIdentifiers = unique([
    ...(input.candidatePhones ?? []),
    ...extractPlusIdentifiers(rawText),
  ]);
  const rejectedIdentifiers: RejectedIdentifier[] = [];
  const validPhones = candidateIdentifiers.filter((identifier) => {
    const rejectionReason = getRejectedIdentifierReason(identifier, rawText);

    if (rejectionReason) {
      rejectedIdentifiers.push({
        value: identifier,
        reason: rejectionReason,
      });
      return false;
    }

    return true;
  });
  const windowsSignalCount = countWindowsSignals(rawText, domains);
  const hostname = chooseHostname(hostnames);
  const communication = classifyCommunication(input.callEvents ?? []);
  const vpn = classifyVpnSignal(input.vpnEvents ?? 0, input.totalEvents ?? 0);

  if (hostname && windowsSignalCount >= 2) {
    return {
      identity: hostname,
      classification: "WINDOWS_DEVICE",
      device_label: "Windows PC",
      identity_source: "hostname",
      identity_confidence: 98,
      identity_reason: `${hostname} + Windows telemetry + ${describeWindowsSignals(
        rawText,
        domains
      )}`,
      valid_phones: validPhones,
      rejected_identifiers: rejectedIdentifiers,
      communication_classification: communication.classification,
      communication_reason: communication.reason,
      vpn_signal_used: vpn.used,
      vpn_reason: vpn.reason,
    };
  }

  if (validPhones.length > 0 && hasRepeatedPhoneContext(validPhones[0], rawText)) {
    return {
      identity: validPhones[0],
      classification: "PHONE_IDENTITY",
      device_label: "Phone identity",
      identity_source: "validated_phone_context",
      identity_confidence: 80,
      identity_reason:
        "E164 phone appears repeatedly with SMS/calls/contacts context.",
      valid_phones: validPhones,
      rejected_identifiers: rejectedIdentifiers,
      communication_classification: communication.classification,
      communication_reason: communication.reason,
      vpn_signal_used: vpn.used,
      vpn_reason: vpn.reason,
    };
  }

  return {
    identity: hostname ?? "UNKNOWN_DEVICE",
    classification: hostname ? "WINDOWS_DEVICE" : "UNKNOWN_DEVICE",
    device_label: hostname ? "Windows PC" : "Unknown device",
    identity_source: hostname ? "hostname" : "insufficient_evidence",
    identity_confidence: hostname ? 90 : 0,
    identity_reason: hostname
      ? "Hostname present but Windows corroboration is limited."
      : "No validated hostname or phone identity found.",
    valid_phones: validPhones,
    rejected_identifiers: rejectedIdentifiers,
    communication_classification: communication.classification,
    communication_reason: communication.reason,
    vpn_signal_used: vpn.used,
    vpn_reason: vpn.reason,
  };
}

function getRejectedIdentifierReason(
  identifier: string,
  rawText: string
): string | null {
  const digits = identifier.replace(/\D/g, "");

  if (looksLikeIpDerivedPhone(identifier, rawText)) {
    return "IP-derived value, not a phone number.";
  }

  if (/^0+$/.test(digits) || /^1(?:0+)$/.test(digits)) {
    return "Placeholder/internal zero-like identifier.";
  }

  if (digits.length === 15 && /^[0-9]+$/.test(digits)) {
    return "Possible IMEI, not owner identity.";
  }

  if (digits.length > 14) {
    return "Too long for E164 phone; likely token/internal ID.";
  }

  if (!/^\+[1-9]\d{7,14}$/.test(identifier)) {
    return "Does not satisfy E164 format.";
  }

  if (!PHONE_CONTEXT_PATTERN.test(rawText)) {
    return "No SMS/calls/contacts context.";
  }

  if (!hasRepeatedPhoneContext(identifier, rawText)) {
    return "Phone is not repeated with real communication context.";
  }

  return null;
}

function looksLikeIpDerivedPhone(identifier: string, rawText: string): boolean {
  const digits = identifier.replace(/\D/g, "");

  if (/^192168\d{1,6}$/.test(digits) || /^10\d{6,12}$/.test(digits)) {
    return true;
  }

  const dotted = digitsToPossibleIpv4(digits);

  return dotted.some((ip) => rawText.includes(ip));
}

function digitsToPossibleIpv4(digits: string): string[] {
  const results: string[] = [];

  for (let first = 1; first <= 3; first += 1) {
    for (let second = 1; second <= 3; second += 1) {
      for (let third = 1; third <= 3; third += 1) {
        const fourth = digits.length - first - second - third;

        if (fourth < 1 || fourth > 3) {
          continue;
        }

        const parts = [
          digits.slice(0, first),
          digits.slice(first, first + second),
          digits.slice(first + second, first + second + third),
          digits.slice(first + second + third),
        ];

        if (parts.every((part) => Number(part) >= 0 && Number(part) <= 255)) {
          results.push(parts.join("."));
        }
      }
    }
  }

  return results;
}

function classifyCommunication(
  callEvents: NonNullable<DeviceIdentityInput["callEvents"]>
): { classification: CommunicationClassification; reason: string } {
  const hasConfirmedCall = callEvents.some(
    (event) =>
      (event.durationSeconds ?? 0) > 0 ||
      (event.bytes ?? 0) > 0 ||
      (event.bitrateKbps ?? 0) > 0
  );

  if (hasConfirmedCall) {
    return {
      classification: "CONFIRMED_CALL",
      reason: "At least one event has duration, bytes or bitrate.",
    };
  }

  return {
    classification: "POSSIBLE_COMMUNICATION_SIGNAL",
    reason:
      "Events with 0 seconds, 0 kbps and 0 bytes are not sufficient for real calls.",
  };
}

function classifyVpnSignal(
  vpnEvents: number,
  totalEvents: number
): { used: boolean; reason: string } {
  const ratio = totalEvents > 0 ? vpnEvents / totalEvents : 0;

  if (ratio < 0.01) {
    return {
      used: false,
      reason: `VPN ratio ${(ratio * 100).toFixed(
        2
      )}% is too low to infer concealment or alternate location.`,
    };
  }

  return {
    used: true,
    reason: `VPN ratio ${(ratio * 100).toFixed(2)}% is material.`,
  };
}

function extractPlusIdentifiers(text: string): string[] {
  return text.match(/\+\d{8,17}/g) ?? [];
}

function extractDomains(text: string): string[] {
  return text.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi) ?? [];
}

function extractHostnames(text: string): string[] {
  const matches = text.match(/\bHOSTNAME\s*[:=]\s*([A-Z0-9_-]{2,64})\b/i);

  return matches?.[1] ? [matches[1].toUpperCase()] : [];
}

function chooseHostname(hostnames: string[]): string | null {
  return hostnames.find((hostname) => !/^\d+$/.test(hostname)) ?? null;
}

function countWindowsSignals(rawText: string, domains: string[]): number {
  const joined = `${rawText}\n${domains.join("\n")}`;

  return WINDOWS_SIGNAL_PATTERNS.filter((pattern) => pattern.test(joined)).length;
}

function describeWindowsSignals(rawText: string, domains: string[]): string {
  const joined = `${rawText}\n${domains.join("\n")}`;
  const signals = [
    ["Windows", /\bwindows\b/i],
    ["Brave", /\bbrave\b|go-updater\.brave\.com/i],
    ["Cursor", /\bcursor\b|api[23]\.cursor\.sh/i],
    ["GlassWire", /\bglasswire\b|protect\.glasswire\.com/i],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(joined))
    .map(([label]) => label);

  return signals.join(" + ");
}

function hasRepeatedPhoneContext(identifier: string, rawText: string): boolean {
  const occurrences = rawText.split(identifier).length - 1;

  return occurrences >= 2 && PHONE_CONTEXT_PATTERN.test(rawText);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
