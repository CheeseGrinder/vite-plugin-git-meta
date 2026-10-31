import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { collectGitMeta } from '../git.js'
import { hasGitStateChanged, resolveGitDir, watchGitState } from '../watch.js'

const meta = collectGitMeta({}, '/nowhere', () => null, {})

describe('git state watching', () => {
  test('is true when the commit, branch or tag moved', () => {
    expect(hasGitStateChanged(meta, { ...meta, commit: 'other' })).toBe(true)
    expect(hasGitStateChanged(meta, { ...meta, branch: 'other' })).toBe(true)
    expect(hasGitStateChanged(meta, { ...meta, tag: 'v1.0.0' })).toBe(true)
  })

  test('is false for dates, dirtiness and the rest', () => {
    const next = { ...meta, dirty: true, buildDate: 'later', commitsSinceTag: 4 }

    expect(hasGitStateChanged(meta, next)).toBe(false)
  })

  let repo = ''

  function git(args: string) {
    return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'git-meta-watch-'))
    git('init -q -b trunk')
    git('config user.email test@example.com')
    git('config user.name Test')
    git('config commit.gpgsign false')
    writeFileSync(join(repo, 'a.txt'), 'a')
    git('add .')
    git('commit -q -m first')
  })

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  test('resolves the git directory, and nothing outside a repository', () => {
    expect(resolveGitDir(repo)).toMatch(/\.git$/)
    expect(resolveGitDir(tmpdir(), () => null)).toBeNull()
  })

  test('calls back after a commit and stops once stopped', async () => {
    const onChange = vi.fn<() => void>()
    const stop = watchGitState(resolveGitDir(repo)!, onChange)

    writeFileSync(join(repo, 'b.txt'), 'b')
    git('add .')
    git('commit -q -m second')

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })

    stop()
    onChange.mockClear()

    git('commit -q --allow-empty -m third')
    await new Promise(done => setTimeout(done, 500))

    expect(onChange).not.toHaveBeenCalled()
  })

  test('ignores a change to the working tree only', async () => {
    const onChange = vi.fn<() => void>()
    const stop = watchGitState(resolveGitDir(repo)!, onChange)

    writeFileSync(join(repo, 'a.txt'), 'edited')
    await new Promise(done => setTimeout(done, 500))
    stop()

    expect(onChange).not.toHaveBeenCalled()
  })

  test('returns a no-op for a directory that does not exist', () => {
    expect(() => watchGitState(join(repo, 'missing'), () => {})()).not.toThrow()
  })
})
