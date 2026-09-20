import type { AniListCharacterNode, Character } from '../api/types';

/**
 * Merges one AniList character node from `username`'s completed-anime cast
 * into `existing` (undefined if this character hasn't been seen before).
 *
 * Returns the *same* object reference when nothing actually changed, and a
 * new one only when something did (a new source username, or a higher
 * favourites count). This matters because `CharacterCard` is `React.memo`'d
 * on the `character` prop — during a streaming fetch this runs once per
 * character per batch, and most calls are no-ops (a character already seen
 * with no new information), so preserving reference equality keeps hundreds
 * of unrelated cards from re-rendering on every batch.
 */
export function mergeCharacterNode(
  existing: Character | undefined,
  username: string,
  node: AniListCharacterNode
): Character {
  if (!existing) {
    return {
      id: node.id,
      name: node.name,
      image: node.image,
      favourites: node.favourites ?? 0,
      gender: node.gender,
      sourceUsernames: [username],
    };
  }

  const favourites = Math.max(existing.favourites, node.favourites ?? 0);
  const hasUsername = existing.sourceUsernames.includes(username);

  if (favourites === existing.favourites && hasUsername) {
    return existing;
  }

  return {
    ...existing,
    favourites,
    sourceUsernames: hasUsername ? existing.sourceUsernames : [...existing.sourceUsernames, username],
  };
}
