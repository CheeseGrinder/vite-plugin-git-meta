# Specifications

How `vite-plugin-git-meta` behaves. These documents are the source of truth: a change of behaviour, option or public API updates the matching spec in the same pull request.

| Spec                            | Covers                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| [architecture](architecture.md) | Modules, dependency rules, and the build-time and run-time data flow |
| [behavior](behavior.md)         | How each field is computed, fallbacks, edge cases and known limits   |
| [api](api.md)                   | Public exports, options, the Vue entry point and compatibility       |
| [release](release.md)           | Automated versioning, changelog, GitHub Release and npm publish      |
| [testing](testing.md)           | Test strategy and what each spec file guarantees                     |

## Goals

- Expose git metadata to a Vite app with zero runtime cost: the data is a constant replaced at build time.
- Never fail a build because of git.
- Stay tiny: no runtime dependency, one optional peer (`vue`).
- Be typed end to end, from the options to `$git` in templates.

## Non-goals

- Watching git during `vite dev` and refreshing the value on each commit.
- Reading anything other than the five git fields and the version (no remote URL, author, dirty state).
- Supporting CommonJS consumers (the package is ESM only).
