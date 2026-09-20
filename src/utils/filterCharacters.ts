import type { Character, CharacterFilters } from '../api/types';

export const DEFAULT_FILTERS: CharacterFilters = {
  minFavourites: 0,
  genders: [],
};

/**
 * Sentinel placed in `filters.genders` to mean "gender is null on AniList",
 * distinct enough from any real gender string a curator could plausibly
 * enter that a collision is not a practical concern.
 */
export const UNKNOWN_GENDER = '__unknown__';

/**
 * `genders` may come back non-array (or missing) from stale localStorage
 * written by an older single-select version of this filter, so any loaded
 * filters must be passed through this before landing in state.
 */
export function normalizeFilters(filters: Partial<CharacterFilters> | null | undefined): CharacterFilters {
  return {
    minFavourites: typeof filters?.minFavourites === 'number' ? filters.minFavourites : DEFAULT_FILTERS.minFavourites,
    genders: Array.isArray(filters?.genders) ? filters.genders : DEFAULT_FILTERS.genders,
  };
}

/**
 * AniList has no server-side filter for gender or a favourites-count
 * threshold (only pagination/sort exist), so this runs client-side after
 * a character list has already been fetched in full.
 */
export function filterCharacters(chars: Character[], filters: CharacterFilters): Character[] {
  return chars.filter(c => {
    if (c.favourites < filters.minFavourites) return false;
    if (filters.genders.length === 0) return true;
    return c.gender === null ? filters.genders.includes(UNKNOWN_GENDER) : filters.genders.includes(c.gender);
  });
}

/**
 * AniList's `gender` field is free text, not a closed enum, so the filter
 * dropdown is populated from whatever values actually showed up — plus
 * UNKNOWN_GENDER, appended last, whenever at least one loaded character has
 * no gender set at all.
 */
export function getObservedGenders(chars: Character[]): string[] {
  const real = Array.from(new Set(chars.map(c => c.gender).filter((g): g is string => !!g))).sort();
  return chars.some(c => c.gender === null) ? [...real, UNKNOWN_GENDER] : real;
}
