# REVIEW.md  what failure looks like in this repo

For the review agent: this tells you what actually matters here, so you don't burn rounds on what doesn't. Review against these failure modes first; generic style feedback is noise unless it hides one of them.

## Failure modes (priority order)

1. **API contract violations**  AniList API client in `src/api/anilist.ts` must respect rate limits and handle errors; changes that break the API contract cause runtime failures
2. **State corruption**  Tier list state in `src/context/tierListStore.ts` must maintain consistency; invalid state transitions break the UI
3. **Data loss**  Any change that causes user data (tier lists, character rankings) to be lost or corrupted without explicit user action
4. **XSS vulnerabilities**  User-generated content (usernames, character names) rendered in the UI must be properly escaped
5. **Secrets exposure**  API tokens, keys, or credentials in code, config files, or logs
6. **Build failures**  Changes to `vite.config.ts`, `tsconfig*.json`, or `package.json` that break the build or TypeScript compilation
7. **Deployment breakage**  Changes to `.github/workflows/deploy.yml` that break the production deployment
8. **CI failures**  Changes that break `npm run lint` or `npm run build`

## Universal rules (keep verbatim)

### Clearing a finding requires evidence
A false positive is closed with a *written reason backed by a primary source*  the actual merged file, a live command, the CLI's own reference. "I'm confident it's fine" is not a clear. If you cannot cite the evidence, treat the finding as real.

### Non-findings (do not flag)
- Styling, naming, or structural preferences not tied to a failure mode above.
- Missing features  that's the roadmap, not a review finding.
- Choices already recorded in the repo's decision log (DECISIONS.md/ADR, if present).
