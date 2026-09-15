export interface AniListCharacterNode {
  id: number;
  name: { full: string };
  image: { large: string };
  favourites: number | null;
  gender: string | null;
}

export interface Character {
  id: number;
  name: { full: string };
  image: { large: string };
  favourites: number;
  gender: string | null;
  /** AniList usernames whose favourites list this character was found in. */
  sourceUsernames: string[];
}

export interface Tier {
  /** Stable id — never changes, even when the tier is renamed. */
  id: string;
  label: string;
  color?: string;
}

export interface CharacterFilters {
  minFavourites: number;
  /** A gender string observed on AniList, or 'ANY' to disable the filter. */
  gender: string | 'ANY';
}
