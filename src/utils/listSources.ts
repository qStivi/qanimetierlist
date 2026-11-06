import type { ListKey, ListStatus, MediaType } from '../api/types';

export const MEDIA_TYPES: MediaType[] = ['ANIME', 'MANGA'];

export const LIST_STATUSES: ListStatus[] = ['COMPLETED', 'CURRENT', 'REPEATING', 'PAUSED', 'DROPPED', 'PLANNING'];

/** What a list status is called on an anime list vs. a manga list. */
const STATUS_LABELS: Record<ListStatus, Record<MediaType, string>> = {
  COMPLETED: { ANIME: 'Completed', MANGA: 'Completed' },
  CURRENT: { ANIME: 'Watching', MANGA: 'Reading' },
  REPEATING: { ANIME: 'Rewatching', MANGA: 'Rereading' },
  PAUSED: { ANIME: 'Paused', MANGA: 'Paused' },
  DROPPED: { ANIME: 'Dropped', MANGA: 'Dropped' },
  PLANNING: { ANIME: 'Planning', MANGA: 'Planning' },
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = { ANIME: 'Anime', MANGA: 'Manga' };

/**
 * Label for a status given the media types currently selected, so the shared
 * statuses read naturally: "Watching" for anime only, "Reading" for manga
 * only, "Watching / Reading" for both.
 */
export function statusLabel(status: ListStatus, mediaTypes: MediaType[]): string {
  const labels = MEDIA_TYPES.filter(t => mediaTypes.includes(t)).map(t => STATUS_LABELS[status][t]);
  return Array.from(new Set(labels)).join(' / ');
}

export function listKey(mediaType: MediaType, status: ListStatus): ListKey {
  return `${mediaType}:${status}`;
}

/** Characters cached before manga/status support all came from completed anime. */
export const LEGACY_LISTS: ListKey[] = ['ANIME:COMPLETED'];

interface ListMembership {
  lists: ListKey[];
  listsByUser?: Record<string, ListKey[]>;
}

function keyMatches(key: ListKey, mediaTypes: MediaType[], statuses: ListStatus[]): boolean {
  const [type, status] = key.split(':') as [MediaType, ListStatus];
  return mediaTypes.includes(type) && statuses.includes(status);
}

/**
 * True if the entry was found under at least one selected media type + status
 * combination. When `usernames` is non-empty, only the list memberships of
 * those users count — an entry that is COMPLETED for user A but PLANNING for
 * user B must not match a "user A + Planning" filter just because B's planning
 * put ANIME:PLANNING in the global `lists`. Entries without per-user data
 * (legacy cache/exports) fall back to the global `lists` for every user.
 */
export function matchesLists(
  entry: ListMembership,
  mediaTypes: MediaType[],
  statuses: ListStatus[],
  usernames: string[] = []
): boolean {
  if (usernames.length === 0) {
    return entry.lists.some(key => keyMatches(key, mediaTypes, statuses));
  }
  return usernames.some(u => (entry.listsByUser?.[u] ?? entry.lists).some(key => keyMatches(key, mediaTypes, statuses)));
}
