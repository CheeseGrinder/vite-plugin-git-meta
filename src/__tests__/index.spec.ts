import { resolve } from 'node:path'
import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import { describe, expect, test, vi } from 'vitest'
import * as git from '../git.js'
import { gitMeta } from '../index.js'

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
