import { execSync } from 'node:child_process'
import type { GitCommandName, GitMeta, GitMetaOptions } from './types.js'

export const DEFAULT_COMMANDS = {
  branch: 'git rev-parse --abbrev-ref HEAD',
  tag: 'git describe --tags --exact-match',
  commit: 'git rev-parse HEAD',
  shortCommit: 'git rev-parse --short HEAD',
  commitDate: 'git log -1 --format=%cd --date=iso',
} as const satisfies Record<GitCommandName, string>

export type CommandRunner = (command: string, cwd: string) => string | null

export function runCommand(command: string, cwd: string) {
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

    return output || null
  } catch {
    return null
  }
}

export function collectGitMeta(options: GitMetaOptions = {}, cwd = process.cwd(), run: CommandRunner = runCommand) {
  const commands = { ...DEFAULT_COMMANDS, ...options.commands }
  const read = (name: GitCommandName) => run(commands[name], cwd)

  const base = {
    version: options.version ?? process.env.npm_package_version ?? '0.0.0',
    tag: read('tag'),
    branch: read('branch') ?? 'unknown',
    commit: read('commit') ?? 'unknown',
    shortCommit: read('shortCommit') ?? 'unknown',
    commitDate: read('commitDate') ?? new Date().toISOString(),
    buildDate: new Date().toISOString(),
  }

  const displayVersion = options.displayVersion
    ? options.displayVersion(base)
    : base.tag ?? `${base.branch}#${base.shortCommit}`

  return { ...base, displayVersion } satisfies GitMeta
}
