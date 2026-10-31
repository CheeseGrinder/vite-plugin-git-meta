export interface GitMeta {
  version: string
  tag: string | null
  branch: string
  commit: string
  shortCommit: string
  displayVersion: string
  commitDate: string
  buildDate: string
  /** Whether the working tree has uncommitted changes (false when git is unavailable). */
  dirty: boolean
  /** Commits since the nearest tag, 0 on a tag, `null` when there is no tag or no git. */
  commitsSinceTag: number | null
}

export type GitCommandName = 'branch' | 'tag' | 'commit' | 'shortCommit' | 'commitDate' | 'describe' | 'dirty'

export interface GitMetaOptions {
  /** Directory the git commands run in. Defaults to the Vite root, then `process.cwd()`. */
  cwd?: string
  /** Overrides the version, which defaults to `npm_package_version` then `0.0.0`. */
  version?: string
  /** Overrides the git command behind a field (the full command, `git` included). */
  commands?: Partial<Record<GitCommandName, string>>
  /** Builds `displayVersion`, which defaults to the tag or `branch#shortCommit`. */
  displayVersion?: (meta: Omit<GitMeta, 'displayVersion'>) => string
}

declare global {
  const __GIT_META__: GitMeta
}
