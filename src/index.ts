import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { collectGitMeta } from './git.js'
import type { GitMeta, GitMetaOptions } from './types.js'
import { hasGitStateChanged, resolveGitDir, watchGitState } from './watch.js'

const DEFAULT_VERSION_FILE = 'version.json'

function resolveVersionFile(option: GitMetaOptions['versionFile']) {
  if (!option) {
    return null
  }

  return option === true ? DEFAULT_VERSION_FILE : option.replace(/^\/+/, '')
}

export function gitMeta(options: GitMetaOptions = {}): Plugin {
  const versionFile = resolveVersionFile(options.versionFile)
  let cwd = process.cwd()
  let meta: GitMeta | undefined
  let stopWatching = () => {}

  return {
    name: 'vite-plugin-git-meta',
    config(userConfig) {
      cwd = options.cwd ?? resolve(userConfig.root ?? process.cwd())

      meta = collectGitMeta(options, cwd)

      return {
        define: {
          __GIT_META__: JSON.stringify(meta),
        },
      }
    },
    configureServer(server) {
      if (versionFile) {
        const url = `${server.config.base}${versionFile}`

        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== url) {
            return next()
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(meta, null, 2))
        })
      }

      const gitDir = resolveGitDir(cwd)

      if (!gitDir) {
        return
      }

      // The metadata is baked into `define` when the config loads, so a new commit needs a restart.
      stopWatching = watchGitState(gitDir, () => {
        const next = collectGitMeta(options, cwd)

        if (meta && hasGitStateChanged(meta, next)) {
          server.config.logger.info('git state changed, restarting the dev server', { timestamp: true })
          void server.restart()
        }
      })
    },
    closeBundle() {
      stopWatching()
      stopWatching = () => {}
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
