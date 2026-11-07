# Top Trumps Card Generator (Anime Characters) — Draft Spec

> **Status: DRAFT v0.1.** Captured from a brainstorming session. To be completed and
> finalized after review with a friend. Open questions are collected at the bottom.
>
> Scope note: this tool is planned to live in this repository / alongside the existing
> AniList projects, reusing their AniList fetching knowledge and tech stack — **not** in a
> brand-new repository.

## 1. Vision

A small, local, snappy web app for generating **Top Trumps-style cards of anime
characters**. Pick a character from your own (or anyone's) AniList list — or via search —
and the app builds a fixed-template card: character image on top, description, and a set
of attributes. The finished card downloads as an image with the card data embedded in the
image itself, so the image can be re-uploaded later to continue editing.

**Hard constraints:**

- No backend, no database, no accounts. The server (if any) only serves static files and
  saves nothing. Everything runs in the browser.
- Persistence is `localStorage` only (settings) plus the exported image files themselves.
- Must feel **fast and snappy**; simple animations only, in service of fun, never at the
  cost of responsiveness.

## 2. V1 Scope — Anime Top Trumps

### 2.1 Getting a character (AniList)

Two candidate sources, possibly both:

- **List browsing:** enter an AniList username and show characters from that user's
  list. Possible filters (ideas, to be decided): only **Completed** anime, minimum
  score threshold, sorted by the viewer's own score, etc.
- **Search:** a search bar querying AniList for any character matching the input.
  Options to match against **name** and/or **description** (any keyword).

For each chosen character, AniList provides: name, anime name(s), description, and the
**largest available image** (used as the default card image).

Optional side buttons: **Google** and **DuckDuckGo** search for "character name + anime
name", opening the search engine's results page. Include only if they fit the layout
naturally.

### 2.2 Card template (fixed)

- Fixed card **aspect ratio**; the crop tool enforces it. No "shrink to fit" / "stretch
  to fit" modes.
- Fixed set of attributes. Candidate list (5–6, to be finalized):
  **Fighting Power, Age, Height, Cuteness, Bust Size, Weight**.
- Character **description** displayed on the card so info can be extracted into attributes.

### 2.3 Image handling

- Default image: the character's largest image from AniList.
- Custom image upload as a replacement.
- **Crop tool:**
  - Fixed aspect ratio matching the card.
  - Can crop larger than the source image, filling the overflow with a **chosen
    background color** (no transparency option).
  - **Snapping** to image center and edges; must feel good to use.
  - Default pre-processing on upload: automatic **crop-to-fill**; user adjusts with the
    crop tool if the result is bad.

### 2.4 Attributes & "Trump" marking

- Settings (persisted in `localStorage`): for each attribute, the **max value** that
  counts as a trump (e.g. Cuteness = 10 ⇒ any card with Cuteness 10 is marked).
- **Manual trump marking:** any attribute can be manually flagged as a trump; a card can
  have **multiple** trump values.
- Trump symbol/visual: TBD (design decision).

### 2.5 Export / save

- A **Save/Download button** produces the finished card as a digital image file.
- **Card data is embedded into the image** (the most important feature), ComfyUI-style:
  a small payload — a few key-value entries, not necessarily full JSON. Fields: character
  name, anime name, each attribute value + trump flags. The image pixels themselves carry
  no special payload requirement.
- Embedding mechanism: image metadata (e.g. PNG text chunks); exact format TBD, chosen so
  a few lines of key-value data round-trip reliably. File type chosen at download time
  (must be a format that preserves the metadata, e.g. PNG; maybe others).
- **Re-upload flow:** uploading a previously exported card image restores the full card
  state into the editor for modification.

### 2.6 Theming

- Preferred direction: **Catppuccin Mocha**, consistent with the look of the existing
  tools; custom designs also welcome.
- Simple, snappy animations while creating cards.

## 3. Architecture (inherited from qanimetierlist)

- Static single-page app: **Vite + React + TypeScript**, CSS modules, no server
  component. All AniList calls go directly from the browser to `https://graphql.anilist.co`
  (public, CORS-enabled, unauthenticated for public read data).
- Reuse the existing AniList client patterns: paginated `MediaListCollection` fetching,
  client-side rate limiter (25 req/min, 2.5s gap, `Retry-After` backoff on 429).
- `localStorage` for settings only. No cookies, no analytics, no tracking.
- Card rendering to image: client-side (canvas). Embedding: PNG `tEXt`/`zTXt` chunks (or
  equivalent) written/read in the browser.

## 4. Roadmap (beyond V1)

- **V2 — General Top Trumps tool:** preset/uploadable card templates & themes; rename,
  add, remove attributes (up to ~6–7); custom icons per attribute from an open-source
  icon library plus custom icon uploads (with the same crop tool).
- **V3 — Print compliance:** optional card backside(s) for printing, CMYK profiles, PDF
  export (print-shop standard), optionally via a cheap business-card printer.
- **V4 (maybe) — General playing-card designer:** expand custom templates into full
  custom card games (own Magic/Pokémon/YGO-style cards). Still designer-only, no database.

## 5. Open questions (to resolve with friend before finalizing)

1. Final attribute list — five or six? (Fighting Power, Age, Height, Cuteness, Bust Size,
   Weight?)
2. Character sourcing: list browsing, search, or both? Which list filters/sorts?
3. Trump symbol design; animation ideas.
4. Theme: Catppuccin Mocha or a custom design?
5. Exact embedded-data format and supported export file types.
6. Background-color default for over-crop; default trump-max values per attribute.
