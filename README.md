# qanimetierlist

A drag-and-drop tier list maker (S/A/B/C/D/E/F, renameable) for AniList characters.

Pull the full character cast of every anime one or more AniList usernames have marked
**Completed**, filter by minimum favourites count and/or gender, and drag them into
tiers. Tier list state, filters, and usernames persist to `localStorage` — nothing is
sent to a backend, and there is no login.

## How it works

- AniList's public GraphQL API (`https://graphql.anilist.co`) is queried directly from
  the browser — reading a user's completed anime list and its characters requires no
  authentication, and the endpoint allows CORS from any origin.
- Each username's completed anime list (`MediaListCollection`, paginated in chunks) is
  fetched with each entry's cast nested in the same query, so it's one request per
  chunk of anime rather than one per anime. The rare anime whose cast exceeds one
  character page (25) gets its remaining pages fetched individually. A shared rate
  limiter keeps requests under AniList's 30 req/min cap.
- AniList has no server-side filter for gender or a favourites-count threshold (only
  pagination and sort-by-favourites), so the full character list is filtered client-side.
- Each character card shows only its image, name (`name.full`), and favourites count.

## Development

```bash
npm install
npm run dev
```

```bash
npm run build   # tsc -b && vite build
npm run lint
```
