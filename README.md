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

| Field            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `version`        | `npm_package_version`, or the `version` option, or `0.0.0`         |
| `tag`            | Tag pointing exactly at HEAD, or `null`                            |
| `branch`         | Current branch (`unknown` outside a git repository)                |
| `commit`         | Full commit hash (`unknown` outside a git repository)              |
| `shortCommit`    | Short commit hash (`unknown` outside a git repository)             |
| `displayVersion` | The tag when there is one, `branch#shortCommit` otherwise          |
| `commitDate`     | Date of the last commit (ISO-like), or the build date if no commit |
| `buildDate`      | ISO date of the build                                              |

The build never fails because of git: a missing repository or tag falls back to the values above.

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
  displayVersion: meta => `${meta.version}+${meta.shortCommit}`,
})
```

| Option           | Default                             | Description                                                                           |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `cwd`            | Vite `root`, then `process.cwd()`   | Directory the git commands run in                                                     |
| `version`        | `npm_package_version`, then `0.0.0` | Overrides `version`                                                                   |
| `commands`       | see below                           | Overrides the command behind `branch`, `tag`, `commit`, `shortCommit` or `commitDate` |
| `displayVersion` | tag, then `branch#shortCommit`      | Builds `displayVersion` from the other fields                                         |

Default commands:

| Field         | Command                              |
| ------------- | ------------------------------------ |
| `branch`      | `git rev-parse --abbrev-ref HEAD`    |
| `tag`         | `git describe --tags --exact-match`  |
| `commit`      | `git rev-parse HEAD`                 |
| `shortCommit` | `git rev-parse --short HEAD`         |
| `commitDate`  | `git log -1 --format=%cd --date=iso` |

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
