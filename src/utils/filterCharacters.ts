import type { Character, CharacterFilters } from '../api/types';

export const DEFAULT_FILTERS: CharacterFilters = {
  minFavourites: 0,
  gender: 'ANY',
};

/**
 * AniList has no server-side filter for gender or a favourites-count
 * threshold (only pagination/sort exist), so this runs client-side after
 * a character list has already been fetched in full.
 */
export function filterCharacters(chars: Character[], filters: CharacterFilters): Character[] {
  return chars.filter(
    c =>
      c.favourites >= filters.minFavourites &&
      (filters.gender === 'ANY' || c.gender === filters.gender)
  );
}

/**
 * AniList's `gender` field is free text, not a closed enum, so the filter
 * dropdown is populated from whatever values actually showed up.
 */
export function getObservedGenders(chars: Character[]): string[] {
  return Array.from(new Set(chars.map(c => c.gender).filter((g): g is string => !!g))).sort();
}
