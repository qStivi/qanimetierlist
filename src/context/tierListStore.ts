import { createContext, type Dispatch } from 'react';
import type { Character, CharacterFilters, Tier } from '../api/types';
import { filterCharacters, DEFAULT_FILTERS } from '../utils/filterCharacters';

export interface TierListState {
  /** Every character fetched so far, unfiltered. */
  allCharacters: Character[];
  /** allCharacters after the current filters are applied — what's actually shown. */
  characters: Character[];
  tiers: Tier[];
  /** characterId -> tierId, or null for the unranked pool. */
  assignments: Record<number, string | null>;
  usernames: string[];
  filters: CharacterFilters;
  isLoading: boolean;
  error: string | null;
}

export type TierListAction =
  | { type: 'FETCH_START'; usernames: string[] }
  | { type: 'FETCH_SUCCESS'; characters: Character[] }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: CharacterFilters }
  | { type: 'MOVE_CHARACTER'; characterId: number; tierId: string | null }
  | { type: 'RENAME_TIER'; tierId: string; label: string }
  | { type: 'REORDER_TIER_CONTENTS'; tierKey: string | null; orderedIds: number[] };

const TIERS_KEY = 'tierlist_tiers';
const ASSIGNMENTS_KEY = 'tierlist_assignments';
const USERNAMES_KEY = 'tierlist_usernames';
const FILTERS_KEY = 'tierlist_filters';
const CHARACTERS_CACHE_KEY = 'tierlist_characters_cache';
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

export function tierListReducer(state: TierListState, action: TierListAction): TierListState {
  switch (action.type) {
    case 'FETCH_START':
      saveJSON(USERNAMES_KEY, action.usernames);
      return { ...state, usernames: action.usernames, isLoading: true, error: null };

    case 'FETCH_SUCCESS': {
      const assignments = { ...state.assignments };
      for (const c of action.characters) {
        if (!(c.id in assignments)) assignments[c.id] = null;
      }
      const characters = filterCharacters(action.characters, state.filters);
      saveJSON(CHARACTERS_CACHE_KEY, action.characters);
      saveJSON(ASSIGNMENTS_KEY, assignments);
      return {
        ...state,
        allCharacters: action.characters,
        characters: applySavedOrder(characters, assignments),
        assignments,
        isLoading: false,
        error: null,
      };
    }

    case 'FETCH_ERROR':
      return { ...state, isLoading: false, error: action.error };

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

    case 'RENAME_TIER': {
      const tiers = state.tiers.map(t => (t.id === action.tierId ? { ...t, label: action.label } : t));
      saveJSON(TIERS_KEY, tiers);
      return { ...state, tiers };
    }

    default:
      return state;
  }
}

export function initTierListState(): TierListState {
  const tiers = loadJSON<Tier[]>(TIERS_KEY, DEFAULT_TIERS);
  const assignments = loadJSON<Record<number, string | null>>(ASSIGNMENTS_KEY, {});
  const usernames = loadJSON<string[]>(USERNAMES_KEY, []);
  const filters = loadJSON<CharacterFilters>(FILTERS_KEY, DEFAULT_FILTERS);
  const allCharacters = loadJSON<Character[]>(CHARACTERS_CACHE_KEY, []);
  const characters = applySavedOrder(filterCharacters(allCharacters, filters), assignments);

  return {
    allCharacters,
    characters,
    tiers,
    assignments,
    usernames,
    filters,
    isLoading: false,
    error: null,
  };
}

export interface TierListContextType {
  state: TierListState;
  dispatch: Dispatch<TierListAction>;
}

export const TierListContext = createContext<TierListContextType | null>(null);
