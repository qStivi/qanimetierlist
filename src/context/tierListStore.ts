import { createContext, type Dispatch } from 'react';
import type {
  AniListCharacterNode,
  AniListMediaNode,
  AnimeEntry,
  AnimeFilters,
  Character,
  CharacterFilters,
  EntityMode,
  Entry,
  ListKey,
  Tier,
} from '../api/types';
import type { FetchProgress } from '../api/anilist';
import { getAdapter } from '../modes';
import { storageKeysFor, type StorageKeys } from '../utils/storageKeys';
import { loadJSON, saveJSON } from '../utils/storage';
import { LEGACY_LISTS } from '../utils/listSources';
import { shuffleArray } from '../utils/shuffle';

export interface LoadProgress extends FetchProgress {
  username: string;
  usernameIndex: number;
  usernameCount: number;
}

/** A manually hidden (deleted) entry, kept so it can be found and restored later. */
export interface HiddenEntry {
  entry: Entry;
  tierId: string | null;
}

export interface TierListState {
  mode: EntityMode;
  /** Every entry fetched so far, unfiltered, minus manually deleted ones. */
  allEntries: Entry[];
  /** allEntries after the current filters are applied — what's actually shown. */
  entries: Entry[];
  tiers: Tier[];
  /** entryId -> tierId, or null for the unranked pool. */
  assignments: Record<number, string | null>;
  usernames: string[];
  filters: CharacterFilters | AnimeFilters;
  /** Manually deleted entry ids, excluded from allEntries even across re-fetches/reloads. */
  deletedIds: number[];
  /**
   * Full data for manually hidden entries, most-recently-hidden last —
   * persisted, so both "undo last remove" and browsing/restoring any hidden
   * entry survive a reload. `deletedIds` remains the source of truth for
   * *which* ids are excluded; this only backs the browsable/undo UI, so an
   * entry hidden before this field existed is still correctly excluded
   * even though it won't appear here (no name/image was kept for it).
   */
  hiddenEntries: HiddenEntry[];
  isLoading: boolean;
  loadProgress: LoadProgress | null;
  error: string | null;
}

export type TierListAction =
  | { type: 'FETCH_START'; usernames: string[] }
  | { type: 'FETCH_PROGRESS'; progress: LoadProgress }
  | { type: 'MERGE_ENTRIES'; username: string; list: ListKey; nodes: (AniListCharacterNode | AniListMediaNode)[] }
  | { type: 'FETCH_DONE' }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: CharacterFilters | AnimeFilters }
  | { type: 'MOVE_ENTRY'; entryId: number; tierId: string | null }
  | { type: 'RENAME_TIER'; tierId: string; label: string }
  | { type: 'REORDER_TIER_CONTENTS'; tierKey: string | null; orderedIds: number[] }
  | { type: 'SHUFFLE_POOL' }
  | { type: 'DELETE_ENTRY'; entryId: number }
  | { type: 'UNDO_DELETE' }
  | { type: 'RESTORE_ENTRY'; entryId: number }
  | { type: 'UNHIDE_ENTRY_ID'; entryId: number }
  | { type: 'REPLACE_STATE'; state: TierListState }
  | { type: 'ADD_TIER' }
  | { type: 'REMOVE_TIER'; tierId: string }
  | { type: 'SET_TIER_COLOR'; tierId: string; color: string }
  | { type: 'MOVE_TIER'; tierId: string; direction: 'up' | 'down' };

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

function containerKey(tierId: string | null): string {
  return tierId ?? 'pool';
}

/**
 * The adapter's methods are typed per concrete mode; at runtime the mode is
 * fixed for the lifetime of a reducer, so this is the type-safe-erased view
 * the generic store code works against.
 */
interface RuntimeAdapter {
  mergeNode(existing: Entry | undefined, username: string, list: ListKey, node: unknown): Entry;
  filterEntries(entries: Entry[], filters: CharacterFilters | AnimeFilters): Entry[];
  normalizeFilters(raw: unknown): CharacterFilters | AnimeFilters;
  defaultFilters: CharacterFilters | AnimeFilters;
}

function runtimeAdapter(mode: EntityMode): RuntimeAdapter {
  return getAdapter(mode) as unknown as RuntimeAdapter;
}

