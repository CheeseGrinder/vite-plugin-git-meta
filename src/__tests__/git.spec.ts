import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { collectGitMeta, DEFAULT_COMMANDS } from '../git.js'
import type { CommandRunner } from '../git.js'

function runnerFrom(outputs: Record<string, string | null>): CommandRunner {
  return command => outputs[command] ?? null
}

describe('collectGitMeta', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('reads every field from git', () => {
    const run = runnerFrom({
      [DEFAULT_COMMANDS.branch]: 'main',
      [DEFAULT_COMMANDS.tag]: 'v1.2.3',
      [DEFAULT_COMMANDS.commit]: 'abcdef1234567890',
      [DEFAULT_COMMANDS.shortCommit]: 'abcdef1',
      [DEFAULT_COMMANDS.commitDate]: '2025-12-31 10:00:00 +0100',
    })

    expect(collectGitMeta({ version: '1.2.3' }, '/repo', run)).toEqual({
      version: '1.2.3',
      tag: 'v1.2.3',
      branch: 'main',
      commit: 'abcdef1234567890',
      shortCommit: 'abcdef1',
      displayVersion: 'v1.2.3',
      commitDate: '2025-12-31 10:00:00 +0100',
      buildDate: '2026-01-02T03:04:05.000Z',
    })
  })

  test('falls back to branch#shortCommit without a tag', () => {
    const run = runnerFrom({
      [DEFAULT_COMMANDS.branch]: 'feat/x',
      [DEFAULT_COMMANDS.shortCommit]: 'abcdef1',
    })

    const meta = collectGitMeta({}, '/repo', run)

    expect(meta.tag).toBeNull()
    expect(meta.displayVersion).toBe('feat/x#abcdef1')
  })

  test('uses safe fallbacks outside a git repository', () => {
    const meta = collectGitMeta({}, '/nowhere', () => null)

    expect(meta).toMatchObject({
      tag: null,
      branch: 'unknown',
      commit: 'unknown',
      shortCommit: 'unknown',
      displayVersion: 'unknown#unknown',
      commitDate: '2026-01-02T03:04:05.000Z',
    })
  })

  test('takes the version from the option, then npm_package_version, then 0.0.0', () => {
    vi.stubEnv('npm_package_version', '4.5.6')

    expect(collectGitMeta({ version: '9.9.9' }, '/repo', () => null).version).toBe('9.9.9')
    expect(collectGitMeta({}, '/repo', () => null).version).toBe('4.5.6')

    vi.stubEnv('npm_package_version', '')
    delete process.env.npm_package_version

    expect(collectGitMeta({}, '/repo', () => null).version).toBe('0.0.0')
  })

  test('lets a command be overridden and passes the cwd along', () => {
    const run = vi.fn<CommandRunner>(() => null)

    collectGitMeta({ commands: { tag: 'git describe --tags --abbrev=0' } }, '/repo', run)

    expect(run).toHaveBeenCalledWith('git describe --tags --abbrev=0', '/repo')
    expect(run).not.toHaveBeenCalledWith(DEFAULT_COMMANDS.tag, '/repo')
    expect(run).toHaveBeenCalledWith(DEFAULT_COMMANDS.branch, '/repo')
  })

  test('lets displayVersion be customised', () => {
    const run = runnerFrom({ [DEFAULT_COMMANDS.shortCommit]: 'abcdef1' })

    const meta = collectGitMeta({ displayVersion: m => `build-${m.shortCommit}` }, '/repo', run)

    expect(meta.displayVersion).toBe('build-abcdef1')
  })
})
