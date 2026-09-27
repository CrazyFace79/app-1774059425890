export const TOOL_IDS = [
  'hair',
  'beard',
  'mustache',
  'face',
  'clothing',
  'accessories',
  'background',
  'retouch',
  'transform',
  'animate',
  'reel',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const MASK_ZONES = [
  'hair',
  'beard',
  'mustache',
  'eyebrows',
  'eyes',
  'nose',
  'mouth',
  'skin',
  'face',
  'clothing',
  'background',
  'hands',
] as const;

export type MaskZone = (typeof MASK_ZONES)[number];

export const JOB_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type EditScope = 'local' | 'full';
export type Disclosure = 'procedural-local' | 'ai-modified' | 'ai-generated';
export type MaskMode = 'auto' | 'manual';
export type AspectRatio = '9:16' | '1:1' | '16:9';

export type RGB = [number, number, number];

export type Stroke = {
  mode: 'brush' | 'erase';
  /** Radio normalizado respecto al lado menor de la imagen. */
  size: number;
  points: { x: number; y: number }[];
};

export type SliderControl = {
  kind: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type SelectControl = {
  kind: 'select';
  key: string;
  label: string;
  options: { id: string; label: string; swatch?: string }[];
  defaultValue: string;
};

export type Control = SliderControl | SelectControl;

export type Preset = {
  id: string;
  tool: ToolId;
  name: string;
  swatch: string;
  prompt: string;
  negativePrompt: string;
  parameters: Record<string, number | string | boolean>;
};

export type ToolCatalogItem = {
  id: ToolId;
  name: string;
  description: string;
  emoji: string;
};

export type VersionNode = {
  id: string;
  parentId: string | null;
  assetId: string;
  operationId: string | null;
  label: string;
  tool: string | null;
  createdAt: string;
};

export type HistoryState = {
  nodes: VersionNode[];
  headId: string;
  redoIds: string[];
};

export type EditPlan = {
  tool: ToolId;
  subTool: string | null;
  presetId: string;
  editScope: EditScope;
  identityLock: boolean;
  prompt: string;
  negativePrompt: string;
  preservationPrompt: string;
  summary: string;
  warnings: string[];
  parameters: Record<string, number | string | boolean>;
  relaxedAttributes: string[];
  maskMode: MaskMode;
};

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}
