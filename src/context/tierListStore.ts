import { createContext, type Dispatch } from 'react';
import type { AniListCharacterNode, Character, CharacterFilters, Tier } from '../api/types';
import type { FetchProgress } from '../api/anilist';
import { filterCharacters, normalizeFilters, DEFAULT_FILTERS } from '../utils/filterCharacters';
import { mergeCharacterNode } from '../utils/characterUtils';
import { shuffleArray } from '../utils/shuffle';

export interface LoadProgress extends FetchProgress {
  username: string;
  usernameIndex: number;
  usernameCount: number;
}

/** A manually hidden (deleted) character, kept so it can be found and restored later. */
export interface DeletedEntry {
  character: Character;
  tierId: string | null;
}

export interface TierListState {
  /** Every character fetched so far, unfiltered, minus manually deleted ones. */
  allCharacters: Character[];
  /** allCharacters after the current filters are applied — what's actually shown. */
  characters: Character[];
  tiers: Tier[];
  /** characterId -> tierId, or null for the unranked pool. */
  assignments: Record<number, string | null>;
  usernames: string[];
  filters: CharacterFilters;
  /** Manually deleted character ids, excluded from allCharacters even across re-fetches/reloads. */
  deletedIds: number[];
  /**
   * Full data for manually hidden characters, most-recently-hidden last —
   * persisted, so both "undo last remove" and browsing/restoring any hidden
   * character survive a reload. `deletedIds` remains the source of truth for
   * *which* ids are excluded; this only backs the browsable/undo UI, so a
   * character hidden before this field existed is still correctly excluded
   * even though it won't appear here (no name/image was kept for it).
   */
  hiddenCharacters: DeletedEntry[];
  isLoading: boolean;
  loadProgress: LoadProgress | null;
  error: string | null;
}

export type TierListAction =
  | { type: 'FETCH_START'; usernames: string[] }
  | { type: 'FETCH_PROGRESS'; progress: LoadProgress }
  | { type: 'MERGE_CHARACTERS'; username: string; characters: AniListCharacterNode[] }
  | { type: 'FETCH_DONE' }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: CharacterFilters }
  | { type: 'MOVE_CHARACTER'; characterId: number; tierId: string | null }
  | { type: 'RENAME_TIER'; tierId: string; label: string }
  | { type: 'REORDER_TIER_CONTENTS'; tierKey: string | null; orderedIds: number[] }
  | { type: 'SHUFFLE_POOL' }
  | { type: 'DELETE_CHARACTER'; characterId: number }
  | { type: 'UNDO_DELETE' }
  | { type: 'RESTORE_CHARACTER'; characterId: number }
  | { type: 'UNHIDE_CHARACTER_ID'; characterId: number }
  | { type: 'REPLACE_STATE'; state: TierListState }
  | { type: 'ADD_TIER' }
  | { type: 'REMOVE_TIER'; tierId: string }
  | { type: 'SET_TIER_COLOR'; tierId: string; color: string }
  | { type: 'MOVE_TIER'; tierId: string; direction: 'up' | 'down' };

const TIERS_KEY = 'tierlist_tiers';
const ASSIGNMENTS_KEY = 'tierlist_assignments';
const USERNAMES_KEY = 'tierlist_usernames';
const FILTERS_KEY = 'tierlist_filters';
const CHARACTERS_CACHE_KEY = 'tierlist_characters_cache';
const DELETED_IDS_KEY = 'tierlist_deleted_ids';
const HIDDEN_CHARACTERS_KEY = 'tierlist_hidden_characters';
// Per-container ordering, keyed by tierId (or 'pool'); stores ordered character ids.
const ORDER_KEY = 'tierlist_order';

const TIER_COLORS: Record<string, string> = {
  S: '#ff7f7f',
  A: '#ffbf7f',
  B: '#ffdf7f',
  C: '#ffff7f',
  D: '#bfff7f',
  E: '#7fdfff',
  F: '#9f9fff',
};

const DEFAULT_TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'].map(label => ({
  id: `tier-${label}`,
  label,
  color: TIER_COLORS[label],
}));

