# Review guide

What a reviewer (human or Claude) checks on a change to this repository. Report problems ranked by severity, and skip style points that dprint and oxlint already enforce.

## Must pass

- [ ] `bun run typecheck`, `lint:check`, `format:check`, `test`, `build` and `check:package` are green.
- [ ] The change has a test. A bug fix has a test that fails without the fix.
- [ ] The relevant spec in `docs/specs/` is updated when behaviour, options or the public API change.
- [ ] No em dash (U+2014) anywhere, including docs and commit messages.
- [ ] The PR title is a Conventional Commit of the right type: it decides the version bump and the changelog. A breaking change uses `!` or a `BREAKING CHANGE:` footer.
- [ ] `package.json` `version` and `CHANGELOG.md` are untouched (release-please owns them).

## Correctness

- [ ] The build must never fail because of git. Any git failure (no repository, no tag, no commit, git missing) falls back to a value from the fallback table in the specs, it never throws.
- [ ] Git commands run in the resolved `cwd` and their stderr is not leaked to the console.
- [ ] `__GIT_META__` is always serialised with `JSON.stringify`, so it is a valid JS literal whatever the branch or tag name contains.
- [ ] `displayVersion` keeps its documented default (tag, else `branch#shortCommit`).
- [ ] A user-supplied command or callback cannot break the other fields.

## Public API and compatibility

- [ ] Anything exported from `src/index.ts` or `src/vue.ts` is part of the public API. Removing or changing it is a breaking change and needs a major bump (a minor while `0.x`).
- [ ] New options are optional, have a documented default, and are listed in the README and `docs/specs/api.md`.
- [ ] `vue` stays an optional peer dependency: `src/index.ts` and `src/git.ts` must not import it.
- [ ] Relative imports end with `.js`, the output stays ESM only, and `check:package` is clean.
- [ ] No new runtime dependency without a strong reason. The package has none today.

## Tests

- [ ] Logic is tested through the injected `CommandRunner`, not by mocking `child_process`.
- [ ] Real git behaviour is covered by the integration spec, which uses a temporary repository and cleans it up.
- [ ] Tests do not depend on the machine's git config, the current date (use fake timers) or the checkout they run in.

## Code style

- [ ] `function` declarations, braces on every `if`, a blank line after a braced block, English comments kept to a minimum.
- [ ] Types are annotated only where inference cannot get it right.

## Reporting

Group findings as **Blocking** (wrong behaviour, API break, missing test), **Should fix** (maintainability, unclear contract) and **Nit**. For each, give the file and line, what goes wrong and a concrete input that triggers it.
