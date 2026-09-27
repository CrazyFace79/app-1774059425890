import type { Control, Preset, RGB, ToolCatalogItem, ToolId } from './types';
import { parseHexColor } from './validation';

export const TOOL_CATALOG: ToolCatalogItem[] = [
  { id: 'hair', name: 'Pelo', emoji: '💇', description: 'Longitud, color y estilo solo en el pelo.' },
  { id: 'beard', name: 'Barba', emoji: '🧔', description: 'Barba independiente del bigote.' },
  { id: 'mustache', name: 'Bigote', emoji: '👨', description: 'Solo el bigote, sin tocar la barba.' },
  { id: 'face', name: 'Rostro', emoji: '👤', description: 'Ajustes moderados y reversibles por zona.' },
  { id: 'clothing', name: 'Look / ropa', emoji: '👕', description: 'Cambia la ropa y conserva cara, pelo y fondo.' },
  { id: 'accessories', name: 'Accesorios', emoji: '🕶️', description: 'Gafas, pendientes, cadenas y sombreros.' },
  { id: 'background', name: 'Fondo', emoji: '🖼️', description: 'Quitar, sustituir, desenfocar o generar el fondo.' },
  { id: 'retouch', name: 'Retoque', emoji: '✨', description: 'Nitidez, luz y mejora facial moderada.' },
  { id: 'transform', name: 'Transformar', emoji: '🎭', description: 'Estilo global o local, con nivel de identidad.' },
  { id: 'animate', name: 'Animar', emoji: '🎬', description: 'De la imagen a un clip de vídeo.' },
  { id: 'reel', name: 'Reel', emoji: '📱', description: 'Timeline vertical 9:16 con texto y audio.' },
];

const HAIR_COLORS = [
  { id: 'original', label: 'Original' },
  { id: 'black', label: 'Negro', swatch: '#141414' },
  { id: 'brown', label: 'Castaño', swatch: '#5C3A22' },
  { id: 'blonde', label: 'Rubio', swatch: '#D6B05C' },
  { id: 'red', label: 'Pelirrojo', swatch: '#A63420' },
  { id: 'gray', label: 'Gris', swatch: '#A0A0A0' },
  { id: 'white', label: 'Blanco', swatch: '#E6E6E6' },
  { id: 'custom', label: 'Personalizado' },
];

export const NAMED_COLORS: Record<string, RGB> = {
  black: [20, 20, 20],
  brown: [92, 58, 34],
  blonde: [214, 176, 92],
  red: [166, 52, 32],
  gray: [168, 168, 168],
  white: [230, 230, 230],
  navy: [22, 34, 72],
  whiteShirt: [236, 236, 232],
  denim: [46, 74, 120],
  sport: [30, 140, 90],
  casual: [92, 108, 84],
  gold: [212, 175, 90],
  ink: [16, 16, 20],
};

export function resolveNamedColor(parameters: Record<string, number | string | boolean>, fallback: RGB | null): RGB | null {
  const choice = typeof parameters.color === 'string' ? parameters.color : 'original';
  if (choice === 'original') return fallback;
  if (choice === 'custom') {
    const hex = typeof parameters.customColor === 'string' ? parseHexColor(parameters.customColor) : null;
    return hex ?? fallback;
  }
  return NAMED_COLORS[choice] ?? fallback;
}

function slider(
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
): Control {
  return { kind: 'slider', key, label, min, max, step, defaultValue };
}

const colorSelect = (key = 'color'): Control => ({
  kind: 'select',
  key,
  label: 'Color',
  options: HAIR_COLORS,
  defaultValue: 'original',
});

const hairControls: Control[] = [
  slider('length', 'Longitud', 0, 1, 0.01, 0.5),
  slider('density', 'Densidad', 0, 1, 0.01, 0.7),
  slider('volume', 'Volumen', 0, 1, 0.01, 0.45),
  slider('hairline', 'Nacimiento', 0, 1, 0.01, 0.5),
  slider('gray', 'Canas', 0, 1, 0.01, 0),
  colorSelect(),
];

