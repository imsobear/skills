# skills

Reusable Agent Skills — focused, opinionated SKILL.md files an agent loads
on demand. Distributed via [`npx skills`](https://github.com/vercel-labs/skills),
which installs them into whichever AI coding agent(s) you have set up.

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

```bash
npx skills add imsobear/skills
```

[`npx skills`](https://github.com/vercel-labs/skills) (vercel-labs/skills)
discovers `*/SKILL.md` files in this repo and installs them into the right
location for whichever agents you have — Cursor, Claude Code, Codex,
OpenCode, GitHub Copilot, Windsurf, Cline, and 50+ others.

### Other commands

```bash
npx skills list                  # what's installed locally
npx skills update                # pull latest from each installed source
npx skills remove imsobear/skills
```

See the [`npx skills` docs](https://github.com/vercel-labs/skills) for
selective installation (single skill), pinning to a specific git ref,
project- vs global-scope, symlink vs copy, and CI/non-interactive mode.

### Local development

Point `npx skills` at a local checkout instead of this repo's GitHub URL:

```bash
npx skills add ./path/to/skills
```

## Repository layout

```
skills/
├── create-github-repo/SKILL.md
├── setup-npm-publishing/SKILL.md
├── open-new-version/SKILL.md
└── release-version/SKILL.md
```

CI validates that every top-level directory contains a `SKILL.md` with a
`name:` and `description:` in its YAML frontmatter — so just adding a new
`<skill-name>/SKILL.md` is enough to ship a new skill.

## License

MIT. See [LICENSE](./LICENSE).
