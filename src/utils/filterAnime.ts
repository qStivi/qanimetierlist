import type { AnimeEntry, AnimeFilters, ListStatus } from '../api/types';
import { LIST_STATUSES, matchesLists } from './listSources';

export const DEFAULT_ANIME_FILTERS: AnimeFilters = {
  minScore: 0,
  statuses: ['COMPLETED'],
  usernames: [],
};

/** Keeps only known statuses; falls back to the default if nothing valid remains (never empty). */
function validStatuses(value: unknown, fallback: ListStatus[]): ListStatus[] {
  const valid = Array.isArray(value) ? LIST_STATUSES.filter(s => value.includes(s)) : [];
  return valid.length > 0 ? valid : fallback;
}

export function normalizeAnimeFilters(filters: Partial<AnimeFilters> | null | undefined): AnimeFilters {
  return {
    minScore: typeof filters?.minScore === 'number' ? filters.minScore : DEFAULT_ANIME_FILTERS.minScore,
    statuses: validStatuses(filters?.statuses, DEFAULT_ANIME_FILTERS.statuses),
    usernames: Array.isArray(filters?.usernames) ? filters.usernames.filter(u => typeof u === 'string') : [],
  };
}

/**
 * AniList has no server-side score filter, so this runs client-side after the
 * list has been fetched in full. A null averageScore counts as 0.
 */
export function filterAnime(entries: AnimeEntry[], filters: AnimeFilters): AnimeEntry[] {
  return entries.filter(e => {
    if ((e.averageScore ?? 0) < filters.minScore) return false;
    if (!matchesLists(e, ['ANIME'], filters.statuses, filters.usernames)) return false;
    return filters.usernames.length === 0 || e.sourceUsernames.some(u => filters.usernames.includes(u));
  });
}
