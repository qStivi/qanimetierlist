# Critical paths  changes here are high risk

A change touching any path below requires: author's read-through **plus** one independent review, per the tier table. The tier workflow (`.github/workflows/tier.yml`) applies the `high risk` label automatically when a diff matches its pattern list  **keep the two in sync**: paths live in CRITICAL_PATHS.md for humans, patterns in tier.yml for the machine.

## Paths

- `.github/workflows/*`  CI/CD workflows including the review pipeline itself
- `src/*`  all application source code (React components, API clients, stores)
- `package.json`  dependencies and scripts
- `tsconfig*.json`  TypeScript configuration
- `vite.config.ts`  build configuration
- `eslint.config.js`  linting rules

## Host-side critical paths (if this repo deploys somewhere  AUTHOR OR DELETE)

<!-- e.g. database host, guest config, ingress  whatever a mistake there costs
     an evening. Tracked here so the reviewer knows what "destructive" means
     for this repo's deployment scripts. -->
