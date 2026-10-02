export interface AniListCharacterNode {
  id: number;
  name: { full: string };
  image: { large: string };
  favourites: number | null;
  gender: string | null;
}

export type MediaType = 'ANIME' | 'MANGA';

/**
 * AniList's MediaListStatus enum is shared by anime and manga lists — CURRENT
 * is "Watching" on an anime list and "Reading" on a manga list, REPEATING is
 * "Rewatching"/"Rereading" — so one set of values maps both media types.
 */
export type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

/** A `${MediaType}:${ListStatus}` pair, e.g. "MANGA:CURRENT". */
export type ListKey = `${MediaType}:${ListStatus}`;

export interface Character {
  id: number;
  name: { full: string };
  image: { large: string };
  favourites: number;
  gender: string | null;
  /** AniList usernames whose favourites list this character was found in. */
  sourceUsernames: string[];
  /** Every (media type, list status) pair this character was found under. */
  lists: ListKey[];
}

export interface Tier {
  /** Stable id — never changes, even when the tier is renamed. */
  id: string;
  label: string;
  color?: string;
}

export interface CharacterFilters {
  minFavourites: number;
  /** Genders to include; empty means no gender filter (show every gender). */
  genders: string[];
  /** Media lists to load and show characters from; never empty. */
  mediaTypes: MediaType[];
  /** List statuses to load and show characters from; never empty. */
  statuses: ListStatus[];
}