const beardControls: Control[] = [
  slider('length', 'Longitud', 0, 1, 0.01, 0.45),
  slider('density', 'Densidad', 0, 1, 0.01, 0.7),
  slider('gray', 'Canas', 0, 1, 0.01, 0),
  slider('shape', 'Forma', 0, 1, 0.01, 0.5),
  colorSelect(),
];

const mustacheControls: Control[] = [
  slider('thickness', 'Grosor', 0, 1, 0.01, 0.45),
  slider('length', 'Longitud', 0, 1, 0.01, 0.4),
  slider('density', 'Densidad', 0, 1, 0.01, 0.75),
  slider('curl', 'Rizo', 0, 1, 0.01, 0.2),
  colorSelect(),
];

const faceControls: Record<string, Control[]> = {
  jaw: [slider('amount', 'Mandíbula', -1, 1, 0.01, 0)],
  cheeks: [slider('amount', 'Mejillas', -1, 1, 0.01, 0)],
  eyebrows: [slider('amount', 'Cejas', -1, 1, 0.01, 0)],
  nose: [slider('amount', 'Nariz', -1, 1, 0.01, 0)],
  lips: [slider('amount', 'Labios', -1, 1, 0.01, 0)],
  eyes: [slider('amount', 'Ojos', -1, 1, 0.01, 0)],
  skin: [slider('amount', 'Suavizado', 0, 0.4, 0.01, 0.12)],
  wrinkles: [slider('amount', 'Arrugas', -0.4, 0.4, 0.01, 0)],
  age: [slider('amount', 'Edad aparente', -1, 1, 0.01, 0)],
};

const clothingControls: Control[] = [
  {
    kind: 'select',
    key: 'color',
    label: 'Color',
    options: [
      { id: 'white', label: 'Blanco', swatch: '#ECECE8' },
      { id: 'black', label: 'Negro', swatch: '#141414' },
      { id: 'navy', label: 'Marino', swatch: '#162248' },
      { id: 'sport', label: 'Deportivo', swatch: '#1E8C5A' },
      { id: 'casual', label: 'Casual', swatch: '#5C6C54' },
      { id: 'red', label: 'Rojo', swatch: '#A62424' },
      { id: 'custom', label: 'Personalizado' },
    ],
    defaultValue: 'navy',
  },
  slider('strength', 'Intensidad', 0, 1, 0.01, 0.72),
];
const backgroundControls: Control[] = [
  slider('blur', 'Desenfoque', 0, 1, 0.01, 0.6),
  colorSelect(),
];
const retouchControls: Record<string, Control[]> = {
  restore: [slider('amount', 'Restauración', 0, 0.6, 0.01, 0.35)],
  sharpen: [slider('amount', 'Nitidez', 0, 0.8, 0.01, 0.4)],
  denoise: [slider('amount', 'Reducción de ruido', 0, 0.7, 0.01, 0.35)],
  lighting: [slider('amount', 'Luz', -0.35, 0.35, 0.01, 0.08)],
  balance: [slider('amount', 'Balance', 0, 0.8, 0.01, 0.4)],
  upscale: [slider('scale', 'Escala', 1.25, 2, 0.25, 2)],
  facial: [slider('amount', 'Mejora facial', 0, 0.4, 0.01, 0.15)],
};

const transformControls: Control[] = [slider('strength', 'Intensidad', 0.2, 1, 0.01, 0.75)];
const animateControls: Control[] = [
  {
    kind: 'select',
    key: 'aspect',
    label: 'Formato',
    options: [
      { id: '9:16', label: '9:16' },
      { id: '1:1', label: '1:1' },
      { id: '16:9', label: '16:9' },
    ],
    defaultValue: '9:16',
  },
  {
    kind: 'select',
    key: 'duration',
    label: 'Duración',
    options: [
      { id: '2', label: '2 s' },
      { id: '3', label: '3 s' },
      { id: '4', label: '4 s' },
    ],
    defaultValue: '3',
  },
];

