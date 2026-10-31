import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { collectGitMeta, DEFAULT_COMMANDS } from '../git.js'
import type { CommandRunner } from '../git.js'

const CI_VARIABLES = [
  'GIT_COMMIT',
  'GIT_BRANCH',
  'GIT_TAG',
  'GITHUB_SHA',
  'GITHUB_HEAD_REF',
  'GITHUB_REF_NAME',
  'GITHUB_REF_TYPE',
  'CI_COMMIT_SHA',
  'CI_COMMIT_BRANCH',
  'CI_COMMIT_REF_NAME',
  'CI_COMMIT_TAG',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'CF_PAGES_COMMIT_SHA',
  'CF_PAGES_BRANCH',
]

function runnerFrom(outputs: Record<string, string | null>): CommandRunner {
  return command => outputs[command] ?? null
}

describe('collectGitMeta', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))

    for (const name of CI_VARIABLES) {
      vi.stubEnv(name, '')
    }
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
      [DEFAULT_COMMANDS.describe]: 'v1.2.3-0-gabcdef1',
      [DEFAULT_COMMANDS.dirty]: ' M src/index.ts',
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
      dirty: true,
      commitsSinceTag: 0,
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
      dirty: false,
      commitsSinceTag: null,
    })
  })

  test('counts the commits since the nearest tag', () => {
    const run = runnerFrom({ [DEFAULT_COMMANDS.describe]: 'v1.2.0-3-gabc1234' })

    expect(collectGitMeta({}, '/repo', run).commitsSinceTag).toBe(3)
  })

  test('has no commit count when describe fails or is not parseable', () => {
    expect(collectGitMeta({}, '/repo', () => null).commitsSinceTag).toBeNull()
    expect(collectGitMeta({}, '/repo', runnerFrom({ [DEFAULT_COMMANDS.describe]: 'weird' })).commitsSinceTag).toBeNull()
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

  test('falls back to the CI environment when git has no answer', () => {
    const env = {
      GITHUB_SHA: 'abcdef1234567890',
      GITHUB_REF_TYPE: 'branch',
      GITHUB_REF_NAME: 'release/1.x',
    }

    const meta = collectGitMeta({}, '/repo', () => null, env)

    expect(meta).toMatchObject({
      commit: 'abcdef1234567890',
      shortCommit: 'abcdef1',
      branch: 'release/1.x',
      tag: null,
      displayVersion: 'release/1.x#abcdef1',
    })
  })

  test('reads the tag from the CI environment', () => {
    expect(collectGitMeta({}, '/repo', () => null, { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v2.0.0' }))
      .toMatchObject({
        tag: 'v2.0.0',
        displayVersion: 'v2.0.0',
      })
    expect(collectGitMeta({}, '/repo', () => null, { CI_COMMIT_TAG: 'v3.0.0' }).tag).toBe('v3.0.0')
  })

  test('lets the generic GIT_* variables feed a Docker build without a .git folder', () => {
    const env = { GIT_COMMIT: 'fedcba9876543210', GIT_BRANCH: 'main', GIT_TAG: 'v1.0.0' }

    expect(collectGitMeta({}, '/app', () => null, env)).toMatchObject({
      commit: 'fedcba9876543210',
      shortCommit: 'fedcba9',
      branch: 'main',
      tag: 'v1.0.0',
    })
  })

  test('prefers git over the environment', () => {
    const run = runnerFrom({ [DEFAULT_COMMANDS.branch]: 'main', [DEFAULT_COMMANDS.commit]: 'aaaaaaaa11111111' })

    expect(collectGitMeta({}, '/repo', run, { GIT_BRANCH: 'other', GIT_COMMIT: 'bbbbbbbb22222222' })).toMatchObject({
      branch: 'main',
      commit: 'aaaaaaaa11111111',
    })
  })

  test('treats a detached HEAD as having no branch', () => {
    const run = runnerFrom({ [DEFAULT_COMMANDS.branch]: 'HEAD', [DEFAULT_COMMANDS.shortCommit]: 'abcdef1' })

    expect(collectGitMeta({}, '/repo', run, { GITHUB_HEAD_REF: 'feat/x' }).branch).toBe('feat/x')
    expect(collectGitMeta({}, '/repo', run, {}).branch).toBe('unknown')
  })
})
