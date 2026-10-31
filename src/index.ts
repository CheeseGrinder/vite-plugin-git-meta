import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { collectGitMeta } from './git.js'
import type { GitMeta, GitMetaOptions } from './types.js'

const DEFAULT_VERSION_FILE = 'version.json'

function resolveVersionFile(option: GitMetaOptions['versionFile']) {
  if (!option) {
    return null
  }

  return option === true ? DEFAULT_VERSION_FILE : option.replace(/^\/+/, '')
}

export function gitMeta(options: GitMetaOptions = {}): Plugin {
  const versionFile = resolveVersionFile(options.versionFile)
  let meta: GitMeta | undefined

  return {
    name: 'vite-plugin-git-meta',
    config(userConfig) {
      const cwd = options.cwd ?? resolve(userConfig.root ?? process.cwd())

      meta = collectGitMeta(options, cwd)

      return {
        define: {
          __GIT_META__: JSON.stringify(meta),
        },
      }
    },
    configureServer(server) {
      if (!versionFile) {
        return
      }

      const url = `${server.config.base}${versionFile}`

      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== url) {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(meta, null, 2))
      })
    },
    generateBundle() {
      if (!versionFile) {
        return
      }

      this.emitFile({ type: 'asset', fileName: versionFile, source: JSON.stringify(meta, null, 2) })
    },
  }
}

export { collectGitMeta, DEFAULT_COMMANDS } from './git.js'
export type { GitCommandName, GitMeta, GitMetaOptions } from './types.js'
export default gitMeta
