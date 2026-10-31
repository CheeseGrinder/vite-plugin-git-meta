import { resolve } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import * as git from '../git.js'
import { gitMeta } from '../index.js'
import { runConfig } from './helpers.js'

describe('gitMeta', () => {
  test('has a stable name', () => {
    expect(gitMeta().name).toBe('vite-plugin-git-meta')
  })

  test('defines __GIT_META__ as serialised JSON', () => {
    const config = runConfig(gitMeta({ version: '1.0.0' }))
    const meta = JSON.parse(config.define!.__GIT_META__)

    expect(meta.version).toBe('1.0.0')
    expect(Object.keys(meta).sort()).toEqual([
      'branch',
      'buildDate',
      'commit',
      'commitDate',
      'commitsSinceTag',
      'dirty',
      'displayVersion',
      'shortCommit',
      'tag',
      'version',
    ])
  })

  test('runs git in the Vite root, and the cwd option wins over it', () => {
    const spy = vi.spyOn(git, 'collectGitMeta')

    runConfig(gitMeta(), { root: 'some/root' })
    runConfig(gitMeta({ cwd: '/forced' }), { root: 'some/root' })

    expect(spy.mock.calls[0]?.[1]).toBe(resolve('some/root'))
    expect(spy.mock.calls[1]?.[1]).toBe('/forced')

    spy.mockRestore()
  })
})
