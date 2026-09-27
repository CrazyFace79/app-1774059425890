export const TRAINING_OPT_OUT_HEADER = 'x-training-opt-out';

export function retentionExpired(createdAtIso: string, retentionDays: number | null, nowMs: number): boolean {
  if (retentionDays == null) return false;
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return false;
  const days = Math.max(1, retentionDays);
  return nowMs - created >= days * 24 * 60 * 60 * 1000;
}

export function trainingOptOutRequired(headerValue: string | undefined): boolean {
  return headerValue !== 'false';
}

export const PRIVACY_SUMMARY = [
  'Las fotos de personas son datos sensibles.',
  'Solo se envían al servidor que configures, para ejecutar el trabajo que pides.',
  'No se usan para entrenar modelos.',
  'Puedes borrar un proyecto, sus archivos o el original sin borrar el historial derivado.',
  'La retención automática es opcional. Si no eliges un plazo, los archivos locales se quedan hasta que los borres.',
  'Cada resultado guarda metadatos internos de que fue modificado o generado.',
].join(' ');
