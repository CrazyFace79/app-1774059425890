import { clampParameters, getPreset, num, resolveNamedColor, TOOL_CATALOG } from './catalog';
import { type Effect, type EffectPass, applyPasses } from './effects';
import {
  adjustHairLength,
  adjustHairline,
  andMask,
  blurChannel,
  derivedMask,
  estimatePerson,
  fullMask,
  maskCoverage,
  protectMask,
  sampleSkinColor,
  scaleMask,
  splitVerticalStrip,
  unionMasks,
  zoneMask,
  type DerivedZone,
  type PersonEstimate,
} from './masks';
import { DomainError, type EditPlan, type EditScope, type MaskMode, type MaskZone, type RGB, type ToolId } from './types';
import { sanitizeUserText } from './validation';

type ZoneRef = MaskZone | DerivedZone;

export type ToolPolicy = {
  editScope: EditScope;
  allowed: ZoneRef[] | 'all';
  alwaysProtected: ZoneRef[];
  identityProtected: ZoneRef[];
  lockedStrength: number;
  identityWarning: string | null;
  relaxLabels: string[];
  upscale: boolean;
};

const SUBJECT: ZoneRef[] = ['hair', 'face', 'beard', 'mustache', 'eyes', 'nose', 'mouth', 'skin', 'clothing', 'hands', 'eyebrows'];

