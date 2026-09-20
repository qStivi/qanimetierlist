# qanimetierlist

A drag-and-drop tier list maker for AniList characters. This is an unofficial, fan-made
tool built with the public AniList GraphQL API — it is not affiliated with, endorsed by,
or built in partnership with AniList.

Pull the full character cast of every anime one or more AniList usernames have marked
**Completed**, filter and hide the ones you don't want, and drag the rest into custom
tiers (S/A/B/C/D/E/F by default — tiers can be renamed, recolored, reordered, added, and
removed). Everything lives in your browser's `localStorage`: there is no login, no
account, and no backend server of any kind.

## Features

- Streams in a user's entire completed-anime character cast with a live progress bar
  and ETA, instead of waiting for one giant fetch to finish.
- Filters by minimum favourites count and by gender (multi-select, including an
  explicit "Unknown" option for AniList's many null-gender characters).
- Manually hide characters you don't want to see again (persists across reloads and
  re-fetches), with undo, a browsable "Hidden" list to restore any of them later, and
  an ID-based un-hide path for characters hidden before that browsable list existed.
- Full tier management: rename, recolor, reorder, add, and remove tiers. A tier can't
  be removed while it still holds a character.
- A "Randomize" button to shuffle the unranked pool.
- Export your entire tier list (tiers, assignments, filters, hidden characters,
  ordering) to a JSON file, and import it back — validated before anything is written,
  so a bad file can't corrupt what you already have.

## How it works

**Architecture.** This is a static single-page app (Vite + React + TypeScript). There
is no server component at all — every request goes straight from your browser to
`https://graphql.anilist.co` (AniList's public GraphQL endpoint, which allows CORS from
any origin and requires no authentication for read-only public data). `localStorage` is
the only persistence layer; nothing is written anywhere else.

**Fetching a user's characters.**
- `MediaListCollection(status: COMPLETED)` returns a user's completed anime, paginated
  in chunks of 50 (`chunk`/`perChunk`) rather than one request per anime, with each
  anime's cast nested directly in the same query.
- Each anime's `characters` connection is sorted `FAVOURITES_DESC`. Combined with the
  "min. favourites" filter, fetching an anime's cast stops as soon as a page's *last*
  (lowest-favourited) character drops below that threshold — even skipping the request
  for page 2 entirely if page 1 already crosses it — since everything past that point
  is guaranteed to be equal-or-lower and would be filtered out client-side anyway. With
  the default filter (0) this never triggers, so every character is fetched.
- The rare anime whose cast exceeds one character page (25) gets its remaining pages
  fetched individually, with the same early-stop rule applied per page.
- Characters stream into the UI one anime at a time as they're fetched (not all at
  once at the end), each followed by a deliberate yield to the browser so the update is
  actually visible rather than getting batched into one large repaint.
- Re-fetching (e.g. clicking "Load Characters" again) only ever adds or updates
  characters — it never removes anything, so an interrupted or partially-failed
  re-fetch can't leave you with less than you started with. A character no longer
  actually completed on AniList won't be auto-pruned by this; use manual hide for that.

