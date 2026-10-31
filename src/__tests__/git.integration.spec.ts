import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { collectGitMeta } from '../git.js'

let repo = ''

function git(args: string) {
  return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

describe('collectGitMeta against a real repository', () => {
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'git-meta-'))
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

  test('describes an untagged commit by branch and short hash', () => {
    const meta = collectGitMeta({ version: '0.0.1' }, repo)

    expect(meta.branch).toBe('trunk')
    expect(meta.tag).toBeNull()
    expect(meta.commit).toBe(git('rev-parse HEAD'))
    expect(meta.displayVersion).toBe(`trunk#${git('rev-parse --short HEAD')}`)
    expect(meta.commitsSinceTag).toBeNull()
    expect(meta.dirty).toBe(false)
  })

  test('uses the tag once HEAD is tagged', () => {
    git('tag v1.0.0')

    const meta = collectGitMeta({}, repo)

    expect(meta.tag).toBe('v1.0.0')
    expect(meta.displayVersion).toBe('v1.0.0')
    expect(meta.commitsSinceTag).toBe(0)
  })

  test('counts commits past the tag and flags uncommitted changes', () => {
    writeFileSync(join(repo, 'b.txt'), 'b')
    git('add .')
    git('commit -q -m second')

    expect(collectGitMeta({}, repo)).toMatchObject({ tag: null, commitsSinceTag: 1, dirty: false })

    writeFileSync(join(repo, 'b.txt'), 'changed')

    expect(collectGitMeta({}, repo).dirty).toBe(true)

    git('checkout -q -- b.txt')
  })

  test('falls back outside a repository', () => {
    const empty = mkdtempSync(join(tmpdir(), 'git-meta-empty-'))

    try {
      expect(collectGitMeta({}, empty)).toMatchObject({ branch: 'unknown', commit: 'unknown', tag: null })
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
