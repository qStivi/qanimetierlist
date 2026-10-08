import type { AniListCharacterNode, ListKey, ListStatus, MediaType } from './types';

// AniList's GraphQL API is public/unauthenticated for this app's needs (reading
// a user's anime/manga lists and their characters requires no login). Direct
// browser calls to https://graphql.anilist.co are CORS-allowed, so no backend
// proxy is needed. If that ever changes, set VITE_ANILIST_API_URL to a proxy
// path (see vite.config.ts for a dev-proxy example) instead of editing this constant.
const API_URL = import.meta.env.VITE_ANILIST_API_URL || 'https://graphql.anilist.co';

const PER_PAGE = 25; // AniList's max page size
// How many list entries to fetch per MediaListCollection request
// (its own "chunk"/"perChunk" pagination, separate from character pagination).
const MEDIA_PER_CHUNK = 50;

class RateLimiter {
  private requestTimes: number[] = [];
  // AniList's documented limit is 30 req/min, use 25 to be safe
  private readonly maxRequests = 25;
  private readonly windowMs = 60000; // 1 minute
  // Minimum delay between requests to avoid burst limiting
  private readonly minDelayMs = 2500;
  private lastRequestTime = 0;
  private rateLimitedUntil = 0;

  async throttle(): Promise<void> {
    const now = Date.now();

    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      console.log(`Rate limited, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs);

    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100;
      console.log(`Request limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.minDelayMs - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestTimes.push(this.lastRequestTime);
  }

  setRateLimited(retryAfterSeconds: number): void {
    this.rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
    this.requestTimes = [];
  }
}

const rateLimiter = new RateLimiter();

async function graphqlRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  await rateLimiter.throttle();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    console.log(`429 Too Many Requests - waiting ${retryAfter}s (from Retry-After header)`);
    rateLimiter.setRateLimited(retryAfter);
    return graphqlRequest(query, variables);
  }

  const data = await response.json();

  if (data.errors) {
    const message = data.errors.map((e: { message: string }) => e.message).join('; ');
    throw new Error(message || `AniList API request failed: ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`AniList API request failed: ${response.status}`);
  }

  return data.data;
}

// A cheap upfront query so progress/ETA has a known denominator before the
// (potentially many-request) character fetch below even starts.
const USER_LIST_COUNTS_QUERY = `
  query ($name: String) {
    User(name: $name) {
      id
      statistics {
        anime {
          statuses {
            status
            count
          }
        }
        manga {
          statuses {
            status
            count
          }
        }
      }
    }
  }
`;

interface StatusCount {
  status: string;
  count: number;
}

interface UserListCountsResponse {
  User: {
    statistics: {
      anime: { statuses: StatusCount[] };
      manga: { statuses: StatusCount[] };
    };
  } | null;
}

export interface ListSelection {
  mediaTypes: MediaType[];
  statuses: ListStatus[];
}

/** Every (media type, status) pair a selection covers, with how many list entries each has. */
async function getListCounts(
  username: string,
  selection: ListSelection
): Promise<Array<{ mediaType: MediaType; status: ListStatus; count: number }>> {
  const data = await graphqlRequest<UserListCountsResponse>(USER_LIST_COUNTS_QUERY, { name: username });

  if (!data.User) {
    throw new Error(`AniList user "${username}" not found`);
  }

  const { anime, manga } = data.User.statistics;
  const statusesByType: Record<MediaType, StatusCount[]> = { ANIME: anime.statuses, MANGA: manga.statuses };

  return selection.mediaTypes.flatMap(mediaType =>
    selection.statuses.map(status => ({
      mediaType,
      status,
      count: statusesByType[mediaType].find(s => s.status === status)?.count ?? 0,
    }))
  );
}

export interface FetchProgress {
  processedMedia: number;
  totalMedia: number;
  /** Estimated seconds remaining, or null until enough data has been seen to estimate. */
  etaSeconds: number | null;
}

// Characters are pulled straight from each list entry's cast, nested inside
// the MediaListCollection query, so we don't need one request per title. MediaListCollection is paginated with chunk/perChunk (its own
// pagination, separate from the nested `characters` connection below).
const LIST_CHARACTERS_QUERY = `
  query ($name: String, $type: MediaType, $status: MediaListStatus, $chunk: Int, $perChunk: Int, $charPerPage: Int) {
    MediaListCollection(userName: $name, type: $type, status: $status, chunk: $chunk, perChunk: $perChunk) {
      hasNextChunk
      lists {
        entries {
          media {
            id
            characters(page: 1, perPage: $charPerPage, sort: [FAVOURITES_DESC]) {
              pageInfo {
                hasNextPage
              }
              nodes {
                id
                name {
                  full
                }
                image {
                  large
                  medium
                }
                favourites
                gender
              }
            }
          }
        }
      }
    }
  }
`;

interface ListCharactersResponse {
  MediaListCollection: {
    hasNextChunk: boolean | null;
    lists: Array<{
      entries: Array<{
        media: {
          id: number;
          characters: {
            pageInfo: { hasNextPage: boolean };
            nodes: AniListCharacterNode[];
          };
        };
      }>;
    }>;
  } | null;
}

// Fallback for the (rare) title with a cast larger than one character page —
// fetched per-media so the bulk query above doesn't have to over-fetch for
// every anime just to cover a few outliers.
const MEDIA_CHARACTERS_PAGE_QUERY = `
  query ($mediaId: Int, $page: Int, $perPage: Int) {
    Media(id: $mediaId) {
      characters(page: $page, perPage: $perPage, sort: [FAVOURITES_DESC]) {
        pageInfo {
          hasNextPage
        }
        nodes {
          id
          name {
            full
          }
          image {
            large
            medium
          }
          favourites
          gender
        }
      }
    }
  }
`;

interface MediaCharactersPageResponse {
  Media: {
    characters: {
      pageInfo: { hasNextPage: boolean };
      nodes: AniListCharacterNode[];
    };
  };
}

function lastFavourites(nodes: AniListCharacterNode[]): number {
  return nodes.length > 0 ? (nodes[nodes.length - 1].favourites ?? 0) : 0;
}

/**
 * Fetches overflow character pages (2+) for one title, sorted FAVOURITES_DESC.
 * Stops as soon as a page's last (i.e. lowest-favourited) node drops below
 * `minFavouritesThreshold` — everything after it, on this page and any
 * further one, is guaranteed to be equal or lower, so it would never pass
 * the matching client-side `minFavourites` filter anyway.
 */
async function getRemainingMediaCharacters(
  mediaId: number,
  startPage: number,
  minFavouritesThreshold: number
): Promise<AniListCharacterNode[]> {
  const all: AniListCharacterNode[] = [];
  let page = startPage;

  while (true) {
    const data = await graphqlRequest<MediaCharactersPageResponse>(MEDIA_CHARACTERS_PAGE_QUERY, {
      mediaId,
      page,
      perPage: PER_PAGE,
    });

    const { nodes, pageInfo } = data.Media.characters;
    all.push(...nodes);

    if (!pageInfo.hasNextPage || lastFavourites(nodes) < minFavouritesThreshold) break;
    page++;
  }

  return all;
}

/**
 * Fetches every character appearing in every title on the selected lists of a
 * user — each chosen media type (anime/manga) crossed with each chosen list
 * status — paginating each list until exhausted. Most titles fit their full
 * cast in one character page; the rare one that doesn't gets its remaining
 * pages fetched individually via getRemainingMediaCharacters.
 *
 * `onProgress` is called once up front (before any title is processed, so a
 * progress UI has a total to show immediately) and again after each title.
 * The ETA is derived from the actual average time-per-title seen so far
 * rather than a fixed estimate, so it self-corrects for rate-limit waits and
 * the occasional slower multi-page title.
 *
 * `onBatch` is called once per title, right after `onProgress`, with that
 * title's cast and the list it came from, so a caller can render results
 * incrementally instead of waiting for the full list. A network response
 * covers up to a whole chunk of titles at once, so this also yields to the
 * event loop between titles — without that, everything from one response
 * would land in a single React render regardless of how many times onBatch
 * fired.
 *
 * `minFavouritesThreshold` prunes fetching, not just display: each title's
 * cast is fetched sorted FAVOURITES_DESC, and pagination for that title stops
 * (even on page 1 — no page 2 request at all) as soon as the last node seen
 * drops below the threshold, since everything past it is guaranteed to be
 * equal or lower and would be filtered out client-side anyway. Pass `0` (the
 * default `minFavourites` filter value) to fetch every character, since
 * favourites can never be negative and the cutoff can then never trigger.
 */
export async function getAllListedCharacters(
  username: string,
  selection: ListSelection,
  minFavouritesThreshold: number,
  onProgress?: (progress: FetchProgress) => void,
  onBatch?: (characters: AniListCharacterNode[], list: ListKey) => void
): Promise<AniListCharacterNode[]> {
  const listCounts = await getListCounts(username, selection);
  const totalMedia = listCounts.reduce((sum, l) => sum + l.count, 0);
  if (totalMedia === 0) {
    throw new Error(`AniList user "${username}" has no entries on the selected lists`);
  }

  const all: AniListCharacterNode[] = [];
  const startTime = Date.now();
  let processedMedia = 0;

  const reportProgress = () => {
    if (!onProgress) return;
    const elapsedMs = Date.now() - startTime;
    const avgMsPerMedia = processedMedia > 0 ? elapsedMs / processedMedia : null;
    const remaining = Math.max(totalMedia - processedMedia, 0);
    const etaSeconds = avgMsPerMedia !== null ? Math.round((avgMsPerMedia * remaining) / 1000) : null;
    // The upfront count is a statistic that can lag the live list slightly;
    // never let the bar overflow if it undercounted.
    onProgress({ processedMedia, totalMedia: Math.max(totalMedia, processedMedia), etaSeconds });
  };

  reportProgress();

  for (const { mediaType, status, count } of listCounts) {
    if (count === 0) continue;

    const list: ListKey = `${mediaType}:${status}`;
    // A status-filtered collection can still return the same entry under more
    // than one list (a custom list as well as the status list); count and
    // emit each title once.
    const seenMediaIds = new Set<number>();
    let chunk = 1;

    while (true) {
      const data = await graphqlRequest<ListCharactersResponse>(LIST_CHARACTERS_QUERY, {
        name: username,
        type: mediaType,
        status,
        chunk,
        perChunk: MEDIA_PER_CHUNK,
        charPerPage: PER_PAGE,
      });

      if (!data.MediaListCollection) {
        throw new Error(`AniList user "${username}" not found`);
      }

      for (const entryList of data.MediaListCollection.lists) {
        for (const entry of entryList.entries) {
          const { id: mediaId, characters } = entry.media;
          if (seenMediaIds.has(mediaId)) continue;
          seenMediaIds.add(mediaId);

          const mediaCharacters = [...characters.nodes];

          if (characters.pageInfo.hasNextPage && lastFavourites(characters.nodes) >= minFavouritesThreshold) {
            mediaCharacters.push(...(await getRemainingMediaCharacters(mediaId, 2, minFavouritesThreshold)));
          }

          all.push(...mediaCharacters);
          onBatch?.(mediaCharacters, list);

          processedMedia++;
          reportProgress();

          // A whole chunk's titles arrive in one network response, so without
          // this the entries loop runs synchronously and React batches every
          // dispatch from it into a single render anyway — it would look
          // identical to one chunk-sized jump. Yielding here lets the browser
          // actually paint between titles.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      if (!data.MediaListCollection.hasNextChunk) break;
      chunk++;
    }
  }

  return all;
}
