import { DomainError, type JobStatus } from './types';

const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('invalid_transition', `No se puede pasar de ${from} a ${to}.`);
  }
}

export function jobProgressLabel(status: JobStatus, progress: number): string {
  if (status === 'QUEUED') return 'En cola';
  if (status === 'PROCESSING') return progress < 40 ? 'Preparando máscara' : progress < 80 ? 'Procesando' : 'Guardando resultado';
  if (status === 'COMPLETED') return 'Completado';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Error';
}

export type JobCostKind = 'edit' | 'video' | 'reel' | 'upscale' | 'segment';

export function creditCost(kind: JobCostKind): number {
  if (kind === 'video') return 5;
  if (kind === 'reel') return 3;
  if (kind === 'upscale') return 2;
  if (kind === 'segment') return 0;
  return 1;
}
