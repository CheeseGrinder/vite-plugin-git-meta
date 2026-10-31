import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { collectGitMeta } from './git.js'
import type { GitMetaOptions } from './types.js'

export function gitMeta(options: GitMetaOptions = {}): Plugin {
  return {
    name: 'vite-plugin-git-meta',
    config(userConfig) {
      const cwd = options.cwd ?? resolve(userConfig.root ?? process.cwd())

      return {
        define: {
          __GIT_META__: JSON.stringify(collectGitMeta(options, cwd)),
        },
      }
    },
  }
}

export { collectGitMeta, DEFAULT_COMMANDS } from './git.js'
export type { GitCommandName, GitMeta, GitMetaOptions } from './types.js'
export default gitMeta