**Rate limiting.** A client-side limiter caps requests at 25/minute with a 2.5s minimum
gap between requests (AniList's documented limit is currently 30/minute — see
[Compliance](#anilist-api-terms-of-use-compliance) below), and backs off automatically
on a `429` response using the `Retry-After` header AniList returns.

**Filtering.** AniList's API has no server-side filter for gender or a
favourites-count threshold (only pagination and sort), so filtering happens client-side
against the already-fetched character list.

**Drag and drop** uses `@dnd-kit`. Cross-tier drags render through a `DragOverlay`
(portalled to `document.body`) rather than relying on each card's local CSS transform,
which otherwise renders behind other tier rows depending on DOM order. Droppable
containers are measured once per drag start (`MeasuringStrategy.BeforeDragging`) rather
than continuously, and layout-change animations are disabled on sortable items —
both were needed to avoid render-loop crashes under fast dragging or bulk reorders
(e.g. the Randomize button).

## Data & privacy

This app has no backend, so **the person operating/hosting it never sees your data** —
there is nothing for it to see. Concretely, once this is hosted somewhere public:

- Every AniList query and every character image request is made **directly by your own
  browser** to AniList's servers (`graphql.anilist.co` and AniList's image CDN) — not
  proxied through, or logged by, whatever serves this site's static files. AniList
  itself sees your request the same way it would if you queried its API yourself:
  your own IP address and standard HTTP request metadata, nothing more. Any AniList
  username you type in (yours or someone else's) is sent only to AniList, never to
  this app's host.
- Your tier list, filters, hidden characters, and cached character data live only in
  **your own browser's `localStorage`** — they are never transmitted anywhere by this
  app except back out to AniList to refresh them.
- Export produces a plain JSON file your browser downloads directly; import reads a
  file you choose. Neither is uploaded anywhere.
- There are no cookies, no analytics, no tracking scripts, and no third-party embeds
  of any kind in this codebase.
- Whatever actually serves the static files (a CDN, a web server, a homelab box) will
  of course have its own normal access logs (IP, timestamp, which files were
  requested) — that's routine static-site hosting, not something this app adds; it
  applies to literally any website and is worth disclosing to visitors regardless.
- **Adult content:** AniList's own data can include NSFW/adult character art (see their
  ["Considerations"](https://docs.anilist.co/guide/considerations) page — note in
  particular that AniList does not consider "Ecchi" to be adult content, which has
  caused issues with app-store and ad-network content policies before), and this app
  currently does no content filtering of its own. If hosting somewhere with app-store
  rules, ad networks, or a userbase that may include minors, add filtering or an age
  gate before doing so.

## AniList API Terms of Use compliance

This section documents this project's understanding of
[AniList's Terms of Use](https://docs.anilist.co/guide/terms-of-use),
[Considerations](https://docs.anilist.co/guide/considerations), and
[Rate Limiting](https://docs.anilist.co/guide/rate-limiting) pages, current as of
2026-09-20. **This is not legal advice** — it's this project's good-faith reasoning, not
a ruling from AniList. If this is ever hosted at meaningful public scale, AniList
explicitly invites developers to reach out directly (`contact@anilist.co`) for anything
ambiguous, and that's the only authoritative source of clarification.

**Clearly compliant:**
- *"Free for non-commercial usage."* This project doesn't monetize. (AniList also
  permits commercial use under $150/month revenue without needing permission; above
  that requires a commercial license — not applicable today, but relevant if that ever
  changes.)
- **Naming guidelines** — the name doesn't use "AniList" or "AniChart", so the
  "UNOFFICIAL" naming requirement doesn't technically apply, though the disclaimer at
  the top of this README exists anyway as good practice.
- **Rate limiting** — the client-side limiter (25 requests/minute, 2.5s minimum gap)
  stays under AniList's currently-degraded 30/minute cap (their normal limit is
  90/minute), and backs off on `429` per their documented `Retry-After` mechanism.

**Read and considered, not a certainty — worth AniList's own input if this scales up:**
- *"Hoarding or mass collection of data from the AniList API is strictly prohibited."*
  This app only ever fetches data for AniList usernames a visitor explicitly enters,
  scoped to that one account's own completed-anime list — a bounded, self-service,
  per-user lookup, not indiscriminate bulk crawling of AniList's wider database. That
  reads as normal API usage rather than "hoarding," but it's a judgment call, not a
  guarantee, especially if usage volume grows significantly.
- *"Using the AniList API as a backup or data storage service is strictly
  prohibited."* The `localStorage` caching and optional user-initiated export exist so
  the app itself can function (avoiding a full re-fetch every visit) and so a user can
  keep a personal copy of their own tier list — not to redistribute or mirror AniList's
  data as a service. Again, this project's interpretation, not AniList's ruling.
- *"Use of the AniList API within competing, non-complementary services of the same
  nature is prohibited. This includes, but is not limited to, anime and manga list or
  tracker services."* This app has no login and cannot add, edit, or track anime
  progress on AniList — it only reads an already-existing completed list to build a
  derivative visualization on top of it. That reads as complementary rather than
  competing, but again, not a guarantee.

## Development

```bash
npm install
npm run dev
```

```bash
npm run build   # tsc -b && vite build
npm run lint
```
