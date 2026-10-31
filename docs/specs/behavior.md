# Behavior

## When the data is computed

`gitMeta()` returns a Vite plugin with a `config` hook. The hook runs once per Vite config load, for `vite build` and for `vite dev` alike. The result is injected with `define`, so every use of `__GIT_META__` in the app is replaced by the same JSON literal.

Consequence: in `vite dev` the value is fixed when the dev server starts. A new commit or tag is picked up on the next restart (or a config reload).

## Working directory

```mermaid
flowchart TD
  start["resolve cwd"] --> opt{"options.cwd set?"}
  opt -- yes --> useOpt["use options.cwd as is"]
  opt -- no --> root{"userConfig.root set?"}
  root -- yes --> useRoot["path.resolve(userConfig.root)"]
  root -- no --> useProc["process.cwd()"]
```

## Fields

Each git field comes from one command, run through the shell in the resolved `cwd`. Output is trimmed. Empty output counts as a failure.

| Field         | Default command                      | Fallback when the command fails or prints nothing |
| ------------- | ------------------------------------ | ------------------------------------------------- |
| `branch`      | `git rev-parse --abbrev-ref HEAD`    | `'unknown'`                                       |
| `tag`         | `git describe --tags --exact-match`  | `null`                                            |
| `commit`      | `git rev-parse HEAD`                 | `'unknown'`                                       |
| `shortCommit` | `git rev-parse --short HEAD`         | `'unknown'`                                       |
| `commitDate`  | `git log -1 --format=%cd --date=iso` | build date as an ISO 8601 string                  |

The two other fields do not use git:

| Field            | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `version`        | `options.version`, else `process.env.npm_package_version`, else `'0.0.0'`                  |
| `buildDate`      | `new Date().toISOString()` at the time the hook runs                                       |
| `displayVersion` | `options.displayVersion(meta)` if given, else `tag`, else `` `${branch}#${shortCommit}` `` |

`displayVersion` receives every other field, with the fallbacks already applied. `npm_package_version` is only set when Vite is started through a package manager script (`bun run build`, `npm run build`), so pass `version` explicitly when it is launched another way.

## Failure handling

```mermaid
flowchart TD
  run["run git command"] --> ok{"exit code 0?"}
  ok -- no --> fb["return null"]
  ok -- yes --> empty{"stdout empty after trim?"}
  empty -- yes --> fb
  empty -- no --> val["return trimmed stdout"]
  fb --> fallback["field takes its fallback value"]
  val --> field["field takes the value"]
```

- Nothing in this path throws: not a repository, git not installed, no commit yet, no tag, bad custom command.
- stderr is discarded (`stdio: ['ignore', 'pipe', 'ignore']`), so a missing tag does not print `fatal: no tag exactly matches` in the build log.
- A failing field never affects the others.

## Edge cases

| Situation                              | Result                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Detached HEAD (typical in CI on a tag) | `branch` is `'HEAD'`. `tag` is set if HEAD is tagged, so `displayVersion` is the tag |
| HEAD has several tags                  | Git picks one for `describe`. Override `commands.tag` to choose                      |
| Shallow clone without tags             | `tag` is `null`. Fetch tags (`fetch-depth: 0` in GitHub Actions)                     |
| Repository with no commit              | `commit`, `shortCommit` fall back to `'unknown'`, `commitDate` to the build date     |
| Not a git repository                   | Every git field falls back, the build succeeds                                       |
| Branch name with quotes or newlines    | Safe: the object goes through `JSON.stringify`                                       |
| Custom command with a bad exit code    | Treated as a failure, the field uses its fallback                                    |

## Security notes

`commands` strings are executed by a shell. They come from the project's own `vite.config`, which is trusted code, so there is no sanitisation. Never build them from untrusted input (a branch name, an environment variable set by a contributor).

## Known limits

- No refresh in `vite dev` (see above).
- `commitDate` uses git's `iso` format (`2025-12-31 10:00:00 +0100`), which is ISO-like but not strict ISO 8601. Only the fallback is a strict ISO string.
- Monorepos: git runs in the Vite root, so a package in a subfolder reports the commit of the whole repository, not the last commit touching that package.
