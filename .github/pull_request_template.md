## What and why

<!-- What changes, and the problem it solves. Link the issue: Closes #123 -->

## Type of change

- [ ] fix
- [ ] feat
- [ ] docs / specs
- [ ] test / ci / build / chore
- [ ] Breaking change (public API, option, output shape)

## How it was tested

<!-- Unit, integration, manual in a Vite app... The pkg.pr.new bot comment gives an install command to try the build. -->

## Checklist

- [ ] `bun run typecheck && bun run lint:check && bun run format:check && bun run test && bun run build && bun run check:package` pass
- [ ] The PR title is a Conventional Commit (`feat: ...`, `fix: ...`, `feat!: ...`), it becomes the changelog line
- [ ] Tests added or updated (a bug fix has a test that fails without it)
- [ ] `docs/specs/` and the README are updated if behaviour or the API changed
- [ ] No em dash (U+2014) in the diff or the commit messages
