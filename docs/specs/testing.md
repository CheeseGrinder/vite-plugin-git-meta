# Testing

Vitest, specs in `src/__tests__/`, run with `bun run test`.

## Strategy

```mermaid
flowchart TD
  logic["collectGitMeta<br/>(pure, injected runner)"] --> unit["git.spec.ts<br/>fake CommandRunner"]
  logic --> real["git.integration.spec.ts<br/>real temporary git repo"]
  plugin["gitMeta() hook"] --> pluginSpec["index.spec.ts<br/>calls the config hook"]
  plugin --> versionSpec["version-file.spec.ts<br/>generateBundle, dev middleware"]
  plugin --> devSpec["dev-refresh.spec.ts<br/>mocked watcher, restart"]
  watcher["watchGitState"] --> watchSpec["watch.spec.ts<br/>real repo, real fs.watch"]
  vuePlugin["GitMetaPlugin / useGitMeta"] --> vueSpec["vue.spec.ts<br/>createApp + stubbed global"]
```

Logic is tested through the injected `CommandRunner`, never by mocking `child_process`. Real git behaviour is covered once, in the integration spec.

## What each file guarantees

| File                      | Guarantees                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git.spec.ts`             | Every field is read, `displayVersion` default and custom, fallbacks outside git, CI environment fallback and its precedence, detached HEAD, `commitsSinceTag` parsing, `version` precedence, command override and `cwd` forwarding |
| `git.integration.spec.ts` | On a real repo: branch and hash, tag detection, commits past a tag, dirty tree, fallback outside a repository                                                                                                                      |
| `version-file.spec.ts`    | Nothing emitted by default, `version.json` content, custom name, dev middleware hit and miss                                                                                                                                       |
| `dev-refresh.spec.ts`     | Restart when the commit changes, none for working tree edits, watcher closed with the server, no watcher outside a repository                                                                                                      |
| `watch.spec.ts`           | `hasGitStateChanged` rules, and on a real repo: a commit triggers the callback, stop works, working tree edits are ignored                                                                                                         |
| `index.spec.ts`           | Plugin name, `define.__GIT_META__` is valid JSON with all ten fields, `cwd` precedence (option, Vite root)                                                                                                                         |
| `vue.spec.ts`             | `$git` and `useGitMeta()` return the meta, clear errors when the Vite plugin or `app.use` is missing                                                                                                                               |

## Rules

- A bug fix comes with a test that fails without the fix.
- Time goes through fake timers (`vi.useFakeTimers`), never the wall clock.
- The integration spec creates its repository in `os.tmpdir()`, sets its own `user.name`, `user.email` and `commit.gpgsign`, and removes it afterwards. It must not depend on the developer's global git config or on the checkout it runs in.
- CI runs the suite on Node 20, 22 and 24, with full history (`fetch-depth: 0`).
