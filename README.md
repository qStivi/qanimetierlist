# qanimetierlist

A drag-and-drop tier list maker (S/A/B/C/D/E/F, renameable) for AniList characters.

Pull one or more AniList usernames' favourite characters, filter by minimum favourites
count and/or gender, and drag them into tiers. Tier list state, filters, and usernames
persist to `localStorage` — nothing is sent to a backend, and there is no login.

## How it works

- AniList's public GraphQL API (`https://graphql.anilist.co`) is queried directly from
  the browser — reading a user's favourite characters requires no authentication, and
  the endpoint allows CORS from any origin.
- AniList has no server-side filter for gender or a favourites-count threshold (only
  pagination and sort-by-favourites), so each username's full favourites list is fetched
  (paginated, 25/request) and filtered client-side. A shared rate limiter keeps requests
  under AniList's 30 req/min cap.
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
