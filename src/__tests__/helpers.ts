import type { ConfigEnv, Plugin, UserConfig } from 'vite'

export function runConfig(plugin: Plugin, userConfig: UserConfig = {}) {
  const hook = plugin.config as (config: UserConfig, env: ConfigEnv) => UserConfig

  return hook(userConfig, { command: 'build', mode: 'production' })
}
