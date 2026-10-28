# CleanIn

- This folder is a standalone Chrome extension. Keep changes scoped to the extension and follow its existing build and release setup.
- pnpm is the sole dependency and workspace package manager. Honor the repository's `packageManager` version; install workspace dependencies from the repository root (this standalone repository's root).
- Use `pnpm install`, `pnpm add`/`pnpm remove`, `pnpm exec`/`pnpm dlx`, and `pnpm run` for package operations and scripts. Use frozen-lockfile installs for verification and CI.
- Commit `pnpm-lock.yaml` only. Do not create or commit npm, Yarn, or Bun lockfiles, configure a per-project store, or disable supply-chain controls.
- Bun may remain a shared test runner invoked through `pnpm test`; do not use Bun as an installer.
- Preserve active pnpm `node_modules/.pnpm` directories and the central pnpm store. Remove dependency directories only after verifying they are orphaned.
