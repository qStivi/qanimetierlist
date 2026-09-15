import type { AniListCharacterNode } from './types';

// AniList's GraphQL API is public/unauthenticated for this app's needs (reading
// a user's favourite characters requires no login). Direct browser calls to
// https://graphql.anilist.co are CORS-allowed, so no backend proxy is needed.
// If that ever changes, set VITE_ANILIST_API_URL to a proxy path (see
// vite.config.ts for a dev-proxy example) instead of editing this constant.
const API_URL = import.meta.env.VITE_ANILIST_API_URL || 'https://graphql.anilist.co';

const PER_PAGE = 25; // AniList's max page size

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

const FAVOURITE_CHARACTERS_QUERY = `
  query ($name: String, $page: Int, $perPage: Int) {
    User(name: $name) {
      id
      name
      favourites {
        characters(page: $page, perPage: $perPage) {
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
`;

interface FavouriteCharactersResponse {
  User: {
    id: number;
    name: string;
    favourites: {
      characters: {
        pageInfo: { hasNextPage: boolean };
        nodes: AniListCharacterNode[];
      };
    };
  } | null;
}

/**
 * Fetches the complete list of a user's favourite characters, paginating
 * until exhausted. AniList has no server-side filter for gender or a
 * favourites-count threshold, so the full list must be fetched and filtered
 * client-side (see utils/filterCharacters.ts).
 */
export async function getAllFavouriteCharacters(username: string): Promise<AniListCharacterNode[]> {
  const all: AniListCharacterNode[] = [];
  let page = 1;

  while (true) {
    const data = await graphqlRequest<FavouriteCharactersResponse>(FAVOURITE_CHARACTERS_QUERY, {
      name: username,
      page,
      perPage: PER_PAGE,
    });

    if (!data.User) {
      throw new Error(`AniList user "${username}" not found`);
    }

    const { nodes, pageInfo } = data.User.favourites.characters;
    all.push(...nodes);

    if (!pageInfo.hasNextPage) break;
    page++;
  }

  return all;
}
