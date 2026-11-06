import type { AniListMediaNode, AnimeEntry, ListKey } from '../api/types';

/**
 * Merges one AniList media node from `username`'s `list` (e.g. "ANIME:COMPLETED")
 * into `existing` (undefined if this anime hasn't been seen before). Same
 * reference-preservation contract as `mergeCharacterNode`.
 */
export function mergeAnimeNode(
  existing: AnimeEntry | undefined,
  username: string,
  list: ListKey,
  node: AniListMediaNode
): AnimeEntry {
  if (!existing) {
    return {
      id: node.id,
      title: node.title,
      image: node.coverImage,
      averageScore: node.averageScore,
      episodes: node.episodes,
      genres: node.genres,
      favourites: node.favourites ?? 0,
      sourceUsernames: [username],
      lists: [list],
      listsByUser: { [username]: [list] },
    };
  }

  const favourites = Math.max(existing.favourites, node.favourites ?? 0);
  const hasUsername = existing.sourceUsernames.includes(username);
  const hasList = existing.lists.includes(list);
  const hasUserList = existing.listsByUser[username]?.includes(list) ?? false;

  if (favourites === existing.favourites && hasUsername && hasList && hasUserList) {
    return existing;
  }

  return {
    ...existing,
    favourites,
    sourceUsernames: hasUsername ? existing.sourceUsernames : [...existing.sourceUsernames, username],
    lists: hasList ? existing.lists : [...existing.lists, list],
    listsByUser: {
      ...existing.listsByUser,
      [username]: hasUserList ? existing.listsByUser[username] : [...(existing.listsByUser[username] ?? []), list],
    },
  };
}