function p(
  tool: ToolId,
  id: string,
  name: string,
  swatch: string,
  prompt: string,
  negativePrompt: string,
  parameters: Record<string, number | string | boolean> = {},
): Preset {
  return { tool, id, name, swatch, prompt, negativePrompt, parameters };
}

export const PRESETS: Preset[] = [
  p('hair', 'add', 'Añadir pelo', '#3B2A1A', 'add natural hair volume and coverage', 'bald spots, changed face', { length: 0.72, density: 0.8, volume: 0.7 }),
  p('hair', 'remove', 'Quitar pelo', '#CDB6A0', 'remove hair inside the hair mask and reconstruct scalp', 'changed beard, changed face', { length: 0.1, density: 0.2 }),
  p('hair', 'buzz', 'Rapado', '#6B5848', 'very short buzz cut, close to the scalp', 'long hair, changed beard', { length: 0.08, density: 0.35 }),
  p('hair', 'short', 'Corto', '#2B241C', 'short haircut', 'changed face', { length: 0.28 }),
  p('hair', 'medium', 'Medio', '#3A2C22', 'medium-length hair', 'changed face', { length: 0.5 }),
  p('hair', 'long', 'Largo', '#4A3424', 'long hair', 'changed face', { length: 0.78 }),
  p('hair', 'very-long', 'Muy largo', '#5A4030', 'very long hair', 'changed face', { length: 0.95 }),
  p('hair', 'straight', 'Liso', '#2A211C', 'straight smooth hair', 'changed face', { length: 0.62 }),
  p('hair', 'wavy', 'Ondulado', '#3E2E24', 'soft wavy hair', 'changed face', { length: 0.66 }),
  p('hair', 'curly', 'Rizado', '#4A3020', 'curly hair', 'changed face', { length: 0.6, volume: 0.8 }),
  p('hair', 'fade', 'Degradado', '#2C241C', 'fade haircut, shorter sides', 'changed beard', { length: 0.34 }),
  p('hair', 'slick', 'Slick back', '#1C1816', 'slicked back hair', 'changed face', { length: 0.48 }),
  p('hair', 'crop', 'Crop', '#322820', 'textured crop haircut', 'changed face', { length: 0.3 }),
  p('hair', 'mohawk', 'Mohawk', '#201814', 'mohawk with cleared sides', 'changed beard, changed face', { length: 0.55 }),
  p('hair', 'messy', 'Messy', '#3A2A20', 'messy textured hair', 'changed face', { length: 0.52, volume: 0.75 }),
  p('hair', 'classic', 'Clásico', '#2E241C', 'classic neat haircut', 'changed face', { length: 0.42 }),
  p('hair', 'custom', 'Texto libre', '#D6FF4A', 'custom hairstyle described by the user', 'changed face, changed beard'),

  p('beard', 'none', 'Sin barba', '#D7BBA6', 'remove beard and restore skin', 'changed mustache, changed hair', { length: 0, density: 0 }),
  p('beard', 'stubble', 'Sombra', '#5C4638', 'light stubble beard', 'changed mustache', { length: 0.12, density: 0.35 }),
  p('beard', 'three-day', '3 días', '#4E3B2E', 'three-day beard', 'changed mustache', { length: 0.22, density: 0.5 }),
  p('beard', 'short', 'Corta', '#3E2E24', 'short beard', 'changed mustache', { length: 0.35, density: 0.7 }),
  p('beard', 'medium', 'Media', '#34261E', 'medium beard', 'changed mustache', { length: 0.55, density: 0.8 }),
  p('beard', 'long', 'Larga', '#2A1E18', 'long beard', 'changed mustache', { length: 0.82, density: 0.85 }),
  p('beard', 'full', 'Completa', '#241812', 'full beard excluding the mustache', 'changed mustache, changed hair', { length: 0.7, density: 0.9 }),
  p('beard', 'goatee', 'Perilla', '#3A2A22', 'goatee along the chin', 'full cheek beard, changed mustache', { length: 0.4, shape: 0.2, density: 0.75 }),
  p('beard', 'jawline', 'Mandíbula', '#3A3028', 'beard following the jawline', 'changed mustache', { length: 0.38, shape: 0.85, density: 0.7 }),
  p('beard', 'custom', 'Texto libre', '#D6FF4A', 'custom beard described by the user', 'changed mustache, changed hair'),

  p('mustache', 'none', 'Sin bigote', '#E0C6B2', 'remove mustache and restore skin', 'changed beard', { thickness: 0, density: 0 }),
  p('mustache', 'thin', 'Fino', '#3A2C24', 'thin mustache', 'changed beard', { thickness: 0.2, length: 0.35 }),
  p('mustache', 'classic', 'Clásico', '#2E241C', 'classic mustache', 'changed beard', { thickness: 0.45, length: 0.45 }),
  p('mustache', 'chevron', 'Chevron', '#32261E', 'chevron mustache', 'changed beard', { thickness: 0.7, length: 0.5 }),
  p('mustache', 'handlebar', 'Handlebar', '#2A2018', 'handlebar mustache with curl', 'changed beard', { thickness: 0.5, curl: 0.85, length: 0.7 }),
  p('mustache', 'horseshoe', 'Horseshoe', '#241C16', 'horseshoe mustache', 'changed beard', { thickness: 0.55, length: 0.8 }),
  p('mustache', 'pencil', 'Lápiz', '#1E1814', 'pencil mustache', 'changed beard', { thickness: 0.12, length: 0.55 }),
  p('mustache', 'custom', 'Texto libre', '#D6FF4A', 'custom mustache described by the user', 'changed beard'),

  p('face', 'jaw', 'Mandíbula', '#E7C7B0', 'subtle jawline adjustment', 'identity change, face swap'),
  p('face', 'cheeks', 'Mejillas', '#EBCFB8', 'subtle cheek adjustment', 'identity change'),
  p('face', 'eyebrows', 'Cejas', '#4A3428', 'eyebrow shape adjustment', 'changed eyes'),
  p('face', 'nose', 'Nariz', '#E4C2AE', 'subtle nose width adjustment', 'identity change'),
  p('face', 'lips', 'Labios', '#C47A74', 'subtle lip volume adjustment', 'changed teeth'),
  p('face', 'eyes', 'Ojos', '#8FA4A8', 'subtle eye adjustment', 'deformed eyes'),
  p('face', 'skin', 'Piel', '#F0D2C0', 'moderate natural skin cleanup', 'plastic skin, beauty filter'),
  p('face', 'wrinkles', 'Arrugas', '#D9B8A4', 'moderate wrinkle adjustment', 'waxy skin'),
  p('face', 'age', 'Edad aparente', '#CDB39A', 'subtle apparent-age adjustment', 'different person'),

  p('clothing', 'tshirt', 'Camiseta', '#D7D7D2', 'plain t-shirt', 'changed face, changed hands', { color: 'white', strength: 0.78 }),
  p('clothing', 'shirt', 'Camisa', '#E7E4DA', 'collared shirt', 'changed face', { color: 'white', strength: 0.7 }),
  p('clothing', 'jacket', 'Chaqueta', '#2C3340', 'jacket', 'changed face', { color: 'navy', strength: 0.8 }),
  p('clothing', 'suit', 'Traje', '#1B2433', 'tailored suit', 'changed face, changed background', { color: 'navy', strength: 0.86 }),
  p('clothing', 'sports', 'Deportiva', '#1E8C5A', 'sportswear', 'changed face', { color: 'sport', strength: 0.8 }),
  p('clothing', 'casual', 'Casual', '#5C6C54', 'casual outfit', 'changed face', { color: 'casual', strength: 0.74 }),
  p('clothing', 'custom', 'Texto libre', '#D6FF4A', 'custom clothing described by the user', 'changed face, changed hair, changed background'),

  p('accessories', 'glasses', 'Gafas', '#20242C', 'add eyeglasses', 'changed eyes identity, changed beard'),
  p('accessories', 'sunglasses', 'Gafas de sol', '#111318', 'add sunglasses', 'changed hair'),
  p('accessories', 'earrings', 'Pendientes', '#D4AF5A', 'add earrings', 'changed face structure'),
  p('accessories', 'chain', 'Cadena', '#C6A15B', 'add a chain necklace', 'changed clothing silhouette grossly'),
  p('accessories', 'cap', 'Gorra', '#243044', 'add a cap', 'changed face'),
  p('accessories', 'hat', 'Sombrero', '#3A2A22', 'add a hat', 'changed face'),
  p('accessories', 'remove', 'Quitar accesorio', '#C9B8A4', 'remove the accessory inside the mask', 'damage skin'),
  p('accessories', 'custom', 'Texto libre', '#D6FF4A', 'custom accessory described by the user', 'changed identity'),

  p('background', 'remove', 'Quitar fondo', '#9BE7FF', 'remove the background and keep the full subject', 'cut off hair, cut off hands'),
  p('background', 'replace', 'Sustituir', '#7F8CFF', 'replace the background', 'changed subject'),
  p('background', 'blur', 'Desenfocar', '#B9C0D0', 'blur the background only', 'blur the subject'),
  p('background', 'generate', 'Generar', '#D6FF4A', 'generate a new background from the prompt', 'changed subject'),

  p('retouch', 'restore', 'Restaurar', '#F2E2C9', 'restore photo detail moderately', 'artificial skin'),
  p('retouch', 'sharpen', 'Nitidez', '#F7F1E4', 'increase sharpness', 'halos'),
  p('retouch', 'denoise', 'Ruido', '#E7E0D4', 'reduce noise', 'plastic texture'),
  p('retouch', 'lighting', 'Iluminación', '#FFE3A3', 'adjust lighting', 'changed identity'),
  p('retouch', 'balance', 'Balance', '#F4F4F4', 'white balance', 'color cast extreme'),
  p('retouch', 'upscale', 'Upscale', '#D5E8FF', 'upscale while preserving identity', 'hallucinated detail'),
  p('retouch', 'facial', 'Mejora facial', '#F6D7C6', 'moderate facial cleanup on skin only', 'beauty filter, face reshape'),

  p('transform', 'photorealistic', 'Fotorrealista', '#F4F1EA', 'photorealistic finish', 'cartoon, extra limbs'),
  p('transform', 'cinematic', 'Cinemático', '#1E3A4C', 'cinematic color grade', 'changed identity when lock is on'),
  p('transform', 'anime', 'Anime', '#FF8BD2', 'anime illustration style', 'photoreal face when anime is requested'),
  p('transform', 'anime-to-real', 'Anime a real', '#E7D3C4', 'turn an illustrated face toward photoreal', 'different person'),
  p('transform', 'fantasy', 'Fantasía', '#7C5CFF', 'fantasy styling', 'changed pose'),
  p('transform', 'cyberpunk', 'Cyberpunk', '#00E5FF', 'cyberpunk grade and atmosphere', 'changed pose'),
  p('transform', 'historical', 'Histórico', '#C4A574', 'historical photographic look', 'modern plastic skin'),
  p('transform', 'superhero', 'Superhéroe', '#FF4D4D', 'superhero inspired costume styling on clothing', 'changed face identity'),
  p('transform', 'vintage', 'Vintage', '#C9A27A', 'vintage film look', 'heavy scratches destroying the face'),
  p('transform', 'custom', 'Texto libre', '#D6FF4A', 'custom transformation described by the user', 'unrequested identity change'),

  p('animate', 'natural', 'Movimiento natural', '#D6FF4A', 'subtle natural camera motion, subject almost still', 'morphing face, new person'),
  p('animate', 'smile', 'Sonrisa', '#F2C1B2', 'gentle motion suggesting a smile while keeping identity', 'different person, exaggerated mouth'),
  p('animate', 'look', 'Mirar a cámara', '#C9D6FF', 'subject attention toward the camera, subtle move', 'head replacement'),
  p('animate', 'turn', 'Giro ligero', '#D5C7B0', 'slight head turn', 'profile swap, broken geometry'),
  p('animate', 'walk', 'Caminar', '#B7C7A3', 'subtle walking bob and forward motion', 'changed outfit, changed identity'),
  p('animate', 'dolly-in', 'Acercarse', '#E8E2D4', 'camera dolly in', 'zoom crop of a different person'),
  p('animate', 'dolly-out', 'Alejarse', '#D9D3C6', 'camera dolly out', 'changed background identity'),
  p('animate', 'orbit', 'Órbita', '#C5D0E6', 'light orbit camera move', 'face distortion'),
  p('animate', 'cinematic', 'Cinemático', '#89A7C2', 'slow cinematic push with grade', 'morph'),
  p('animate', 'custom', 'Texto libre', '#D6FF4A', 'custom motion described by the user', 'identity drift'),
];

