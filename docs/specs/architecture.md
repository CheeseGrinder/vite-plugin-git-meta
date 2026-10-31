# Architecture

## Modules

```mermaid
flowchart LR
  subgraph package["vite-plugin-git-meta"]
    types["types.ts<br/>GitMeta, GitMetaOptions,<br/>global __GIT_META__"]
    git["git.ts<br/>collectGitMeta,<br/>DEFAULT_COMMANDS, runCommand"]
    index["index.ts<br/>gitMeta() Vite plugin"]
    watch["watch.ts<br/>watchGitState, hasGitStateChanged"]
    vue["vue.ts<br/>GitMetaPlugin, useGitMeta"]
  end

  index --> git
  index --> watch
  watch --> git
  index --> types
  git --> types
  vue --> types

  index -. "entry '.'" .-> consumerVite["vite.config.ts"]
  vue -. "entry './vue'" .-> consumerApp["main.ts / components"]
```

Dependency rules:

1. `git.ts` has no Vite and no Vue import. It receives a `CommandRunner`, which makes it testable without git.
2. `index.ts` is a thin Vite wrapper: it resolves the working directory, calls `collectGitMeta`, emits or serves the version file and restarts the dev server through `watch.ts`.
3. `vue.ts` is the only file importing `vue`, an optional peer dependency. `index.ts` and `git.ts` must never import it.

## Data flow

The metadata is computed once, when Vite loads its config, and baked into the bundle as a constant.

```mermaid
sequenceDiagram
  participant V as Vite
  participant P as gitMeta() plugin
  participant C as collectGitMeta
  participant G as git (child process)
  participant B as Bundle
  participant A as App (Vue)

  V->>P: config(userConfig)
  P->>P: cwd = options.cwd ?? root ?? process.cwd()
  P->>C: collectGitMeta(options, cwd)
  loop branch, tag, commit, shortCommit, commitDate, describe, dirty
    C->>G: run command in cwd
    G-->>C: stdout, or failure
  end
  C-->>P: GitMeta (with fallbacks)
  P-->>V: define { __GIT_META__: JSON.stringify(meta) }
  V->>B: replaces __GIT_META__ at build time
  A->>A: app.use(GitMetaPlugin)
  A->>A: $git / useGitMeta() read the constant
```

At run time there is no git, no Node and no network involved: `__GIT_META__` is a literal object in the bundle.

## Distribution

```mermaid
flowchart LR
  src["src/*.ts"] -- "tsc -p tsconfig.build.json" --> dist["dist/*.js + .d.ts"]
  dist --> pkg["npm package<br/>files: [dist]"]
  main["merge of the release PR"] --> release["release.yml<br/>tag, GitHub Release,<br/>typecheck, test, build"]
  release -- "npm publish --provenance" --> pkg
```

Every pull request and push to `main` also runs `preview.yml`, which builds and publishes a preview to pkg.pr.new (a bot comments the install command on the PR). Nothing from this path reaches npm.

```mermaid
flowchart LR
  pr["PR or push to main"] --> preview["preview.yml<br/>build"]
  preview -- "pkg-pr-new publish" --> pkgprnew["pkg.pr.new"]
  pkgprnew --> comment["bot comment with<br/>bun add https://pkg.pr.new/..."]
```

The release flow is detailed in [release](release.md). Output is ESM only. The `exports` map has two entries: `.` (plugin, types) and `./vue`.