/** Orders `entries` per the saved order for their container, new entries appended. */
function applySavedOrder(entries: Entry[], assignments: Record<number, string | null>, keys: StorageKeys): Entry[] {
  const order = loadJSON<Record<string, number[]>>(keys.order, {});
  const byId = new Map(entries.map(e => [e.id, e]));
  const placed = new Set<number>();
  const result: Entry[] = [];

  const containers = new Map<string, number[]>();
  for (const e of entries) {
    const key = containerKey(assignments[e.id] ?? null);
    if (!containers.has(key)) containers.set(key, []);
    containers.get(key)!.push(e.id);
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

function saveOrderFromEntries(
  entries: Entry[],
  assignments: Record<number, string | null>,
  keys: StorageKeys
) {
  const order: Record<string, number[]> = {};
  for (const e of entries) {
    const key = containerKey(assignments[e.id] ?? null);
    if (!order[key]) order[key] = [];
    order[key].push(e.id);
  }
  saveJSON(keys.order, order);
}

/** Restores the hidden-entries entry at `index` back into allEntries/assignments. */
function restoreHiddenEntry(state: TierListState, index: number, adapter: RuntimeAdapter, keys: StorageKeys): TierListState {
  const { entry, tierId } = state.hiddenEntries[index];
  const hiddenEntries = state.hiddenEntries.filter((_, i) => i !== index);
  saveJSON(keys.hidden, hiddenEntries);

  const deletedIds = state.deletedIds.filter(id => id !== entry.id);
  saveJSON(keys.deletedIds, deletedIds);

  const allEntries = [...state.allEntries, entry];
  const assignments = { ...state.assignments, [entry.id]: tierId };
  saveJSON(keys.assignments, assignments);

  const filtered = adapter.filterEntries(allEntries, state.filters);
  const entries = applySavedOrder(filtered, assignments, keys);

  return {
    ...state,
    allEntries,
    entries,
    assignments,
    deletedIds,
    hiddenEntries,
  };
}

/**
 * Builds the reducer for one mode. The mode is fixed for the lifetime of the
 * returned reducer (the provider remounts it via `key={mode}` on switch), so
 * the adapter and storage keys can be closed over instead of threaded through
 * every action.
 */
export function createTierListReducer(mode: EntityMode) {
  const keys = storageKeysFor(mode);
  const adapter = runtimeAdapter(mode);

  return function tierListReducer(state: TierListState, action: TierListAction): TierListState {
    switch (action.type) {
      case 'FETCH_START':
        saveJSON(keys.usernames, action.usernames);
        return { ...state, usernames: action.usernames, isLoading: true, loadProgress: null, error: null };

      case 'FETCH_PROGRESS':
        return { ...state, loadProgress: action.progress };

      case 'MERGE_ENTRIES': {
        // A streaming batch must not resurrect entries the user manually
        // deleted, and re-fetches merge additively (nothing is ever removed
        // here) so a failed/interrupted fetch can never leave less than before.
        const deletedSet = new Set(state.deletedIds);
        const byId = new Map(state.allEntries.map(e => [e.id, e]));

        for (const node of action.nodes) {
          if (deletedSet.has(node.id)) continue;
          byId.set(node.id, adapter.mergeNode(byId.get(node.id), action.username, action.list, node));
        }

        const allEntries = Array.from(byId.values());
        const assignments = { ...state.assignments };
        for (const e of allEntries) {
          if (!(e.id in assignments)) assignments[e.id] = null;
        }

        const entries = adapter.filterEntries(allEntries, state.filters);
        saveJSON(keys.cache, allEntries);
        saveJSON(keys.assignments, assignments);

        return {
          ...state,
          allEntries,
          entries: applySavedOrder(entries, assignments, keys),
          assignments,
        };
      }

      case 'FETCH_DONE':
        return { ...state, isLoading: false, loadProgress: null, error: null };

      case 'FETCH_ERROR':
        return { ...state, isLoading: false, loadProgress: null, error: action.error };

      case 'SET_FILTERS': {
        saveJSON(keys.filters, action.filters);
        const entries = adapter.filterEntries(state.allEntries, action.filters);
        return {
          ...state,
          filters: action.filters,
          entries: applySavedOrder(entries, state.assignments, keys),
        };
      }

      case 'MOVE_ENTRY': {
        const assignments = { ...state.assignments, [action.entryId]: action.tierId };
        saveJSON(keys.assignments, assignments);
        saveOrderFromEntries(state.entries, assignments, keys);
        return { ...state, assignments };
      }

      case 'REORDER_TIER_CONTENTS': {
        const otherContainerIds = new Set(
          state.entries
            .filter(e => containerKey(state.assignments[e.id] ?? null) !== containerKey(action.tierKey))
            .map(e => e.id)
        );
        const byId = new Map(state.entries.map(e => [e.id, e]));
        const reordered = [
          ...state.entries.filter(e => otherContainerIds.has(e.id)),
          ...action.orderedIds.map(id => byId.get(id)).filter((e): e is Entry => !!e),
        ];
        saveOrderFromEntries(reordered, state.assignments, keys);
        return { ...state, entries: reordered };
      }

      case 'SHUFFLE_POOL': {
        const poolEntries = state.entries.filter(e => (state.assignments[e.id] ?? null) === null);
        const tieredEntries = state.entries.filter(e => (state.assignments[e.id] ?? null) !== null);
        const entries = [...tieredEntries, ...shuffleArray(poolEntries)];
        saveOrderFromEntries(entries, state.assignments, keys);
        return { ...state, entries };
      }

      case 'RENAME_TIER': {
        const tiers = state.tiers.map(t => (t.id === action.tierId ? { ...t, label: action.label } : t));
        saveJSON(keys.tiers, tiers);
        return { ...state, tiers };
      }

      case 'ADD_TIER': {
        const newTier: Tier = { id: `tier-${crypto.randomUUID()}`, label: 'New Tier', color: NEW_TIER_COLOR };
        const tiers = [...state.tiers, newTier];
        saveJSON(keys.tiers, tiers);
        return { ...state, tiers };
      }

      case 'REMOVE_TIER': {
        // Checked against every assignment, not just the currently-filtered
        // `state.entries` — an entry hidden by an active filter still
        // holds this tierId in `assignments` and must not be silently orphaned.
        const hasMembers = Object.values(state.assignments).some(t => t === action.tierId);
        if (hasMembers) return state;

        const tiers = state.tiers.filter(t => t.id !== action.tierId);
        saveJSON(keys.tiers, tiers);
        return { ...state, tiers };
      }

      case 'SET_TIER_COLOR': {
        const tiers = state.tiers.map(t => (t.id === action.tierId ? { ...t, color: action.color } : t));
        saveJSON(keys.tiers, tiers);
        return { ...state, tiers };
      }

      case 'MOVE_TIER': {
        // Only reorders the tiers array — assignments map entryId -> tierId
        // (never a position), so every entry stays with its tier as the
        // tier itself moves.
        const index = state.tiers.findIndex(t => t.id === action.tierId);
        const swapWith = action.direction === 'up' ? index - 1 : index + 1;
        if (index === -1 || swapWith < 0 || swapWith >= state.tiers.length) return state;

        const tiers = [...state.tiers];
        [tiers[index], tiers[swapWith]] = [tiers[swapWith], tiers[index]];
        saveJSON(keys.tiers, tiers);
        return { ...state, tiers };
      }

      case 'DELETE_ENTRY': {
        const entry = state.allEntries.find(e => e.id === action.entryId);
        if (!entry) return state;

        const tierId = state.assignments[action.entryId] ?? null;
        const deletedIds = [...state.deletedIds, action.entryId];
        saveJSON(keys.deletedIds, deletedIds);

        const hiddenEntries = [...state.hiddenEntries, { entry, tierId }];
        saveJSON(keys.hidden, hiddenEntries);

        const allEntries = state.allEntries.filter(e => e.id !== action.entryId);
        const entries = state.entries.filter(e => e.id !== action.entryId);
        const assignments = { ...state.assignments };
        delete assignments[action.entryId];
        saveJSON(keys.assignments, assignments);
        saveOrderFromEntries(entries, assignments, keys);

        return {
          ...state,
          allEntries,
          entries,
          assignments,
          deletedIds,
          hiddenEntries,
        };
      }

      case 'UNDO_DELETE': {
        if (state.hiddenEntries.length === 0) return state;
        return restoreHiddenEntry(state, state.hiddenEntries.length - 1, adapter, keys);
      }

      case 'RESTORE_ENTRY': {
        const index = state.hiddenEntries.findIndex(e => e.entry.id === action.entryId);
        if (index === -1) return state;
        return restoreHiddenEntry(state, index, adapter, keys);
      }

      case 'UNHIDE_ENTRY_ID': {
        // For ids hidden before the hiddenEntries archive existed — no
        // name/image was kept, so there's nothing to put back into
        // allEntries directly. This only lifts the exclusion; the entry
        // reappears the next time a fetch actually finds it again on AniList.
        if (!state.deletedIds.includes(action.entryId)) return state;
        const deletedIds = state.deletedIds.filter(id => id !== action.entryId);
        saveJSON(keys.deletedIds, deletedIds);
        return { ...state, deletedIds };
      }

      case 'REPLACE_STATE':
        return action.state;

      default:
        return state;
    }
  };
}

export function initTierListState(mode: EntityMode): TierListState {
  const keys = storageKeysFor(mode);
  const adapter = runtimeAdapter(mode);
  const tiers = loadJSON<Tier[]>(keys.tiers, DEFAULT_TIERS);
  const assignments = loadJSON<Record<number, string | null>>(keys.assignments, {});
  const usernames = loadJSON<string[]>(keys.usernames, []);
  const filters = adapter.normalizeFilters(loadJSON<unknown>(keys.filters, adapter.defaultFilters));
  const deletedIds = loadJSON<number[]>(keys.deletedIds, []);
  const hiddenEntries = loadJSON<HiddenEntry[]>(keys.hidden, []).map(withListsEntry);
  const deletedSet = new Set(deletedIds);
  const allEntries = loadJSON<Entry[]>(keys.cache, [])
    .filter(e => !deletedSet.has(e.id))
    .map(withLists);
  const entries = applySavedOrder(adapter.filterEntries(allEntries, filters), assignments, keys);

  return {
    mode,
    allEntries,
    entries,
    tiers,
    assignments,
    usernames,
    filters,
    deletedIds,
    hiddenEntries,
    isLoading: false,
    loadProgress: null,
    error: null,
  };
}

export interface TierListContextType {
  state: TierListState;
  dispatch: Dispatch<TierListAction>;
  mode: EntityMode;
  entryName: (entry: Entry) => string;
}

export const TierListContext = createContext<TierListContextType | null>(null);

export interface TierListExportBundle {
  version: 2;
  mode: EntityMode;
  /** ISO timestamp; informational only, not validated on import. */
  exportedAt: string;
  tiers: Tier[];
  assignments: Record<number, string | null>;
  usernames: string[];
  filters: CharacterFilters | AnimeFilters;
  /** Manually hidden entry ids — the whole point of exporting this. */
  deletedIds: number[];
  /** Full data for hidden entries, so they stay browsable/restorable after import. */
  hiddenEntries: HiddenEntry[];
  entries: Entry[];
  order: Record<string, number[]>;
}

/** Builds a full, self-contained snapshot of everything persisted for the current mode. */
export function buildExportBundle(state: TierListState): TierListExportBundle {
  return {
    version: 2,
    mode: state.mode,
    exportedAt: new Date().toISOString(),
    tiers: state.tiers,
    assignments: state.assignments,
    usernames: state.usernames,
    filters: state.filters,
    deletedIds: state.deletedIds,
    hiddenEntries: state.hiddenEntries,
    entries: state.allEntries,
    order: loadJSON<Record<string, number[]>>(storageKeysFor(state.mode).order, {}),
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

function isValidAnimeEntry(v: unknown): v is AnimeEntry {
  return (
    isPlainObject(v) &&
    typeof v.id === 'number' &&
    isPlainObject(v.title) &&
    typeof (v.title as Record<string, unknown>).romaji === 'string' &&
    isPlainObject(v.image) &&
    typeof (v.image as Record<string, unknown>).large === 'string' &&
    (v.averageScore === null || typeof v.averageScore === 'number') &&
    (v.episodes === null || typeof v.episodes === 'number') &&
    Array.isArray(v.genres) &&
    typeof v.favourites === 'number' &&
    Array.isArray(v.sourceUsernames) &&
    v.sourceUsernames.every(u => typeof u === 'string')
  );
}

function isValidEntryFor(mode: EntityMode, v: unknown): v is Entry {
  return mode === 'anime' ? isValidAnimeEntry(v) : isValidCharacter(v);
}

/**
 * Entries cached or exported before manga/status support have no `lists`;
 * they were all loaded from completed anime, so that's what they get.
 */
function withLists(e: Entry): Entry {
  const lists = Array.isArray(e.lists) && e.lists.length > 0 ? e.lists : LEGACY_LISTS;
  return e.lists === lists ? e : { ...e, lists };
}

function withListsEntry(e: HiddenEntry): HiddenEntry {
  return { ...e, entry: withLists(e.entry) };
}

function isValidHiddenEntry(mode: EntityMode, v: unknown): v is HiddenEntry {
  return isPlainObject(v) && isValidEntryFor(mode, v.entry) && (v.tierId === null || typeof v.tierId === 'string');
}

/**
 * Validates untrusted (user-uploaded) JSON into a well-formed export bundle.
 * Accepts version 2 bundles (mode + entries) and legacy version 1 bundles
 * (characters, `allCharacters`/`hiddenCharacters` field names). Throws
 * `ImportValidationError` on any problem and performs no localStorage
 * writes — callers must only persist/apply the result once this returns
 * successfully, so a bad file can never leave storage partially overwritten.
 */
export function parseImportBundle(raw: unknown): TierListExportBundle {
  if (!isPlainObject(raw)) {
    throw new ImportValidationError('That file is not a valid qanimetierlist export.');
  }
  if (raw.version !== 1 && raw.version !== 2) {
    throw new ImportValidationError('Unsupported export version.');
  }
  const mode: EntityMode = raw.version === 2 && raw.mode === 'anime' ? 'anime' : 'characters';
  const entriesField = raw.version === 2 ? raw.entries : raw.allCharacters;
  const hiddenField = raw.version === 2 ? raw.hiddenEntries : raw.hiddenCharacters;

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
    throw new ImportValidationError('Export file is missing valid hidden-entry data.');
  }
  if (!Array.isArray(entriesField) || !entriesField.every(e => isValidEntryFor(mode, e))) {
    throw new ImportValidationError('Export file is missing valid entry data.');
  }
  if (!isPlainObject(raw.order)) {
    throw new ImportValidationError('Export file is missing valid ordering data.');
  }

  // Lenient: older export files predate this field, so a missing/invalid
  // value just means "no browsable hidden-entry data" rather than
  // failing the whole import — `deletedIds` above already covers exclusion.
  const hiddenEntries =
    Array.isArray(hiddenField) && hiddenField.every(e => isValidHiddenEntry(mode, e))
      ? hiddenField.map(withListsEntry)
      : [];

  const adapter = runtimeAdapter(mode);

  return {
    version: 2,
    mode,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    tiers: raw.tiers,
    assignments: raw.assignments as Record<number, string | null>,
    usernames: raw.usernames,
    filters: adapter.normalizeFilters(isPlainObject(raw.filters) ? raw.filters : null),
    deletedIds: raw.deletedIds,
    hiddenEntries,
    entries: (entriesField as Entry[]).map(withLists),
    order: raw.order as Record<string, number[]>,
  };
}

/**
 * Persists a validated bundle to localStorage (full replace of the 8 keys the
 * bundle's mode owns) and returns the equivalent in-memory state. Only call
 * this after `parseImportBundle` has already succeeded.
 */
export function applyImportBundle(bundle: TierListExportBundle): TierListState {
  const keys = storageKeysFor(bundle.mode);
  const adapter = runtimeAdapter(bundle.mode);
  saveJSON(keys.tiers, bundle.tiers);
  saveJSON(keys.assignments, bundle.assignments);
  saveJSON(keys.usernames, bundle.usernames);
  saveJSON(keys.filters, bundle.filters);
  saveJSON(keys.deletedIds, bundle.deletedIds);
  saveJSON(keys.hidden, bundle.hiddenEntries);
  saveJSON(keys.cache, bundle.entries);
  saveJSON(keys.order, bundle.order);

  const entries = applySavedOrder(adapter.filterEntries(bundle.entries, bundle.filters), bundle.assignments, keys);

  return {
    mode: bundle.mode,
    allEntries: bundle.entries,
    entries,
    tiers: bundle.tiers,
    assignments: bundle.assignments,
    usernames: bundle.usernames,
    filters: bundle.filters,
    deletedIds: bundle.deletedIds,
    hiddenEntries: bundle.hiddenEntries,
    isLoading: false,
    loadProgress: null,
    error: null,
  };
}
