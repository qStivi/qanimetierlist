export interface AniListCharacterNode {
  id: number;
  name: { full: string };
  image: { large: string; medium: string };
  favourites: number | null;
  gender: string | null;
}

/** Which kind of AniList entity the tier list ranks. */
export type EntityMode = 'characters' | 'anime';

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
  /** `medium` is absent on characters saved before it was requested. */
  image: { large: string; medium?: string };
  favourites: number;
  gender: string | null;
  /** AniList usernames whose favourites list this character was found in. */
  sourceUsernames: string[];
  /** Every (media type, list status) pair this character was found under. */
  lists: ListKey[];
}

export interface AniListMediaNode {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string; medium: string };
  averageScore: number | null;
  episodes: number | null;
  genres: string[];
  favourites: number | null;
}

/** A ranked anime (media entry), normalized the way `Character` is for characters. */
export interface AnimeEntry {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  image: { large: string; medium?: string };
  averageScore: number | null;
  episodes: number | null;
  genres: string[];
  favourites: number;
  sourceUsernames: string[];
  lists: ListKey[];
}

export interface AnimeFilters {
  /** AniList averageScore is 0-100; entries below this are hidden. */
  minScore: number;
  /** List statuses to load and show anime from; never empty. */
  statuses: ListStatus[];
  /** Usernames to show entries from; empty means no user filter (show all). */
  usernames: string[];
}

/** Any rankable entry: a character in characters mode, an anime in anime mode. */
export type Entry = Character | AnimeEntry;

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
  /** Usernames to show entries from; empty means no user filter (show all). */
  usernames: string[];
}
