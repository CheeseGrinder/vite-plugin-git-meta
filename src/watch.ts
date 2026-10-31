import { watch } from 'node:fs'
import { runCommand } from './git.js'
import type { CommandRunner } from './git.js'
import type { GitMeta } from './types.js'

const DEBOUNCE_MS = 200

/** Paths inside the git directory that move when a commit, checkout, tag or fetch happens. */
const WATCHED_PATHS = /^(HEAD|packed-refs|refs([\\/]|$))/

/** The fields a restart is worth it for: edits to the working tree must not trigger one. */
export function hasGitStateChanged(previous: GitMeta, next: GitMeta) {
  return previous.commit !== next.commit || previous.branch !== next.branch || previous.tag !== next.tag
}

export function resolveGitDir(cwd: string, run: CommandRunner = runCommand) {
  return run('git rev-parse --absolute-git-dir', cwd)
}

/**
 * Calls `onChange` (debounced) when HEAD or a ref moves, and returns a function that stops watching.
 * Returns a no-op when the directory cannot be watched, since the dev refresh is only a convenience.
 */
export function watchGitState(gitDir: string, onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const watcher = watch(gitDir, { recursive: true }, (_event, filename) => {
      if (!filename || !WATCHED_PATHS.test(filename)) {
        return
      }

      clearTimeout(timer)
      timer = setTimeout(onChange, DEBOUNCE_MS)
    })

    watcher.unref()

    return function stop() {
      clearTimeout(timer)
      watcher.close()
    }
  } catch {
    return function stop() {}
  }
}
