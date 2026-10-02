import type { Character, ListKey, ListStatus, MediaType } from '../api/types';

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

/** True if the character was found under at least one selected media type + status combination. */
export function matchesLists(character: Character, mediaTypes: MediaType[], statuses: ListStatus[]): boolean {
  return character.lists.some(key => {
    const [type, status] = key.split(':') as [MediaType, ListStatus];
    return mediaTypes.includes(type) && statuses.includes(status);
  });
}
