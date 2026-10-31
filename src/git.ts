import { execSync } from 'node:child_process'
import type { GitCommandName, GitMeta, GitMetaOptions } from './types.js'

export const DEFAULT_COMMANDS = {
  branch: 'git rev-parse --abbrev-ref HEAD',
  tag: 'git describe --tags --exact-match',
  commit: 'git rev-parse HEAD',
  shortCommit: 'git rev-parse --short HEAD',
  commitDate: 'git log -1 --format=%cd --date=iso',
  describe: 'git describe --tags --long',
  dirty: 'git status --porcelain',
} as const satisfies Record<GitCommandName, string>

export type CommandRunner = (command: string, cwd: string) => string | null

type Env = Record<string, string | undefined>

const SHORT_COMMIT_LENGTH = 7

const ENV_COMMIT = ['GIT_COMMIT', 'GITHUB_SHA', 'CI_COMMIT_SHA', 'VERCEL_GIT_COMMIT_SHA', 'CF_PAGES_COMMIT_SHA']
const ENV_BRANCH = [
  'GIT_BRANCH',
  'GITHUB_HEAD_REF',
  'CI_COMMIT_BRANCH',
  'CI_COMMIT_REF_NAME',
  'VERCEL_GIT_COMMIT_REF',
  'CF_PAGES_BRANCH',
]
const ENV_TAG = ['GIT_TAG', 'CI_COMMIT_TAG']

export function runCommand(command: string, cwd: string) {
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

    return output || null
  } catch {
    return null
  }
}

function firstEnv(env: Env, names: string[]) {
  for (const name of names) {
    if (env[name]) {
      return env[name]
    }
  }

  return null
}

function githubRef(env: Env, type: 'branch' | 'tag') {
  return env.GITHUB_REF_TYPE === type ? env.GITHUB_REF_NAME || null : null
}

/**
 * Reads the branch from the CI environment, for builds where git cannot answer
 * (no `.git` in a Docker image, shallow or detached checkout).
 */
function envBranch(env: Env) {
  return firstEnv(env, ENV_BRANCH) ?? githubRef(env, 'branch')
}

function envTag(env: Env) {
  return firstEnv(env, ENV_TAG) ?? githubRef(env, 'tag')
}

/** Reads N out of `git describe --tags --long` (`v1.2.0-3-gabc1234`). */
function parseCommitsSinceTag(describe: string | null) {
  const match = describe?.match(/-(\d+)-g[0-9a-f]+$/)

  return match ? Number(match[1]) : null
}

export function collectGitMeta(
  options: GitMetaOptions = {},
  cwd = process.cwd(),
  run: CommandRunner = runCommand,
  env: Env = process.env,
) {
  const commands = { ...DEFAULT_COMMANDS, ...options.commands }
  const read = (name: GitCommandName) => run(commands[name], cwd)

  const gitBranch = read('branch')
  const commit = read('commit') ?? firstEnv(env, ENV_COMMIT)

  const base = {
    version: options.version ?? env.npm_package_version ?? '0.0.0',
    tag: read('tag') ?? envTag(env),
    branch: (gitBranch === 'HEAD' ? null : gitBranch) ?? envBranch(env) ?? 'unknown',
    commit: commit ?? 'unknown',
    shortCommit: read('shortCommit') ?? commit?.slice(0, SHORT_COMMIT_LENGTH) ?? 'unknown',
    commitDate: read('commitDate') ?? new Date().toISOString(),
    buildDate: new Date().toISOString(),
    dirty: read('dirty') !== null,
    commitsSinceTag: parseCommitsSinceTag(read('describe')),
  }

  const displayVersion = options.displayVersion
    ? options.displayVersion(base)
    : base.tag ?? `${base.branch}#${base.shortCommit}`

  return { ...base, displayVersion } satisfies GitMeta
}
