import type { AniListMediaNode, AnimeEntry, AnimeFilters, ListKey } from '../api/types';
import { getAllListedAnime } from '../api/anilist';
import type { EntryAdapter, FetchSelection } from './types';
import type { FetchProgress } from '../api/anilist';
import { DEFAULT_ANIME_FILTERS, filterAnime, normalizeAnimeFilters } from '../utils/filterAnime';
import { mergeAnimeNode } from '../utils/animeUtils';

export type AnimeAdapter = EntryAdapter<AniListMediaNode, AnimeEntry, AnimeFilters>;

export const animeAdapter: AnimeAdapter = {
  fetchEntries(
    username: string,
    selection: FetchSelection,
    threshold: number,
    onProgress?: (progress: FetchProgress) => void,
    onBatch?: (nodes: AniListMediaNode[], list: ListKey) => void
  ): Promise<AniListMediaNode[]> {
    return getAllListedAnime(username, selection, threshold, onProgress, onBatch);
  },
  mergeNode: mergeAnimeNode,
  filterEntries: filterAnime,
  normalizeFilters: normalizeAnimeFilters,
  defaultFilters: DEFAULT_ANIME_FILTERS,
  getEntryName: entry => entry.title.english ?? entry.title.romaji,
  getEntryImage: entry => entry.image.large,
  getEntryUrl: entry => `https://anilist.co/anime/${entry.id}`,
  thresholdFromFilters: () => 0,
};
