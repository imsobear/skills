# skills

Reusable [Cursor Agent Skills](https://docs.cursor.com/) — focused, opinionated
SKILL.md files the agent loads on demand.

## What's here

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

Drop any of these directories into one of:

- `~/.cursor/skills/` — personal, available across all your projects
- `<project>/.cursor/skills/` — project-scoped, shared via the repo

Cursor picks them up automatically.

## License

MIT. See [LICENSE](./LICENSE).
