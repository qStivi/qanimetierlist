import type { AniListCharacterNode, Character } from '../api/types';

export interface FetchedForUser {
  username: string;
  characters: AniListCharacterNode[];
}

/**
 * Merges the favourite-character lists of multiple AniList users into one
 * deduplicated list, tracking which usernames favourited each character.
 */
export function dedupeCharacters(fetched: FetchedForUser[]): Character[] {
  const map = new Map<number, Character>();

  for (const { username, characters } of fetched) {
    for (const c of characters) {
      const existing = map.get(c.id);
      if (existing) {
        if (!existing.sourceUsernames.includes(username)) {
          existing.sourceUsernames.push(username);
        }
        existing.favourites = Math.max(existing.favourites, c.favourites ?? 0);
      } else {
        map.set(c.id, {
          id: c.id,
          name: c.name,
          image: c.image,
          favourites: c.favourites ?? 0,
          gender: c.gender,
          sourceUsernames: [username],
        });
      }
    }
  }

  return Array.from(map.values());
}