const NEW_TIER_COLOR = '#cfd3e0';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function containerKey(tierId: string | null): string {
  return tierId ?? 'pool';
}

/** Orders `characters` per the saved order for their container, new entries appended. */
function applySavedOrder(characters: Character[], assignments: Record<number, string | null>): Character[] {
  const order = loadJSON<Record<string, number[]>>(ORDER_KEY, {});
  const byId = new Map(characters.map(c => [c.id, c]));
  const placed = new Set<number>();
  const result: Character[] = [];

  const containers = new Map<string, number[]>();
  for (const c of characters) {
    const key = containerKey(assignments[c.id] ?? null);
    if (!containers.has(key)) containers.set(key, []);
    containers.get(key)!.push(c.id);
  }

  for (const [key, ids] of containers) {
    const savedIds = order[key] ?? [];
    const idSet = new Set(ids);
    for (const id of savedIds) {
      if (idSet.has(id) && !placed.has(id)) {
        result.push(byId.get(id)!);
        placed.add(id);
      }
    }
    for (const id of ids) {
      if (!placed.has(id)) {
        result.push(byId.get(id)!);
        placed.add(id);
      }
    }
  }

  return result;
}

function saveOrderFromCharacters(characters: Character[], assignments: Record<number, string | null>) {
  const order: Record<string, number[]> = {};
  for (const c of characters) {
    const key = containerKey(assignments[c.id] ?? null);
    if (!order[key]) order[key] = [];
    order[key].push(c.id);
  }
  saveJSON(ORDER_KEY, order);
}

/** Restores the hidden-characters entry at `index` back into allCharacters/assignments. */
function restoreHiddenEntry(state: TierListState, index: number): TierListState {
  const { character, tierId } = state.hiddenCharacters[index];
  const hiddenCharacters = state.hiddenCharacters.filter((_, i) => i !== index);
  saveJSON(HIDDEN_CHARACTERS_KEY, hiddenCharacters);

  const deletedIds = state.deletedIds.filter(id => id !== character.id);
  saveJSON(DELETED_IDS_KEY, deletedIds);

  const allCharacters = [...state.allCharacters, character];
  const assignments = { ...state.assignments, [character.id]: tierId };
  saveJSON(ASSIGNMENTS_KEY, assignments);

  const filtered = filterCharacters(allCharacters, state.filters);
  const characters = applySavedOrder(filtered, assignments);

  return {
    ...state,
    allCharacters,
    characters,
    assignments,
    deletedIds,
    hiddenCharacters,
  };
}

