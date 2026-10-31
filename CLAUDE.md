# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`vite-plugin-git-meta` is a small Vite plugin that reads git metadata (branch, tag, commit, dates) when Vite loads its config and injects it into the app as the global constant `__GIT_META__`. A second entry point, `vite-plugin-git-meta/vue`, exposes the same data to Vue 3 apps (`$git`, `useGitMeta()`).

The behavior is specified in [docs/specs/](docs/specs/README.md). Read the relevant spec before changing behaviour, and update it in the same change.

## Commands

```bash
bun run dev            # tsc --watch (build to dist/)
bun run build          # tsc -p tsconfig.build.json
bun run typecheck      # tsc --noEmit, tests included
bun run test           # Vitest (specs live in src/__tests__/)
bun run test:watch
bun run lint           # oxlint (auto-fix), lint:check for CI
bun run format         # dprint (auto-fix), format:check for CI
bun run check:package  # publint + are-the-types-wrong, needs a build first
```

## Layout

```
src/
  types.ts   # GitMeta, GitMetaOptions, global __GIT_META__ declaration
  git.ts     # DEFAULT_COMMANDS, runCommand, collectGitMeta (pure logic)
  index.ts   # the Vite plugin gitMeta() and the public re-exports
  vue.ts     # GitMetaPlugin, useGitMeta, GIT_META_KEY ($git typing)
  __tests__/ # unit + integration specs
```

Rules of thumb:

- `git.ts` holds the logic and takes an injected `CommandRunner`, so it is testable without git. `index.ts` stays a thin Vite wrapper.
- `vue.ts` is the only file that may import `vue`. `vue` is an optional peer dependency, `index.ts` must never import it.
- Relative imports end with `.js` (NodeNext, ESM only).
- The package is ESM only, `engines.node >= 20`, `vite >= 5`.

## Code conventions

- **Functions are `function` declarations**, not `const x = () => {}`, including local helpers and test helpers. Arrows are for inline callbacks.
- **Annotate a type only when inference cannot get it right** (empty array, initial `undefined`, literal widening). Parameters are always typed, return types are left to inference. `noInferrableTypes` is on.
- **No inline `if`**: always braces, and a blank line after a braced block.
- **Comments are rare** and written as `/** */` blocks. Code and comments are in English.
- **Tests** live in `src/__tests__/` next to the code, one `describe` per file, never a loop wrapped around `test()`.
- **Formatting** is dprint (single quotes, no semicolons, 120 columns, trailing commas on multi-line). Linting is oxlint. Do not add ESLint, Prettier or Biome.

## Never write an em dash

Never use the em dash character (U+2014) anywhere in this repository: not in code, comments, docs, specs, commit messages, pull request texts or replies. Rewrite the sentence instead: a comma, a colon, parentheses, or two sentences. Hyphens in compound words and en dashes in numeric ranges are fine.

## Workflow

- Commits follow Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:`), one commit per distinct concern.
- Before opening a PR run `bun run typecheck && bun run lint:check && bun run format:check && bun run test && bun run build && bun run check:package`.
- Review expectations are in [REVIEW.md](REVIEW.md).
- `.github/workflows/preview.yml` publishes a preview build of each PR and of `main` with pkg.pr.new (not to npm). `bun run preview` is meant for CI only.
- Releases are automated by release-please ([docs/specs/release.md](docs/specs/release.md)): never edit `version` in `package.json` or `CHANGELOG.md` by hand. Merged changes accumulate in one release PR (version bump + changelog). Merging that PR tags, creates the GitHub Release and publishes to npm.
- Squash-merge PRs. The PR title becomes the commit message and must be a Conventional Commit (`feat:`, `fix:`, `feat!:`...), it is checked by `pr-title.yml` and drives the version bump. Only `feat`, `fix`, `perf` and breaking changes trigger a release.
