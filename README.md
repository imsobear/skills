# sobear

Reusable [Cursor Agent Skills](https://docs.cursor.com/) — focused, opinionated
SKILL.md files the agent loads on demand. Distributed as the [`sobear`](https://www.npmjs.com/package/sobear)
npm package with a tiny installer.

## Skills

| Skill | Purpose |
|---|---|
| [`create-github-repo`](./create-github-repo/SKILL.md) | Bootstrap a fresh GitHub repo with MIT, CI, and protected `main`. |
| [`setup-npm-publishing`](./setup-npm-publishing/SKILL.md) | Wire up `release.yml` + `package.json` so merge-to-main publishes to npm. |
| [`open-new-version`](./open-new-version/SKILL.md) | Open a `release/x.y.z` branch with the version bumped. |
| [`release-version`](./release-version/SKILL.md) | Pre-flight, summarize, confirm, and squash-merge a release PR. |

The four are designed to compose:

```
create-github-repo  →  setup-npm-publishing  →  open-new-version  ⇄  release-version
        (once)                (once)                (per release)
```

## Install

Cursor reads skills from `~/.cursor/skills/` (personal) or `<project>/.cursor/skills/`
(project-scoped). It does **not** read from `node_modules/`, so an installer step
is required.

### Personal (default)

```bash
npx sobear install
# -> ~/.cursor/skills/
```

### Project-scoped

```bash
npx sobear install --project
# -> <cwd>/.cursor/skills/
```

### Custom location

```bash
npx sobear install --path /some/where
```

By default existing skill directories are left alone. Pass `--force` to
overwrite.

### List bundled skills

```bash
npx sobear list
```

## License

MIT. See [LICENSE](./LICENSE).