export function tierListReducer(state: TierListState, action: TierListAction): TierListState {
  switch (action.type) {
    case 'FETCH_START':
      saveJSON(USERNAMES_KEY, action.usernames);
      return { ...state, usernames: action.usernames, isLoading: true, loadProgress: null, error: null };

    case 'FETCH_PROGRESS':
      return { ...state, loadProgress: action.progress };

    case 'MERGE_CHARACTERS': {
      // A streaming batch must not resurrect characters the user manually
      // deleted, and re-fetches merge additively (nothing is ever removed
      // here) so a failed/interrupted fetch can never leave less than before.
      const deletedSet = new Set(state.deletedIds);
      const byId = new Map(state.allCharacters.map(c => [c.id, c]));

      for (const node of action.characters) {
        if (deletedSet.has(node.id)) continue;
        byId.set(node.id, mergeCharacterNode(byId.get(node.id), action.username, node));
      }

      const allCharacters = Array.from(byId.values());
      const assignments = { ...state.assignments };
      for (const c of allCharacters) {
        if (!(c.id in assignments)) assignments[c.id] = null;
      }

      const characters = filterCharacters(allCharacters, state.filters);
      saveJSON(CHARACTERS_CACHE_KEY, allCharacters);
      saveJSON(ASSIGNMENTS_KEY, assignments);

      return {
        ...state,
        allCharacters,
        characters: applySavedOrder(characters, assignments),
        assignments,
      };
    }

    case 'FETCH_DONE':
      return { ...state, isLoading: false, loadProgress: null, error: null };

    case 'FETCH_ERROR':
      return { ...state, isLoading: false, loadProgress: null, error: action.error };

    case 'SET_FILTERS': {
      saveJSON(FILTERS_KEY, action.filters);
      const characters = filterCharacters(state.allCharacters, action.filters);
      return {
        ...state,
        filters: action.filters,
        characters: applySavedOrder(characters, state.assignments),
      };
    }

    case 'MOVE_CHARACTER': {
      const assignments = { ...state.assignments, [action.characterId]: action.tierId };
      saveJSON(ASSIGNMENTS_KEY, assignments);
      saveOrderFromCharacters(state.characters, assignments);
      return { ...state, assignments };
    }

    case 'REORDER_TIER_CONTENTS': {
      const otherContainerIds = new Set(
        state.characters
          .filter(c => containerKey(state.assignments[c.id] ?? null) !== containerKey(action.tierKey))
          .map(c => c.id)
      );
      const byId = new Map(state.characters.map(c => [c.id, c]));
      const reordered = [
        ...state.characters.filter(c => otherContainerIds.has(c.id)),
        ...action.orderedIds.map(id => byId.get(id)).filter((c): c is Character => !!c),
      ];
      saveOrderFromCharacters(reordered, state.assignments);
      return { ...state, characters: reordered };
    }

    case 'SHUFFLE_POOL': {
      const poolChars = state.characters.filter(c => (state.assignments[c.id] ?? null) === null);
      const tieredChars = state.characters.filter(c => (state.assignments[c.id] ?? null) !== null);
      const characters = [...tieredChars, ...shuffleArray(poolChars)];
      saveOrderFromCharacters(characters, state.assignments);
      return { ...state, characters };
    }

    case 'RENAME_TIER': {
      const tiers = state.tiers.map(t => (t.id === action.tierId ? { ...t, label: action.label } : t));
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    case 'ADD_TIER': {
      const newTier: Tier = { id: `tier-${crypto.randomUUID()}`, label: 'New Tier', color: NEW_TIER_COLOR };
      const tiers = [...state.tiers, newTier];
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    case 'REMOVE_TIER': {
      // Checked against every assignment, not just the currently-filtered
      // `state.characters` — a character hidden by an active filter still
      // holds this tierId in `assignments` and must not be silently orphaned.
      const hasMembers = Object.values(state.assignments).some(t => t === action.tierId);
      if (hasMembers) return state;

      const tiers = state.tiers.filter(t => t.id !== action.tierId);
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    case 'SET_TIER_COLOR': {
      const tiers = state.tiers.map(t => (t.id === action.tierId ? { ...t, color: action.color } : t));
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    case 'MOVE_TIER': {
      // Only reorders the tiers array — assignments map characterId -> tierId
      // (never a position), so every character stays with its tier as the
      // tier itself moves.
      const index = state.tiers.findIndex(t => t.id === action.tierId);
      const swapWith = action.direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || swapWith < 0 || swapWith >= state.tiers.length) return state;

      const tiers = [...state.tiers];
      [tiers[index], tiers[swapWith]] = [tiers[swapWith], tiers[index]];
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    case 'DELETE_CHARACTER': {
      const character = state.allCharacters.find(c => c.id === action.characterId);
      if (!character) return state;

      const tierId = state.assignments[action.characterId] ?? null;
      const deletedIds = [...state.deletedIds, action.characterId];
      saveJSON(DELETED_IDS_KEY, deletedIds);

      const hiddenCharacters = [...state.hiddenCharacters, { character, tierId }];
      saveJSON(HIDDEN_CHARACTERS_KEY, hiddenCharacters);

      const allCharacters = state.allCharacters.filter(c => c.id !== action.characterId);
      const characters = state.characters.filter(c => c.id !== action.characterId);
      const assignments = { ...state.assignments };
      delete assignments[action.characterId];
      saveJSON(ASSIGNMENTS_KEY, assignments);
      saveOrderFromCharacters(characters, assignments);

      return {
        ...state,
        allCharacters,
        characters,
        assignments,
        deletedIds,
        hiddenCharacters,
      };
    }

    case 'UNDO_DELETE': {
      if (state.hiddenCharacters.length === 0) return state;
      return restoreHiddenEntry(state, state.hiddenCharacters.length - 1);
    }

    case 'RESTORE_CHARACTER': {
      const index = state.hiddenCharacters.findIndex(e => e.character.id === action.characterId);
      if (index === -1) return state;
      return restoreHiddenEntry(state, index);
    }

    case 'UNHIDE_CHARACTER_ID': {
      // For ids hidden before the hiddenCharacters archive existed — no
      // name/image was kept, so there's nothing to put back into
      // allCharacters directly. This only lifts the exclusion; the character
      // reappears the next time a fetch actually finds it again on AniList.
      if (!state.deletedIds.includes(action.characterId)) return state;
      const deletedIds = state.deletedIds.filter(id => id !== action.characterId);
      saveJSON(DELETED_IDS_KEY, deletedIds);
      return { ...state, deletedIds };
    }

    case 'REPLACE_STATE':
      return action.state;

    default:
      return state;
  }
}

export function initTierListState(): TierListState {
  const tiers = loadJSON<Tier[]>(TIERS_KEY, DEFAULT_TIERS);
  const assignments = loadJSON<Record<number, string | null>>(ASSIGNMENTS_KEY, {});
  const usernames = loadJSON<string[]>(USERNAMES_KEY, []);
  const filters = normalizeFilters(loadJSON<Partial<CharacterFilters>>(FILTERS_KEY, DEFAULT_FILTERS));
  const deletedIds = loadJSON<number[]>(DELETED_IDS_KEY, []);
  const hiddenCharacters = loadJSON<DeletedEntry[]>(HIDDEN_CHARACTERS_KEY, []);
  const deletedSet = new Set(deletedIds);
  const allCharacters = loadJSON<Character[]>(CHARACTERS_CACHE_KEY, []).filter(c => !deletedSet.has(c.id));
  const characters = applySavedOrder(filterCharacters(allCharacters, filters), assignments);

  return {
    allCharacters,
    characters,
    tiers,
    assignments,
    usernames,
    filters,
    deletedIds,
    hiddenCharacters,
    isLoading: false,
    loadProgress: null,
    error: null,
  };
}

export interface TierListContextType {
  state: TierListState;
  dispatch: Dispatch<TierListAction>;
}

export const TierListContext = createContext<TierListContextType | null>(null);

export interface TierListExportBundle {
  version: 1;
  /** ISO timestamp; informational only, not validated on import. */
  exportedAt: string;
  tiers: Tier[];
  assignments: Record<number, string | null>;
  usernames: string[];
  filters: CharacterFilters;
  /** Manually hidden character ids — the whole point of exporting this. */
  deletedIds: number[];
  /** Full data for hidden characters, so they stay browsable/restorable after import. */
  hiddenCharacters: DeletedEntry[];
  allCharacters: Character[];
  order: Record<string, number[]>;
}

/** Builds a full, self-contained snapshot of everything persisted for this app. */
export function buildExportBundle(state: TierListState): TierListExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tiers: state.tiers,
    assignments: state.assignments,
    usernames: state.usernames,
    filters: state.filters,
    deletedIds: state.deletedIds,
    hiddenCharacters: state.hiddenCharacters,
    allCharacters: state.allCharacters,
    order: loadJSON<Record<string, number[]>>(ORDER_KEY, {}),
  };
}

export class ImportValidationError extends Error {}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidTier(v: unknown): v is Tier {
  return isPlainObject(v) && typeof v.id === 'string' && typeof v.label === 'string';
}

function isValidCharacter(v: unknown): v is Character {
  return (
    isPlainObject(v) &&
    typeof v.id === 'number' &&
    isPlainObject(v.name) &&
    typeof (v.name as Record<string, unknown>).full === 'string' &&
    isPlainObject(v.image) &&
    typeof (v.image as Record<string, unknown>).large === 'string' &&
    typeof v.favourites === 'number' &&
    (v.gender === null || typeof v.gender === 'string') &&
    Array.isArray(v.sourceUsernames) &&
    v.sourceUsernames.every(u => typeof u === 'string')
  );
}

function isValidDeletedEntry(v: unknown): v is DeletedEntry {
  return isPlainObject(v) && isValidCharacter(v.character) && (v.tierId === null || typeof v.tierId === 'string');
}

/**
 * Validates untrusted (user-uploaded) JSON into a well-formed export bundle.
 * Throws `ImportValidationError` on any problem and performs no localStorage
 * writes — callers must only persist/apply the result once this returns
 * successfully, so a bad file can never leave storage partially overwritten.
 */
export function parseImportBundle(raw: unknown): TierListExportBundle {
  if (!isPlainObject(raw)) {
    throw new ImportValidationError('That file is not a valid qanimetierlist export.');
  }
  if (raw.version !== 1) {
    throw new ImportValidationError('Unsupported export version.');
  }
  if (!Array.isArray(raw.tiers) || !raw.tiers.every(isValidTier)) {
    throw new ImportValidationError('Export file is missing valid tier data.');
  }
  if (!isPlainObject(raw.assignments)) {
    throw new ImportValidationError('Export file is missing valid tier assignments.');
  }
  if (!Array.isArray(raw.usernames) || !raw.usernames.every(u => typeof u === 'string')) {
    throw new ImportValidationError('Export file is missing valid usernames.');
  }
  if (!Array.isArray(raw.deletedIds) || !raw.deletedIds.every(id => typeof id === 'number')) {
    throw new ImportValidationError('Export file is missing valid hidden-character data.');
  }
  if (!Array.isArray(raw.allCharacters) || !raw.allCharacters.every(isValidCharacter)) {
    throw new ImportValidationError('Export file is missing valid character data.');
  }
  if (!isPlainObject(raw.order)) {
    throw new ImportValidationError('Export file is missing valid ordering data.');
  }

  // Lenient: older export files predate this field, so a missing/invalid
  // value just means "no browsable hidden-character data" rather than
  // failing the whole import — `deletedIds` above already covers exclusion.
  const hiddenCharacters =
    Array.isArray(raw.hiddenCharacters) && raw.hiddenCharacters.every(isValidDeletedEntry)
      ? raw.hiddenCharacters
      : [];

  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    tiers: raw.tiers,
    assignments: raw.assignments as Record<number, string | null>,
    usernames: raw.usernames,
    filters: normalizeFilters(isPlainObject(raw.filters) ? (raw.filters as Partial<CharacterFilters>) : null),
    deletedIds: raw.deletedIds,
    hiddenCharacters,
    allCharacters: raw.allCharacters,
    order: raw.order as Record<string, number[]>,
  };
}

/**
 * Persists a validated bundle to localStorage (full replace of the 8 keys
 * this app owns) and returns the equivalent in-memory state. Only call this
 * after `parseImportBundle` has already succeeded.
 */
export function applyImportBundle(bundle: TierListExportBundle): TierListState {
  saveJSON(TIERS_KEY, bundle.tiers);
  saveJSON(ASSIGNMENTS_KEY, bundle.assignments);
  saveJSON(USERNAMES_KEY, bundle.usernames);
  saveJSON(FILTERS_KEY, bundle.filters);
  saveJSON(DELETED_IDS_KEY, bundle.deletedIds);
  saveJSON(HIDDEN_CHARACTERS_KEY, bundle.hiddenCharacters);
  saveJSON(CHARACTERS_CACHE_KEY, bundle.allCharacters);
  saveJSON(ORDER_KEY, bundle.order);

  const characters = applySavedOrder(filterCharacters(bundle.allCharacters, bundle.filters), bundle.assignments);

  return {
    allCharacters: bundle.allCharacters,
    characters,
    tiers: bundle.tiers,
    assignments: bundle.assignments,
    usernames: bundle.usernames,
    filters: bundle.filters,
    deletedIds: bundle.deletedIds,
    hiddenCharacters: bundle.hiddenCharacters,
    isLoading: false,
    loadProgress: null,
    error: null,
  };
}
