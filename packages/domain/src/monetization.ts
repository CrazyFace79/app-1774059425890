import { DomainError } from './types';

export type PurchaseProvider = {
  readonly enabled: boolean;
  isAvailable(): boolean;
  purchase(sku: string): Promise<never>;
};

export class DisabledPurchaseProvider implements PurchaseProvider {
  readonly enabled = false;

  isAvailable(): boolean {
    return false;
  }

  purchase(_sku: string): Promise<never> {
    return Promise.reject(new DomainError('monetization_disabled', 'Las compras están desactivadas.'));
  }
}

export function authorizeJob(input: {
  monetizationEnabled: boolean;
  credits: number;
  cost: number;
}): { ok: true; nextCredits: number; charged: boolean } | { ok: false; reason: string } {
  if (!input.monetizationEnabled) {
    return { ok: true, nextCredits: input.credits, charged: false };
  }
  if (input.credits < input.cost) return { ok: false, reason: 'Sin créditos suficientes.' };
  return { ok: true, nextCredits: input.credits - input.cost, charged: true };
}
