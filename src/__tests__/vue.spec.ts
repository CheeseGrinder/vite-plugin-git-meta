import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp } from 'vue'
import type { GitMeta } from '../types.js'
import { GitMetaPlugin, useGitMeta } from '../vue.js'

const meta = {
  version: '1.0.0',
  tag: null,
  branch: 'main',
  commit: 'abc',
  shortCommit: 'a',
  displayVersion: 'main#a',
  commitDate: '2026-01-01',
  buildDate: '2026-01-02',
} satisfies GitMeta

describe('GitMetaPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('exposes $git and provides the meta', () => {
    vi.stubGlobal('__GIT_META__', meta)

    const app = createApp({ render: () => null })
    app.use(GitMetaPlugin)

    expect(app.config.globalProperties.$git).toEqual(meta)
    expect(app.runWithContext(() => useGitMeta())).toEqual(meta)
  })

  test('explains the missing Vite plugin when __GIT_META__ is undefined', () => {
    const app = createApp({ render: () => null })

    expect(() => app.use(GitMetaPlugin)).toThrow(/gitMeta\(\)/)
  })

  test('useGitMeta throws when the plugin is not installed', () => {
    const app = createApp({ render: () => null })

    expect(() => app.runWithContext(() => useGitMeta())).toThrow(/app\.use/)
  })
})
