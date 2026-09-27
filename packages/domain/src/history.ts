import { DomainError, type HistoryState, type VersionNode } from './types';

export function createHistory(root: VersionNode): HistoryState {
  if (root.parentId !== null) throw new DomainError('history', 'La raíz no puede tener padre.');
  return { nodes: [root], headId: root.id, redoIds: [] };
}

export function nextVersionLabel(tool: string, labels: string[]): string {
  const prefix = tool.toUpperCase();
  let index = 1;
  while (labels.includes(`${prefix}_v${index}`)) index += 1;
  return `${prefix}_v${index}`;
}

function nodeMap(state: HistoryState): Map<string, VersionNode> {
  return new Map(state.nodes.map((node) => [node.id, node]));
}

export function lineage(state: HistoryState, fromId = state.headId): VersionNode[] {
  const map = nodeMap(state);
  const trail: VersionNode[] = [];
  let cursor = map.get(fromId) ?? null;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    trail.push(cursor);
    guard.add(cursor.id);
    cursor = cursor.parentId ? map.get(cursor.parentId) ?? null : null;
  }
  return trail.reverse();
}

export function undoHistory(state: HistoryState): HistoryState {
  const head = nodeMap(state).get(state.headId);
  if (!head?.parentId) return state;
  return { ...state, headId: head.parentId, redoIds: [head.id, ...state.redoIds] };
}

export function redoHistory(state: HistoryState): HistoryState {
  const [next, ...rest] = state.redoIds;
  if (!next) return state;
  const node = nodeMap(state).get(next);
  if (!node || node.parentId !== state.headId) return { ...state, redoIds: rest };
  return { ...state, headId: next, redoIds: rest };
}

export function keepVersion(state: HistoryState, node: VersionNode): HistoryState {
  if (node.parentId !== state.headId) {
    throw new DomainError('history', 'La versión nueva tiene que colgar de la versión actual.');
  }
  if (state.nodes.some((item) => item.id === node.id)) {
    throw new DomainError('history', 'Esa versión ya existe.');
  }
  return { nodes: [...state.nodes, node], headId: node.id, redoIds: [] };
}

export function jumpHistory(state: HistoryState, versionId: string): HistoryState {
  if (!nodeMap(state).has(versionId)) throw new DomainError('history', 'La versión no existe.');
  return { ...state, headId: versionId, redoIds: [] };
}

export function resetFull(state: HistoryState): HistoryState {
  const root = state.nodes.find((node) => node.parentId === null);
  if (!root) throw new DomainError('history', 'El proyecto no tiene original.');
  return { ...state, headId: root.id, redoIds: [] };
}

export function resetTool(state: HistoryState, tool: string): HistoryState {
  const map = nodeMap(state);
  let cursor = map.get(state.headId) ?? null;
  if (cursor?.tool !== tool) return state;
  while (cursor?.parentId && map.get(cursor.parentId)?.tool === tool) {
    cursor = map.get(cursor.parentId) ?? null;
  }
  if (!cursor?.parentId) return resetFull(state);
  return { ...state, headId: cursor.parentId, redoIds: [] };
}