export function presetsFor(tool: ToolId): Preset[] {
  return PRESETS.filter((preset) => preset.tool === tool);
}

export function getPreset(tool: ToolId, presetId: string): Preset | null {
  return PRESETS.find((preset) => preset.tool === tool && preset.id === presetId) ?? null;
}

export function getControls(tool: ToolId, presetId: string): Control[] {
  if (tool === 'hair') return hairControls;
  if (tool === 'beard') return beardControls;
  if (tool === 'mustache') return mustacheControls;
  if (tool === 'face') return faceControls[presetId] ?? faceControls.jaw ?? [];
  if (tool === 'clothing') return clothingControls;
  if (tool === 'background') return backgroundControls;
  if (tool === 'retouch') return retouchControls[presetId] ?? retouchControls.sharpen ?? [];
  if (tool === 'transform') return transformControls;
  if (tool === 'animate') return animateControls;
  return [];
}

export function defaultParameters(tool: ToolId, presetId: string): Record<string, number | string | boolean> {
  const preset = getPreset(tool, presetId);
  const merged: Record<string, number | string | boolean> = { ...(preset?.parameters ?? {}) };
  for (const control of getControls(tool, presetId)) {
    if (merged[control.key] === undefined) merged[control.key] = control.defaultValue;
  }
  return merged;
}

export function clampParameters(
  tool: ToolId,
  presetId: string,
  raw: Record<string, number | string | boolean> | undefined,
): Record<string, number | string | boolean> {
  const merged = { ...defaultParameters(tool, presetId), ...(raw ?? {}) };
  const out: Record<string, number | string | boolean> = {};
  for (const control of getControls(tool, presetId)) {
    const incoming = merged[control.key];
    if (control.kind === 'slider') {
      const numeric = typeof incoming === 'number' ? incoming : Number(incoming);
      const value = Number.isFinite(numeric) ? numeric : control.defaultValue;
      out[control.key] = Math.min(control.max, Math.max(control.min, value));
    } else {
      const value = typeof incoming === 'string' ? incoming : control.defaultValue;
      out[control.key] = control.options.some((option) => option.id === value) ? value : control.defaultValue;
    }
  }
  if (typeof raw?.customColor === 'string' && parseHexColor(raw.customColor)) out.customColor = raw.customColor;
  return out;
}

export const LOCAL_VIDEO_DURATIONS = [2, 3, 4] as const;
export const ASPECTS = ['9:16', '1:1', '16:9'] as const;

export function num(parameters: Record<string, number | string | boolean>, key: string, fallback: number): number {
  const value = parameters[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
