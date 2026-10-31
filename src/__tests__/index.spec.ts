import { resolve } from 'node:path'
import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as git from '../git.js'
import { gitMeta } from '../index.js'
import * as watcher from '../watch.js'

function runConfig(plugin: Plugin, userConfig: UserConfig = {}) {
  const hook = plugin.config as (config: UserConfig, env: ConfigEnv) => UserConfig

  return hook(userConfig, { command: 'build', mode: 'production' })
}

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

describe('gitMeta versionFile', () => {
  beforeEach(() => {
    vi.spyOn(watcher, 'resolveGitDir').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function bundleWith(plugin: Plugin) {
    const emitFile = vi.fn<(file: { type: string, fileName: string, source: string }) => void>()

    runConfig(plugin)
    ;(plugin.generateBundle as unknown as (this: { emitFile: typeof emitFile }) => void).call({ emitFile })

    return emitFile
  }

  function serveWith(plugin: Plugin, url: string) {
    let handler: (req: { url: string }, res: unknown, next: () => void) => void = () => {}
    const server = { config: { base: '/' }, middlewares: { use: (fn: typeof handler) => (handler = fn) } }
    const res = { setHeader: vi.fn<(name: string, value: string) => void>(), end: vi.fn<(body: string) => void>() }
    const next = vi.fn<() => void>()

    runConfig(plugin)
    ;(plugin.configureServer as (server: unknown) => void)(server)
    handler({ url }, res, next)

    return { res, next }
  }

  test('emits nothing by default', () => {
    expect(bundleWith(gitMeta())).not.toHaveBeenCalled()
  })

  test('emits version.json with the same metadata as the define', () => {
    const plugin = gitMeta({ versionFile: true, version: '1.0.0' })
    const emitFile = bundleWith(plugin)

    expect(emitFile).toHaveBeenCalledOnce()

    const asset = emitFile.mock.calls[0]?.[0]

    expect(asset).toMatchObject({ type: 'asset', fileName: 'version.json' })
    expect(JSON.parse(asset.source)).toMatchObject({ version: '1.0.0' })
  })

  test('takes a custom file name and drops a leading slash', () => {
    expect(bundleWith(gitMeta({ versionFile: '/meta/build.json' })).mock.calls[0]?.[0].fileName).toBe('meta/build.json')
  })

  test('serves the file in dev and lets other requests through', () => {
    const hit = serveWith(gitMeta({ versionFile: true, version: '1.0.0' }), '/version.json?t=1')

    expect(hit.res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(JSON.parse(hit.res.end.mock.calls[0]?.[0])).toMatchObject({ version: '1.0.0' })
    expect(hit.next).not.toHaveBeenCalled()

    const miss = serveWith(gitMeta({ versionFile: true }), '/index.html')

    expect(miss.next).toHaveBeenCalledOnce()
    expect(miss.res.end).not.toHaveBeenCalled()
  })
})

describe('gitMeta dev refresh', () => {
  function startServer(plugin: Plugin) {
    const restart = vi.fn<() => Promise<void>>(async () => {})
    const close = vi.fn<() => void>()
    const server = {
      config: { base: '/', logger: { info: vi.fn<(message: string) => void>() } },
      middlewares: { use: vi.fn<() => void>() },
      httpServer: { once: vi.fn<(event: string, listener: () => void) => void>() },
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

    return { server, restart, close, meta: JSON.parse(config.define!.__GIT_META__), trigger: () => onChange() }
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

  test('stops watching when the dev server closes', () => {
    const { server, close } = startServer(gitMeta())
    const [event, listener] = server.httpServer.once.mock.calls[0] ?? []

    expect(event).toBe('close')

    listener?.()

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