export function getToolPolicy(tool: ToolId, presetId: string): ToolPolicy {
  if (tool === 'hair') {
    return {
      editScope: 'local',
      allowed: ['hair'],
      alwaysProtected: ['beard', 'mustache', 'eyes', 'nose', 'mouth', 'eyebrows', 'clothing', 'background', 'hands'],
      identityProtected: [],
      lockedStrength: 1,
      identityWarning: null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'beard') {
    return {
      editScope: 'local',
      allowed: ['beard'],
      alwaysProtected: ['mustache', 'hair', 'eyes', 'nose', 'mouth', 'clothing', 'background', 'hands'],
      identityProtected: [],
      lockedStrength: 1,
      identityWarning: null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'mustache') {
    return {
      editScope: 'local',
      allowed: ['mustache'],
      alwaysProtected: ['beard', 'hair', 'eyes', 'nose', 'mouth', 'clothing', 'background', 'hands'],
      identityProtected: [],
      lockedStrength: 1,
      identityWarning: null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'face') {
    const labels: Record<string, string> = {
      jaw: 'la estructura de la mandíbula',
      cheeks: 'el volumen de las mejillas',
      eyebrows: 'la forma de las cejas',
      nose: 'la forma de la nariz',
      lips: 'el volumen de los labios',
      eyes: 'la forma de los ojos',
      skin: 'la textura de la piel',
      wrinkles: 'las arrugas',
      age: 'la edad aparente',
    };
    const allowed: ZoneRef[] =
      presetId === 'jaw' ? ['jaw'] : presetId === 'cheeks' ? ['cheeks'] : presetId === 'eyebrows' ? ['eyebrows'] : presetId === 'nose' ? ['nose'] : presetId === 'lips' ? ['mouth'] : presetId === 'eyes' ? ['eyes'] : ['skin'];
    const structural = ['jaw', 'cheeks', 'nose', 'lips', 'eyes', 'age'].includes(presetId);
    return {
      editScope: 'local',
      allowed,
      alwaysProtected: ['hair', 'beard', 'mustache', 'clothing', 'background', 'hands'],
      identityProtected: structural ? [] : [],
      lockedStrength: structural ? 0.4 : 0.7,
      identityWarning: structural
        ? `Para modificar ${labels[presetId] ?? 'el rostro'} de forma más visible hay que relajar Identity Lock en esta operación. Con el bloqueo activo el cambio se queda en un ajuste sutil y reversible.`
        : 'La edición de piel es moderada. Identity Lock evita un embellecimiento agresivo.',
      relaxLabels: [labels[presetId] ?? 'la zona del rostro'],
      upscale: false,
    };
  }
  if (tool === 'clothing') {
    return {
      editScope: 'local',
      allowed: ['clothing'],
      alwaysProtected: ['hair', 'face', 'beard', 'mustache', 'eyes', 'nose', 'mouth', 'background', 'hands', 'eyebrows'],
      identityProtected: [],
      lockedStrength: 1,
      identityWarning: null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'accessories') {
    const allowed: ZoneRef[] =
      presetId === 'glasses' || presetId === 'sunglasses'
        ? ['glasses']
        : presetId === 'earrings'
          ? ['earrings']
          : presetId === 'chain'
            ? ['chain']
            : presetId === 'remove'
              ? ['glasses']
              : ['hat'];
    return {
      editScope: 'local',
      allowed,
      alwaysProtected:
        presetId === 'sunglasses' || presetId === 'remove'
          ? ['mouth', 'beard', 'clothing', 'background']
          : ['mouth', 'beard', 'clothing', 'background', 'eyes'],
      identityProtected: [],
      lockedStrength: 1,
      identityWarning:
        presetId === 'sunglasses'
          ? 'Las gafas de sol cubren los ojos. El resto de la identidad se conserva.'
          : presetId === 'remove'
            ? 'Quitar un accesorio funciona mejor si pintas la máscara encima del objeto.'
            : null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'background') {
    return {
      editScope: 'local',
      allowed: ['background'],
      alwaysProtected: SUBJECT,
      identityProtected: [],
      lockedStrength: 1,
      identityWarning: null,
      relaxLabels: [],
      upscale: false,
    };
  }
  if (tool === 'retouch') {
    if (presetId === 'facial') {
      return {
        editScope: 'local',
        allowed: ['skin'],
        alwaysProtected: ['eyes', 'mouth', 'hair', 'beard', 'mustache', 'clothing', 'background', 'hands'],
        identityProtected: [],
        lockedStrength: 1,
        identityWarning: 'La mejora facial solo suaviza la piel y tiene un tope bajo. No se aplica un filtro de belleza automático.',
        relaxLabels: ['textura de la piel'],
        upscale: false,
      };
    }
    return {
      editScope: presetId === 'upscale' ? 'full' : 'full',
      allowed: 'all',
      alwaysProtected: presetId === 'denoise' || presetId === 'restore' ? ['eyes'] : [],
      identityProtected: [],
      lockedStrength: 0.65,
      identityWarning: presetId === 'upscale' ? null : null,
      relaxLabels: [],
      upscale: presetId === 'upscale',
    };
  }
  if (tool === 'transform') {
    return {
      editScope: 'full',
      allowed: presetId === 'superhero' ? ['clothing', 'background'] : 'all',
      alwaysProtected: [],
      identityProtected: ['face'],
      lockedStrength: 0.9,
      identityWarning:
        'Transformación de estilo. Con Identity Lock el rostro se conserva en píxeles. Relájalo solo si aceptas que el estilo también altere la cara.',
      relaxLabels: ['el estilo del rostro'],
      upscale: false,
    };
  }
  return {
    editScope: 'full',
    allowed: 'all',
    alwaysProtected: [],
    identityProtected: ['face'],
    lockedStrength: 1,
    identityWarning:
      'El motor local mueve la cámara. Un proveedor de vídeo generativo puede interpretar el gesto. Identity Lock añade la conservación de identidad al prompt.',
    relaxLabels: ['el movimiento del gesto'],
    upscale: false,
  };
}

function materialize(ref: ZoneRef, width: number, height: number, person: PersonEstimate): Uint8Array {
  if (ref === 'jaw' || ref === 'cheeks' || ref === 'glasses' || ref === 'earrings' || ref === 'chain' || ref === 'hat' || ref === 'person' || ref === 'full') {
    return derivedMask(ref, width, height, person);
  }
  return zoneMask(ref, width, height, person);
}

function unionRefs(refs: ZoneRef[], width: number, height: number, person: PersonEstimate): Uint8Array {
  if (refs.length === 0) return new Uint8Array(width * height);
  return unionMasks(refs.map((ref) => materialize(ref, width, height, person)));
}

export type PlanInput = {
  tool: ToolId;
  presetId: string;
  customPrompt?: string;
  parameters?: Record<string, number | string | boolean>;
  identityLock: boolean;
  maskMode?: MaskMode;
};

export function buildEditPlan(input: PlanInput): EditPlan {
  if (input.tool === 'reel') {
    throw new DomainError('invalid_tool', 'El reel se exporta desde la línea de tiempo, no como un edit de imagen.');
  }
  const preset = getPreset(input.tool, input.presetId);
  if (!preset) throw new DomainError('unknown_preset', 'Ese preset no existe para la herramienta.');
  const parameters = clampParameters(input.tool, input.presetId, input.parameters);
  const custom = sanitizeUserText(input.customPrompt ?? '');
  const policy = getToolPolicy(input.tool, input.presetId);
  const needsText = preset.id === 'custom' || (input.tool === 'background' && preset.id === 'generate');
  if (needsText && custom.length < 2) {
    throw new DomainError('prompt_required', 'Escribe una descripción para este estilo.');
  }
  const relaxedAttributes = input.identityLock ? [] : policy.relaxLabels;
  const preservationPrompt = preservationText(policy, input.identityLock);
  const toolName = TOOL_CATALOG.find((item) => item.id === input.tool)?.name ?? input.tool;
  const prompt = [
    preset.prompt,
    custom,
    parameterSentence(parameters),
    policy.editScope === 'local'
      ? 'This is a LOCAL EDIT. Change only the masked region.'
      : 'This is a FULL TRANSFORMATION. Keep the person recognizable unless identity lock is relaxed.',
    preservationPrompt,
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ');
  const summary = [
    `${toolName}: ${preset.name}.`,
    policy.editScope === 'local' ? 'Edición local limitada por máscara.' : 'Transformación de estilo sobre el encuadre.',
    input.identityLock ? 'Identity Lock activo.' : `Identity Lock relajado (${relaxedAttributes.join(', ') || 'zona seleccionada'}).`,
  ].join(' ');
  return {
    tool: input.tool,
    subTool: input.tool === 'face' ? input.presetId : null,
    presetId: input.presetId,
    editScope: policy.editScope,
    identityLock: input.identityLock,
    prompt,
    negativePrompt: `${preset.negativePrompt}, different person, face swap, extra fingers, deformed eyes, changed pose, plastic skin, watermark, unrequested wardrobe change`,
    preservationPrompt,
    summary,
    warnings: policy.identityWarning ? [policy.identityWarning] : [],
    parameters,
    relaxedAttributes,
    maskMode: input.maskMode ?? 'auto',
  };
}

function preservationText(policy: ToolPolicy, identityLock: boolean): string {
  const zones = [...policy.alwaysProtected, ...(identityLock ? policy.identityProtected : [])];
  const unique = [...new Set(zones)];
  const identity = identityLock
    ? 'Preserve facial identity, facial structure, eyes, nose, mouth, skin tone, expression, pose, perspective and coherent lighting, except for the attribute this tool is allowed to edit.'
    : `The user relaxed identity lock for ${policy.relaxLabels.join(', ') || 'the selected area'}. Keep pose, perspective, lighting continuity and every region that is not selected.`;
  return `${identity} Protected zones: ${unique.join(', ') || 'none'}.`;
}

function parameterSentence(parameters: Record<string, number | string | boolean>): string {
  const parts = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value !== false)
    .map(([key, value]) => `${key}=${String(value)}`);
  return parts.length ? `Parameters: ${parts.join(', ')}.` : '';
}

export type LocalRenderInput = PlanInput & {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  userMask?: Uint8Array | null;
  seed?: number;
  feather?: number;
};

export type RenderedEdit = {
  rgba: Uint8ClampedArray;
  mask: Uint8Array;
  plan: EditPlan;
  upscaleFactor: number | null;
  confidence: number;
  personSource: 'flood' | 'geometric';
};

export function renderLocalEdit(input: LocalRenderInput): RenderedEdit {
  if (input.tool === 'animate' || input.tool === 'reel') {
    throw new DomainError('invalid_tool', 'Esta herramienta no modifica la imagen fija.');
  }
  const plan = buildEditPlan(input);
  const policy = getToolPolicy(input.tool, input.presetId);
  const person = estimatePerson(input.rgba, input.width, input.height);
  const skin = sampleSkinColor(input.rgba, input.width, input.height, materialize('face', input.width, input.height, person));
  const mask = resolveMask(input, policy, person, plan.parameters);
  if (maskCoverage(mask) < 0.002) {
    throw new DomainError('empty_mask', 'La máscara no cubre la zona permitida. Usa la máscara automática o pinta sobre la zona de la herramienta.');
  }
  const passes = buildPasses(input, plan, mask, skin, person);
  const seed = input.seed ?? 1;
  const rgba = applyPasses(input.rgba, input.width, input.height, passes, seed);
  const warnings = [...plan.warnings];
  if (person.confidence < 0.5) {
    warnings.push('La segmentación automática es geométrica y aproximada. Revisa la máscara si el recorte no coincide.');
  }
  return {
    rgba,
    mask,
    plan: { ...plan, warnings },
    upscaleFactor: policy.upscale ? num(plan.parameters, 'scale', 2) : null,
    confidence: person.confidence,
    personSource: person.source,
  };
}

function resolveMask(
  input: LocalRenderInput,
  policy: ToolPolicy,
  person: PersonEstimate,
  parameters: Record<string, number | string | boolean>,
): Uint8Array {
  const { width, height } = input;
  const allowed = policy.allowed === 'all' ? fullMask(width, height) : unionRefs(policy.allowed, width, height, person);
  let mask = input.userMask ? andMask(input.userMask, allowed) : allowed;
  if (input.tool === 'hair') {
    mask = adjustHairline(adjustHairLength(mask, width, height, num(parameters, 'length', 0.5)), width, height, num(parameters, 'hairline', 0.5));
    if (input.presetId === 'mohawk') mask = splitVerticalStrip(mask, width, height, 0.18).center;
    if (input.presetId !== 'remove' && input.presetId !== 'buzz') {
      mask = scaleMask(mask, 0.35 + num(parameters, 'density', 0.7) * 0.65);
    }
  }
  if (input.tool === 'beard' && (input.presetId === 'goatee' || num(parameters, 'shape', 0.5) < 0.35)) {
    mask = splitVerticalStrip(mask, width, height, 0.28).center;
  }
  const feather = input.feather ?? 2;
  const hard = unionRefs(
    [...policy.alwaysProtected, ...(input.identityLock ? policy.identityProtected : [])],
    width,
    height,
    person,
  );
  const soft = feather > 0 ? blurChannel(mask, width, height, feather) : mask;
  return protectMask(soft, [hard]);
}

function buildPasses(
  input: LocalRenderInput,
  plan: EditPlan,
  mask: Uint8Array,
  skin: RGB,
  person: PersonEstimate,
): EffectPass[] {
  const params = plan.parameters;
  const strength = plan.identityLock ? getToolPolicy(input.tool, input.presetId).lockedStrength : 1;
  const { width, height } = input;
  if (input.tool === 'hair') return hairPasses(input.presetId, params, mask, skin, strength, width, height);
  if (input.tool === 'beard') return facialHairPasses('beard', input.presetId, params, mask, skin, strength);
  if (input.tool === 'mustache') return facialHairPasses('mustache', input.presetId, params, mask, skin, strength);
  if (input.tool === 'face') return [facePass(input.presetId, params, mask, width, height, plan.identityLock)];
  if (input.tool === 'clothing') return [clothingPass(input.presetId, params, mask, input.customPrompt ?? '')];
  if (input.tool === 'accessories') return [accessoryPass(input.presetId, mask, input.customPrompt ?? '')];
  if (input.tool === 'background') return [backgroundPass(input.presetId, params, mask, input.customPrompt ?? '', person)];
  if (input.tool === 'retouch') return [retouchPass(input.presetId, params, mask, strength)];
  return [transformPass(input.presetId, params, mask, strength)];
}

function hairPasses(
  presetId: string,
  params: Record<string, number | string | boolean>,
  mask: Uint8Array,
  skin: RGB,
  strength: number,
  width: number,
  height: number,
): EffectPass[] {
  if (presetId === 'remove' || presetId === 'buzz') {
    return [{ mask, effects: [{ type: 'fill', color: skin, strength: presetId === 'buzz' ? 0.82 : 0.94 }, { type: 'smooth', amount: 0.25 }] }];
  }
  const color = resolveNamedColor(params, [42, 30, 22]);
  const gray = num(params, 'gray', 0);
  const style: Effect[] = [];
  if (color && String(params.color ?? 'original') !== 'original') style.push({ type: 'tint', color, strength: 0.62 * strength });
  if (gray > 0) style.push({ type: 'desaturate', amount: gray });
  if (presetId === 'straight' || presetId === 'slick' || presetId === 'classic') {
    style.push({ type: 'sharpen', amount: 0.35 }, { type: 'lighting', brightness: presetId === 'slick' ? -0.04 : 0.02, contrast: 0.12 });
  } else if (presetId === 'wavy') style.push({ type: 'displace', amplitude: 2.4, frequency: 5, axis: 'x' });
  else if (presetId === 'curly' || presetId === 'messy') style.push({ type: 'displace', amplitude: presetId === 'curly' ? 3.4 : 2.6, frequency: presetId === 'curly' ? 11 : 8, axis: 'both' });
  else style.push({ type: 'strands', color: color ?? [42, 30, 22], density: 0.55 + num(params, 'volume', 0.4) * 0.4 });
  if (num(params, 'volume', 0.4) > 0.6) style.push({ type: 'lighting', brightness: 0.03, contrast: 0.1 });
  if (presetId === 'fade' || presetId === 'crop') {
    const split = splitVerticalStrip(mask, width, height, 0.42);
    return [
      { mask: split.sides, effects: [{ type: 'fill', color: skin, strength: 0.55 }] },
      { mask: split.center, effects: style },
    ];
  }
  return [{ mask, effects: style }];
}

function facialHairPasses(
  kind: 'beard' | 'mustache',
  presetId: string,
  params: Record<string, number | string | boolean>,
  mask: Uint8Array,
  skin: RGB,
  strength: number,
): EffectPass[] {
  if (presetId === 'none') return [{ mask, effects: [{ type: 'fill', color: skin, strength: 0.9 }] }];
  const color = resolveNamedColor(params, [48, 36, 28]) ?? [48, 36, 28];
  const density = num(params, 'density', 0.7);
  const effects: Effect[] = [
    { type: 'tint', color, strength: (kind === 'mustache' ? 0.55 : 0.62) * density * strength },
    { type: 'speckle', color, amount: 0.25 + density * 0.55 },
  ];
  if (num(params, 'gray', 0) > 0) effects.push({ type: 'desaturate', amount: num(params, 'gray', 0) });
  if (kind === 'mustache' && num(params, 'curl', 0) > 0.4) {
    effects.push({ type: 'displace', amplitude: 1.6 * num(params, 'curl', 0), frequency: 3, axis: 'y' });
  }
  if (kind === 'mustache') {
    const scaled = scaleMask(mask, 0.45 + num(params, 'thickness', 0.45) * 0.7);
    return [{ mask: scaled, effects }];
  }
  return [{ mask, effects }];
}

function facePass(
  presetId: string,
  params: Record<string, number | string | boolean>,
  mask: Uint8Array,
  width: number,
  height: number,
  identityLock: boolean,
): EffectPass {
  const amount = num(params, 'amount', 0);
  const cap = identityLock ? 0.4 : 1;
  const scaled = amount * cap;
  if (presetId === 'skin') return { mask, effects: [{ type: 'smooth', amount: Math.min(0.4, Math.max(0, amount)) }] };
  if (presetId === 'wrinkles') {
    return {
      mask,
      effects: [scaled >= 0 ? { type: 'sharpen', amount: Math.min(0.4, scaled) } : { type: 'smooth', amount: Math.min(0.4, -scaled) }],
    };
  }
  if (presetId === 'age') {
    return {
      mask,
      effects: [
        { type: 'grade', contrast: scaled * 0.12, saturation: scaled * -0.08, temperature: scaled * -0.05 },
        scaled > 0 ? { type: 'sharpen', amount: Math.min(0.3, scaled * 0.3) } : { type: 'smooth', amount: Math.min(0.3, -scaled * 0.3) },
      ],
    };
  }
  if (presetId === 'eyebrows') return { mask, effects: [{ type: 'shift', dx: 0, dy: -scaled * height * 0.012 }] };
  const kx = presetId === 'eyes' || presetId === 'nose' || presetId === 'jaw' || presetId === 'cheeks' ? scaled * 0.08 : 0;
  const ky = presetId === 'lips' || presetId === 'eyes' ? scaled * 0.08 : presetId === 'jaw' ? scaled * 0.03 : 0;
  return { mask, effects: [{ type: 'radial', cx: width * 0.5, cy: height * (presetId === 'jaw' ? 0.6 : presetId === 'lips' ? 0.53 : 0.4), kx, ky }] };
}

function clothingPass(presetId: string, params: Record<string, number | string | boolean>, mask: Uint8Array, custom: string): EffectPass {
  const prompted = colorFromWords(`${presetId} ${custom}`);
  const color = resolveNamedColor(params, prompted) ?? prompted ?? [40, 70, 120];
  const strength = num(params, 'strength', 0.75);
  const effects: Effect[] = [{ type: 'tint', color, strength }];
  if (presetId === 'sports') effects.push({ type: 'stripes', color: [240, 240, 240], strength: 0.25 });
  if (presetId === 'suit') effects.push({ type: 'lighting', brightness: -0.04, contrast: 0.16 });
  return { mask, effects };
}

function accessoryPass(presetId: string, mask: Uint8Array, custom: string): EffectPass {
  if (presetId === 'remove') return { mask, effects: [{ type: 'inpaint' }] };
  const color = colorFromWords(custom) ?? [32, 32, 36];
  const shape = presetId === 'sunglasses' ? 'sunglasses' : presetId === 'earrings' ? 'earrings' : presetId === 'chain' ? 'chain' : presetId === 'cap' ? 'cap' : presetId === 'hat' ? 'hat' : 'glasses';
  return { mask, effects: [{ type: 'overlay', shape, color }] };
}

function backgroundPass(
  presetId: string,
  params: Record<string, number | string | boolean>,
  mask: Uint8Array,
  custom: string,
  _person: PersonEstimate,
): EffectPass {
  if (presetId === 'remove') return { mask, effects: [], knockout: true };
  if (presetId === 'blur') return { mask, effects: [{ type: 'box-blur', radius: 2 + num(params, 'blur', 0.6) * 10 }] };
  const color = resolveNamedColor(params, colorFromWords(custom)) ?? colorFromWords(custom) ?? [36, 48, 72];
  const to: RGB = [Math.min(255, color[0] + 40), Math.min(255, color[1] + 24), Math.min(255, color[2] + 10)];
  return { mask, effects: [{ type: 'gradient', from: color, to, noise: presetId === 'generate' ? 0.08 : 0.02 }] };
}

function retouchPass(presetId: string, params: Record<string, number | string | boolean>, mask: Uint8Array, strength: number): EffectPass {
  const amount = num(params, 'amount', 0.3) * strength;
  if (presetId === 'sharpen') return { mask, effects: [{ type: 'sharpen', amount }] };
  if (presetId === 'denoise') return { mask, effects: [{ type: 'smooth', amount: Math.min(0.7, amount) }] };
  if (presetId === 'lighting') return { mask, effects: [{ type: 'lighting', brightness: amount, contrast: Math.abs(amount) }] };
  if (presetId === 'balance') return { mask, effects: [{ type: 'white-balance', strength: amount }] };
  if (presetId === 'facial') return { mask, effects: [{ type: 'smooth', amount: Math.min(0.4, num(params, 'amount', 0.15)) }] };
  if (presetId === 'upscale') return { mask, effects: [{ type: 'sharpen', amount: 0.25 }] };
  return { mask, effects: [{ type: 'sharpen', amount: amount * 0.6 }, { type: 'smooth', amount: amount * 0.25 }] };
}

function transformPass(presetId: string, params: Record<string, number | string | boolean>, mask: Uint8Array, strength: number): EffectPass {
  const gain = num(params, 'strength', 0.75) * strength;
  const grades: Record<string, Effect[]> = {
    photorealistic: [{ type: 'grade', contrast: 0.08 * gain, saturation: 0.04 * gain, temperature: 0.02 }],
    cinematic: [{ type: 'grade', contrast: 0.2 * gain, saturation: -0.08 * gain, temperature: -0.45 }, { type: 'vignette', strength: 0.35 * gain }],
    anime: [{ type: 'posterize', levels: 6 }, { type: 'grade', contrast: 0.15, saturation: 0.2 * gain, temperature: 0.1 }],
    'anime-to-real': [{ type: 'sharpen', amount: 0.45 * gain }, { type: 'grade', contrast: 0.06, saturation: -0.04, temperature: 0.04 }],
    fantasy: [{ type: 'grade', contrast: 0.12 * gain, saturation: 0.25 * gain, temperature: 0.2 }],
    cyberpunk: [{ type: 'grade', contrast: 0.22 * gain, saturation: 0.18 * gain, temperature: -0.55 }],
    historical: [{ type: 'desaturate', amount: 0.35 * gain }, { type: 'grade', contrast: 0.08, saturation: -0.1, temperature: 0.25 }],
    superhero: [{ type: 'tint', color: [150, 28, 36], strength: 0.45 * gain }, { type: 'lighting', brightness: 0.02, contrast: 0.2 }],
    vintage: [{ type: 'grade', contrast: 0.05, saturation: -0.15 * gain, temperature: 0.3 }, { type: 'vignette', strength: 0.4 }],
  };
  return { mask, effects: grades[presetId] ?? [{ type: 'grade', contrast: 0.1 * gain, saturation: 0.08 * gain, temperature: 0 }] };
}

export function colorFromWords(text: string): RGB | null {
  const value = text.toLowerCase();
  const table: [string, RGB][] = [
    ['rojo', [170, 36, 36]],
    ['red', [170, 36, 36]],
    ['azul', [36, 78, 170]],
    ['blue', [36, 78, 170]],
    ['verde', [32, 130, 78]],
    ['green', [32, 130, 78]],
    ['negro', [18, 18, 18]],
    ['black', [18, 18, 18]],
    ['blanco', [236, 236, 236]],
    ['white', [236, 236, 236]],
    ['playa', [214, 176, 120]],
    ['beach', [214, 176, 120]],
    ['bosque', [34, 90, 48]],
    ['forest', [34, 90, 48]],
    ['noche', [16, 22, 48]],
    ['night', [16, 22, 48]],
    ['estudio', [210, 210, 212]],
    ['studio', [210, 210, 212]],
    ['ciudad', [70, 78, 92]],
    ['city', [70, 78, 92]],
  ];
  for (const [word, color] of table) if (value.includes(word)) return color;
  return null;
}

export function preflightEdit(input: PlanInput & { width: number; height: number; bytes: number; type: 'jpeg' | 'png' | 'webp' | null }): {
  ok: boolean;
  errors: string[];
  plan: EditPlan | null;
} {
  const errors: string[] = [];
  if (input.width < 64 || input.height < 64) errors.push('La imagen es demasiado pequeña.');
  if (input.bytes <= 0 || input.bytes > 15 * 1024 * 1024) errors.push('El archivo de imagen no es válido.');
  if (!input.type) errors.push('Formato no soportado.');
  try {
    const plan = buildEditPlan(input);
    return { ok: errors.length === 0, errors, plan };
  } catch (error) {
    if (error instanceof DomainError) errors.push(error.message);
    else errors.push('No se pudo preparar la edición.');
    return { ok: false, errors, plan: null };
  }
}
