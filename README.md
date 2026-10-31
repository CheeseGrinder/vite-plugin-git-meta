# vite-plugin-git-meta

Vite plugin that injects git metadata (branch, tag, commit, dates) into your app at build time, with an optional typed Vue 3 plugin.

## Install

```bash
bun add -d vite-plugin-git-meta
```

## Usage

```ts
// vite.config.ts
import { gitMeta } from 'vite-plugin-git-meta'

export default {
  plugins: [gitMeta()],
}
```

The plugin defines a global constant, `__GIT_META__`, replaced at build time:

```ts
console.log(__GIT_META__.displayVersion) // "v1.2.0" on a tag, "main#a1b2c3d" otherwise
```

| Field             | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `version`         | `npm_package_version`, or the `version` option, or `0.0.0`         |
| `tag`             | Tag pointing exactly at HEAD, or `null`                            |
| `branch`          | Current branch (`unknown` outside a git repository)                |
| `commit`          | Full commit hash (`unknown` outside a git repository)              |
| `shortCommit`     | Short commit hash (`unknown` outside a git repository)             |
| `displayVersion`  | The tag when there is one, `branch#shortCommit` otherwise          |
| `commitDate`      | Date of the last commit (ISO-like), or the build date if no commit |
| `buildDate`       | ISO date of the build                                              |
| `dirty`           | `true` when the working tree has uncommitted changes               |
| `commitsSinceTag` | Commits since the nearest tag (`0` on a tag), `null` without a tag |

The build never fails because of git: a missing repository or tag falls back to the values above.

### Builds without a `.git` folder (Docker, CI)

When git has no answer (no `.git` in the image, shallow or detached checkout), the commit, branch and tag are read from the environment instead, after git:

| Field  | Variables, in order                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| commit | `GIT_COMMIT`, `GITHUB_SHA`, `CI_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, `CF_PAGES_COMMIT_SHA`                                                            |
| branch | `GIT_BRANCH`, `GITHUB_HEAD_REF`, `CI_COMMIT_BRANCH`, `CI_COMMIT_REF_NAME`, `VERCEL_GIT_COMMIT_REF`, `CF_PAGES_BRANCH`, `GITHUB_REF_NAME` (branch refs) |
| tag    | `GIT_TAG`, `CI_COMMIT_TAG`, `GITHUB_REF_NAME` (tag refs)                                                                                               |

`shortCommit` is the first 7 characters of the commit. In a Dockerfile, pass the values as build arguments:

```dockerfile
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG GIT_TAG
RUN bun run build
```

`dirty`, `commitsSinceTag` and `commitDate` have no environment source and fall back to `false`, `null` and the build date.

### Version file

`versionFile: true` writes the metadata to `version.json` next to the build output, and serves it at the same URL in dev. A deployed app can fetch it to know which version runs, or to detect that a new one was deployed:

```ts
const deployed = await (await fetch('/version.json', { cache: 'no-store' })).json()

if (deployed.commit !== __GIT_META__.commit) {
  // a newer build is live, offer a reload
}
```

### Dev server

The metadata is computed when Vite loads its config. In `vite dev` the plugin watches `HEAD` and the refs of the repository, and restarts the dev server when the commit, branch or tag changes (a commit, a checkout, a new tag). Editing files does not restart it, so `dirty` is only refreshed by a restart.

To type the global in your app, add this to a `.d.ts` file or `tsconfig` `types`:

```ts
/// <reference types="vite-plugin-git-meta" />
```

## Vue

```ts
// main.ts
import { GitMetaPlugin } from 'vite-plugin-git-meta/vue'

createApp(App).use(GitMetaPlugin)
```

```html
<span>{{ $git.displayVersion }}</span>
```

```ts
import { useGitMeta } from 'vite-plugin-git-meta/vue'

const git = useGitMeta()
```

## Options

```ts
gitMeta({
  cwd: '/path/to/repo',
  version: '2.0.0',
  commands: { tag: 'git describe --tags --abbrev=0' },
  displayVersion: meta =>
    `${meta.version}${meta.commitsSinceTag ? `+${meta.commitsSinceTag}` : ''}${meta.dirty ? '-dirty' : ''}`,
  versionFile: true,
})
```

| Option           | Default                             | Description                                                                                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cwd`            | Vite `root`, then `process.cwd()`   | Directory the git commands run in                                                                                  |
| `version`        | `npm_package_version`, then `0.0.0` | Overrides `version`                                                                                                |
| `commands`       | see below                           | Overrides the command behind a field (`branch`, `tag`, `commit`, `shortCommit`, `commitDate`, `describe`, `dirty`) |
| `displayVersion` | tag, then `branch#shortCommit`      | Builds `displayVersion` from the other fields                                                                      |
| `versionFile`    | `false`                             | `true` emits `version.json`, a string sets the file name                                                           |

Default commands:

| Field         | Command                                                |
| ------------- | ------------------------------------------------------ |
| `branch`      | `git rev-parse --abbrev-ref HEAD`                      |
| `tag`         | `git describe --tags --exact-match`                    |
| `commit`      | `git rev-parse HEAD`                                   |
| `shortCommit` | `git rev-parse --short HEAD`                           |
| `commitDate`  | `git log -1 --format=%cd --date=iso`                   |
| `describe`    | `git describe --tags --long` (gives `commitsSinceTag`) |
| `dirty`       | `git status --porcelain` (any output means dirty)      |

## Preview builds

Every pull request and every push to `main` publishes a preview build through [pkg.pr.new](https://github.com/stackblitz-labs/pkg.pr.new), nothing is published to npm. A bot comment on the pull request gives the install command:

```bash
bun add https://pkg.pr.new/CheeseGrinder/vite-plugin-git-meta@<pr-number-or-sha>
```

The [pkg-pr-new GitHub App](https://github.com/apps/pkg-pr-new) must be installed on the repository.

## Releases

Versions and the [changelog](CHANGELOG.md) are generated from Conventional Commits by release-please. Merged changes accumulate in a single release PR; merging it tags the version, creates the GitHub Release and publishes to npm. A merge never publishes by itself. See [docs/specs/release.md](docs/specs/release.md).

## Development

```bash
bun install
bun run test          # Vitest
bun run typecheck
bun run lint:check    # oxlint
bun run format:check  # dprint
bun run build
bun run check:package # publint + are-the-types-wrong
```

## License

MIT
