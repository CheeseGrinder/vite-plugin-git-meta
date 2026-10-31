import type { InjectionKey, Plugin } from 'vue'
import { inject } from 'vue'
import type { GitMeta } from './types.js'

declare module 'vue' {
  interface ComponentCustomProperties {
    $git: GitMeta
  }
}

export const GIT_META_KEY = Symbol('git-meta') as InjectionKey<GitMeta>

export const GitMetaPlugin: Plugin = {
  install(app) {
    if (typeof __GIT_META__ === 'undefined') {
      throw new Error('vite-plugin-git-meta: __GIT_META__ is not defined, add gitMeta() to the Vite plugins')
    }

    app.config.globalProperties.$git = __GIT_META__
    app.provide(GIT_META_KEY, __GIT_META__)
  },
}

export function useGitMeta() {
  const meta = inject(GIT_META_KEY)

  if (!meta) {
    throw new Error('vite-plugin-git-meta: install GitMetaPlugin with app.use() before calling useGitMeta()')
  }

  return meta
}

export type { GitMeta }
export default GitMetaPlugin
