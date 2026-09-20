import type { AniListCharacterNode } from './types';

// AniList's GraphQL API is public/unauthenticated for this app's needs (reading
// a user's completed anime list and its characters requires no login). Direct
// browser calls to https://graphql.anilist.co are CORS-allowed, so no backend
// proxy is needed. If that ever changes, set VITE_ANILIST_API_URL to a proxy
// path (see vite.config.ts for a dev-proxy example) instead of editing this constant.
const API_URL = import.meta.env.VITE_ANILIST_API_URL || 'https://graphql.anilist.co';

const PER_PAGE = 25; // AniList's max page size
// How many completed-anime entries to fetch per MediaListCollection request
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
const USER_COMPLETED_ANIME_COUNT_QUERY = `
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
      }
    }
  }
`;

interface UserCompletedAnimeCountResponse {
  User: {
    statistics: {
      anime: {
        statuses: Array<{ status: string; count: number }>;
      };
    };
  } | null;
}

async function getCompletedAnimeCount(username: string): Promise<number> {
  const data = await graphqlRequest<UserCompletedAnimeCountResponse>(USER_COMPLETED_ANIME_COUNT_QUERY, {
    name: username,
  });

  if (!data.User) {
    throw new Error(`AniList user "${username}" not found`);
  }

  const completed = data.User.statistics.anime.statuses.find(s => s.status === 'COMPLETED');
  return completed?.count ?? 0;
}

export interface FetchProgress {
  processedAnime: number;
  totalAnime: number;
  /** Estimated seconds remaining, or null until enough data has been seen to estimate. */
  etaSeconds: number | null;
}

// Characters are pulled straight from each completed anime's cast, nested
// inside the MediaListCollection query, so we don't need one request per
// anime. MediaListCollection is paginated with chunk/perChunk (its own
// pagination, separate from the nested `characters` connection below).
const FINISHED_ANIME_CHARACTERS_QUERY = `
  query ($name: String, $chunk: Int, $perChunk: Int, $charPerPage: Int) {
    MediaListCollection(userName: $name, type: ANIME, status: COMPLETED, chunk: $chunk, perChunk: $perChunk) {
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

interface FinishedAnimeCharactersResponse {
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

// Fallback for the (rare) anime with a cast larger than one character page —
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
 * Fetches overflow character pages (2+) for one anime, sorted FAVOURITES_DESC.
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
 * Fetches every character appearing in every anime on a user's completed
 * list, paginating the anime list itself until exhausted. Most anime fit
 * their full cast in one character page; the rare one that doesn't gets its
 * remaining pages fetched individually via getRemainingMediaCharacters.
 *
 * `onProgress` is called once up front (before any anime is processed, so a
 * progress UI has a total to show immediately) and again after each anime.
 * The ETA is derived from the actual average time-per-anime seen so far
 * rather than a fixed estimate, so it self-corrects for rate-limit waits and
 * the occasional slower multi-page anime.
 *
 * `onBatch` is called once per anime, right after `onProgress`, with that
 * anime's cast, so a caller can render results incrementally instead of
 * waiting for the full list. A network response covers up to a whole chunk
 * of anime at once, so this also yields to the event loop between anime —
 * without that, everything from one response would land in a single React
 * render regardless of how many times onBatch fired.
 *
 * `minFavouritesThreshold` prunes fetching, not just display: each anime's
 * cast is fetched sorted FAVOURITES_DESC, and pagination for that anime stops
 * (even on page 1 — no page 2 request at all) as soon as the last node seen
 * drops below the threshold, since everything past it is guaranteed to be
 * equal or lower and would be filtered out client-side anyway. Pass `0` (the
 * default `minFavourites` filter value) to fetch every character, since
 * favourites can never be negative and the cutoff can then never trigger.
 */
export async function getAllFinishedCharacters(
  username: string,
  minFavouritesThreshold: number,
  onProgress?: (progress: FetchProgress) => void,
  onBatch?: (characters: AniListCharacterNode[]) => void
): Promise<AniListCharacterNode[]> {
  const totalAnime = await getCompletedAnimeCount(username);
  if (totalAnime === 0) {
    throw new Error(`AniList user "${username}" has no completed anime`);
  }

  const all: AniListCharacterNode[] = [];
  const startTime = Date.now();
  let processedAnime = 0;
  let chunk = 1;

  const reportProgress = () => {
    if (!onProgress) return;
    const elapsedMs = Date.now() - startTime;
    const avgMsPerAnime = processedAnime > 0 ? elapsedMs / processedAnime : null;
    const remaining = Math.max(totalAnime - processedAnime, 0);
    const etaSeconds = avgMsPerAnime !== null ? Math.round((avgMsPerAnime * remaining) / 1000) : null;
    onProgress({ processedAnime, totalAnime, etaSeconds });
  };

  reportProgress();

  while (true) {
    const data = await graphqlRequest<FinishedAnimeCharactersResponse>(FINISHED_ANIME_CHARACTERS_QUERY, {
      name: username,
      chunk,
      perChunk: MEDIA_PER_CHUNK,
      charPerPage: PER_PAGE,
    });

    if (!data.MediaListCollection) {
      throw new Error(`AniList user "${username}" not found`);
    }

    for (const list of data.MediaListCollection.lists) {
      for (const entry of list.entries) {
        const { id: mediaId, characters } = entry.media;
        const animeCharacters = [...characters.nodes];

        if (characters.pageInfo.hasNextPage && lastFavourites(characters.nodes) >= minFavouritesThreshold) {
          animeCharacters.push(...(await getRemainingMediaCharacters(mediaId, 2, minFavouritesThreshold)));
        }

        all.push(...animeCharacters);
        onBatch?.(animeCharacters);

        processedAnime++;
        reportProgress();

        // A whole chunk's anime arrive in one network response, so without
        // this the entries loop runs synchronously and React batches every
        // dispatch from it into a single render anyway — it would look
        // identical to one chunk-sized jump. Yielding here lets the browser
        // actually paint between anime.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (!data.MediaListCollection.hasNextChunk) break;
    chunk++;
  }

  return all;
}
