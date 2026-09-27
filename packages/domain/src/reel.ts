export type ReelTransitionType = 'cut' | 'fade' | 'wipe';
export type ReelTextPosition = 'top' | 'center' | 'bottom';

export type ReelClip = {
  id: string;
  assetId: string;
  kind: 'image' | 'video';
  order: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
};

export type ReelText = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  position: ReelTextPosition;
};

export type ReelTransition = {
  id: string;
  afterClipId: string;
  type: ReelTransitionType;
  durationMs: number;
};

export type ReelAudio = {
  assetId: string;
  volume: number;
};

export type ReelTimeline = {
  id: string;
  projectId: string;
  width: number;
  height: number;
  fps: number;
  clips: ReelClip[];
  texts: ReelText[];
  transitions: ReelTransition[];
  audio: ReelAudio | null;
};

export const REEL_EXPORT_SIZE = { width: 1080, height: 1920, fps: 24 } as const;
export const REEL_PREVIEW_SIZE = { width: 540, height: 960, fps: 12 } as const;

export function createEmptyReel(id: string, projectId: string): ReelTimeline {
  return {
    id,
    projectId,
    width: REEL_EXPORT_SIZE.width,
    height: REEL_EXPORT_SIZE.height,
    fps: REEL_EXPORT_SIZE.fps,
    clips: [],
    texts: [],
    transitions: [],
    audio: null,
  };
}

export function clipPlayMs(clip: ReelClip): number {
  if (clip.kind === 'video' && clip.trimOutMs > clip.trimInMs) return clip.trimOutMs - clip.trimInMs;
  return clip.durationMs;
}

export function sortedClips(timeline: ReelTimeline): ReelClip[] {
  return [...timeline.clips].sort((a, b) => a.order - b.order);
}

export function moveClip(timeline: ReelTimeline, clipId: string, direction: -1 | 1): ReelTimeline {
  const clips = sortedClips(timeline);
  const index = clips.findIndex((clip) => clip.id === clipId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= clips.length) return timeline;
  const next = clips.slice();
  const [item] = next.splice(index, 1);
  if (!item) return timeline;
  next.splice(target, 0, item);
  return { ...timeline, clips: next.map((clip, order) => ({ ...clip, order })) };
}

export function validateTimeline(timeline: ReelTimeline): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const clips = sortedClips(timeline);
  if (clips.length === 0) errors.push('Añade al menos un clip.');
  if (timeline.width !== 1080 || timeline.height !== 1920) errors.push('El reel se prepara a 1080×1920.');
  for (const clip of clips) {
    const play = clipPlayMs(clip);
    if (play < 300 || play > 15000) errors.push(`El clip ${clip.id} debe durar entre 0,3 s y 15 s.`);
    if (clip.trimInMs < 0 || clip.trimOutMs < 0) errors.push('El recorte no puede ser negativo.');
  }
  for (const text of timeline.texts) {
    const clean = sanitizeOverlayText(text.text);
    if (clean.length === 0) errors.push('Hay un texto vacío.');
    if (text.endMs <= text.startMs) errors.push('El texto necesita un rango de tiempo válido.');
  }
  const ids = new Set(clips.map((clip) => clip.id));
  for (const transition of timeline.transitions) {
    if (!ids.has(transition.afterClipId)) errors.push('Hay una transición colgando de un clip que no existe.');
    if (transition.type !== 'cut' && (transition.durationMs < 80 || transition.durationMs > 1500)) {
      errors.push('La transición debe durar entre 80 ms y 1,5 s.');
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function sanitizeOverlayText(text: string): string {
  return text.replace(/[^\p{L}\p{N} .,:;!¡?¿+\-#'"°%&()]/gu, '').trim().slice(0, 80);
}

export function escapeDrawtext(text: string): string {
  return sanitizeOverlayText(text).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

export type ReelRenderRequest = {
  timeline: ReelTimeline;
  clips: { id: string; path: string }[];
  audioPath?: string;
  fontPath: string;
  width: number;
  height: number;
  fps: number;
  outputPath: string;
  disclosure: string;
};

export function buildReelArgs(request: ReelRenderRequest): { args: string[]; durationSec: number } {
  const validation = validateTimeline({ ...request.timeline, width: 1080, height: 1920 });
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }
  const clips = sortedClips(request.timeline);
  const paths = new Map(request.clips.map((clip) => [clip.id, clip.path]));
  const args = ['-y'];
  clips.forEach((clip, index) => {
    const path = paths.get(clip.id);
    if (!path) throw new Error(`Falta el archivo del clip ${clip.id}.`);
    const seconds = clipPlayMs(clip) / 1000;
    if (clip.kind === 'image') args.push('-loop', '1', '-t', seconds.toFixed(3), '-i', path);
    else args.push('-ss', (clip.trimInMs / 1000).toFixed(3), '-t', seconds.toFixed(3), '-i', path);
    void index;
  });
  let audioIndex: number | null = null;
  if (request.audioPath) {
    audioIndex = clips.length;
    args.push('-i', request.audioPath);
  }
  const filters: string[] = [];
  clips.forEach((_clip, index) => {
    filters.push(
      `[${index}:v]scale=${request.width}:${request.height}:force_original_aspect_ratio=increase,crop=${request.width}:${request.height},fps=${request.fps},setpts=PTS-STARTPTS,format=yuv420p[v${index}]`,
    );
  });
  let previous = 'v0';
  let cursor = clips[0] ? clipPlayMs(clips[0]) / 1000 : 0;
  for (let index = 1; index < clips.length; index += 1) {
    const clip = clips[index];
    const previousClip = clips[index - 1];
    if (!clip || !previousClip) continue;
    const transition = request.timeline.transitions.find((item) => item.afterClipId === previousClip.id);
    const type = transition?.type ?? 'cut';
    const duration = type === 'cut' ? 1 / request.fps : (transition?.durationMs ?? 300) / 1000;
    const offset = Math.max(0, cursor - duration);
    const name = type === 'wipe' ? 'wipeleft' : 'fade';
    const label = `x${index}`;
    filters.push(`[${previous}][v${index}]xfade=transition=${name}:duration=${duration.toFixed(3)}:offset=${offset.toFixed(3)}[${label}]`);
    previous = label;
    cursor += clipPlayMs(clip) / 1000 - duration;
  }
  let videoLabel = previous;
  request.timeline.texts.forEach((text, index) => {
    const clean = escapeDrawtext(text.text);
    if (!clean) return;
    const y = text.position === 'top' ? 'h*0.12' : text.position === 'center' ? '(h-text_h)/2' : 'h*0.78';
    const next = `t${index}`;
    const size = Math.max(28, Math.round(request.height * 0.045));
    filters.push(
      `[${videoLabel}]drawtext=fontfile='${request.fontPath}':text='${clean}':fontsize=${size}:fontcolor=white:borderw=2:bordercolor=black@0.65:x=(w-text_w)/2:y=${y}:enable='between(t,${(text.startMs / 1000).toFixed(3)},${(text.endMs / 1000).toFixed(3)})'[${next}]`,
    );
    videoLabel = next;
  });
  if (videoLabel !== 'vout') filters.push(`[${videoLabel}]copy[vout]`);
  if (audioIndex != null) {
    const volume = Math.max(0, Math.min(1, request.timeline.audio?.volume ?? 1));
    filters.push(`[${audioIndex}:a]volume=${volume.toFixed(2)}[aout]`);
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[vout]');
  if (audioIndex != null) args.push('-map', '[aout]', '-shortest');
  args.push(
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-metadata',
    `comment=${request.disclosure}`,
    request.outputPath,
  );
  return { args, durationSec: cursor };
}
