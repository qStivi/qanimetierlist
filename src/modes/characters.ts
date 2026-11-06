import type { AniListCharacterNode, Character, CharacterFilters, ListKey } from '../api/types';
import { getAllListedCharacters } from '../api/anilist';
import type { EntryAdapter, FetchSelection } from './types';
import type { FetchProgress } from '../api/anilist';
import { DEFAULT_FILTERS, filterCharacters, normalizeFilters } from '../utils/filterCharacters';
import { mergeCharacterNode } from '../utils/characterUtils';

export type CharacterAdapter = EntryAdapter<AniListCharacterNode, Character, CharacterFilters>;

/** The existing behavior, unchanged, now expressed through the mode adapter interface. */
export const characterAdapter: CharacterAdapter = {
  fetchEntries(
    username: string,
    selection: FetchSelection,
    threshold: number,
    onProgress?: (progress: FetchProgress) => void,
    onBatch?: (nodes: AniListCharacterNode[], list: ListKey) => void
  ): Promise<AniListCharacterNode[]> {
    return getAllListedCharacters(username, selection, threshold, onProgress, onBatch);
  },
  mergeNode: mergeCharacterNode,
  filterEntries: filterCharacters,
  normalizeFilters,
  defaultFilters: DEFAULT_FILTERS,
  getEntryName: entry => entry.name.full,
  getEntryImage: entry => entry.image.large,
  getEntryUrl: entry => `https://anilist.co/character/${entry.id}`,
  thresholdFromFilters: filters => filters.minFavourites,
};
