import type { Plugin } from 'vite'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as git from '../git.js'
import { gitMeta } from '../index.js'
import * as watcher from '../watch.js'
import { runConfig } from './helpers.js'

describe('gitMeta dev refresh', () => {
  function startServer(plugin: Plugin) {
    const restart = vi.fn<() => Promise<void>>(async () => {})
    const close = vi.fn<() => void>()
    const server = {
      config: { base: '/', logger: { info: vi.fn<(message: string) => void>() } },
      middlewares: { use: vi.fn<() => void>() },
      restart,
    }
    let onChange: () => void = () => {}

    vi.spyOn(watcher, 'resolveGitDir').mockReturnValue('/repo/.git')
    vi.spyOn(watcher, 'watchGitState').mockImplementation((_dir, callback) => {
      onChange = callback

      return close
    })

    const config = runConfig(plugin)
    ;(plugin.configureServer as (server: unknown) => void)(server)

    return { restart, close, meta: JSON.parse(config.define!.__GIT_META__), trigger: () => onChange() }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('restarts the dev server when the commit changes', () => {
    const { restart, meta, trigger } = startServer(gitMeta())

    vi.spyOn(git, 'collectGitMeta').mockReturnValue({ ...meta, commit: 'new' })
    trigger()

    expect(restart).toHaveBeenCalledOnce()
  })

  test('keeps the dev server when only the working tree moved', () => {
    const { restart, trigger } = startServer(gitMeta())

    trigger()

    expect(restart).not.toHaveBeenCalled()
  })

  test('stops watching when the dev server closes, even without an HTTP server', () => {
    const plugin = gitMeta()
    const { close } = startServer(plugin)
    ;(plugin.closeBundle as () => void)()
    ;(plugin.closeBundle as () => void)()

    expect(close).toHaveBeenCalledOnce()
  })

  test('does not watch outside a git repository', () => {
    const plugin = gitMeta()
    const server = { config: { base: '/' }, middlewares: { use: vi.fn<() => void>() } }
    const spy = vi.spyOn(watcher, 'watchGitState')

    vi.spyOn(watcher, 'resolveGitDir').mockReturnValue(null)
    runConfig(plugin)
    ;(plugin.configureServer as (server: unknown) => void)(server)

    expect(spy).not.toHaveBeenCalled()
  })
})
