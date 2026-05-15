---
name: setup-npm-publishing
description: >-
  One-time setup that turns an existing Node/pnpm repository into one that can
  publish to npm via merge-to-main. Scaffolds .github/workflows/release.yml,
  fills the package.json fields npm provenance requires, and walks the user
  through setting NPM_TOKEN. Use when the user says "加发包能力", "set up npm
  publishing", "我要把这个仓库发到 npm 上", or otherwise asks to wire up
  automated npm releases on an existing repo. NOT for per-version publishing
  — that's the `release-version` skill.
---

# Set up npm publishing on an existing repo

Runs **inside an existing repo** (i.e. there's already a `package.json` and
git history). If the repo doesn't exist yet, run `create-github-repo` first.

End state: merging any PR into `main` triggers `release.yml`, which runs
`npm publish --provenance`, tags `v$version`, and drafts a GitHub release —
the same flow agentmind uses.

## Phase 0 — Pre-flight

```bash
test -f package.json                            # must exist
test -d .git                                    # must be a repo
gh auth status                                  # must be logged in
git remote get-url origin                       # extract owner/name
node -p "require('./package.json').name"        # remember as $pkg
```

If `package.json.private` is `true`, ask the user — public packages
remove the `private` field, but they may have meant to keep it private.

Check if the name is already taken on the registry:

```bash
npm view "$pkg" version 2>&1
```

- If it returns a version → the name is **taken**. Stop and ask the user
  whether to rename, scope it (`@user/name`), or proceed knowing this
  repo's publish will only ever succeed if they own that npm name.
- If it returns `npm error code E404` → name is free, continue.

## Phase 1 — Patch package.json

Required by `npm publish --provenance` (the 0.1.2 → 0.1.3 fix-forward
existed because these fields were missing):

```json
{
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/<repo>.git"
  },
  "bugs": {
    "url": "https://github.com/<owner>/<repo>/issues"
  },
  "homepage": "https://github.com/<owner>/<repo>#readme"
}
```

Strongly recommended:

```json
{
  "files": ["dist", "bin", "README.md", "LICENSE"],
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "prepublishOnly": "pnpm build && pnpm typecheck"
}
```

What each one does:

- `files` — whitelist what ships to the registry. Without it, npm ships
  *everything* not gitignored (including `.github/`, `src/`, dotfiles).
- `publishConfig.access: public` — required for unscoped public packages
  and `@scope/x` packages on free accounts; harmless on private ones.
- `publishConfig.provenance: true` — turns on Sigstore provenance. The
  `release.yml` workflow also passes `--provenance` on the CLI but having
  it here documents intent.
- `prepublishOnly` — local safety net. If a user accidentally `npm
  publish`es from their laptop, this aborts on a broken build.

Adjust the script names (`build`, `typecheck`) to whatever the repo
actually uses. If the repo doesn't have them, leave `prepublishOnly` out
rather than inventing scripts.

## Phase 2 — Scaffold `release.yml`

Write to `.github/workflows/release.yml`:

```yaml
name: Release

# Merge-first, then publish: every push to main checks if the version
# in package.json is already on npm. If not, it publishes, tags, and
# drafts a GitHub release. Re-running on the same version is a no-op.

on:
  push:
    branches: [main]

permissions:
  contents: write
  id-token: write    # required for npm provenance via OIDC

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Resolve package metadata
        id: meta
        run: |
          echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT
          echo "name=$(node -p "require('./package.json').name")"       >> $GITHUB_OUTPUT

      - name: Skip if already published
        id: skip
        run: |
          if npm view "${{ steps.meta.outputs.name }}@${{ steps.meta.outputs.version }}" version 2>/dev/null; then
            echo "already-published=true" >> $GITHUB_OUTPUT
          else
            echo "already-published=false" >> $GITHUB_OUTPUT
          fi

      - uses: pnpm/action-setup@v4
        if: steps.skip.outputs.already-published == 'false'
        with:
          version: 10

      - uses: actions/setup-node@v4
        if: steps.skip.outputs.already-published == 'false'
        with:
          node-version: '20'
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        if: steps.skip.outputs.already-published == 'false'
        run: pnpm install --frozen-lockfile

      - name: Build
        if: steps.skip.outputs.already-published == 'false'
        run: pnpm build

      - name: Typecheck
        if: steps.skip.outputs.already-published == 'false'
        run: pnpm typecheck

      - name: npm publish
        if: steps.skip.outputs.already-published == 'false'
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Tag + GitHub release
        if: steps.skip.outputs.already-published == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tag="v${{ steps.meta.outputs.version }}"
          git tag "$tag"
          git push origin "$tag"
          gh release create "$tag" --generate-notes
```

Why this shape:

- **Build BEFORE Typecheck**: agentmind learned this the hard way. If
  `routeTree.gen.ts` or similar generated files are needed by typecheck,
  typecheck fails when run on a fresh CI checkout. Build produces those
  files. Order matters even if it feels "wrong".
- **`Skip if already published`**: this lets you push CI-only commits
  (lint, docs, workflow tweaks) to main without trying — and failing —
  to republish the same version. Re-running the workflow on a non-bump
  commit is a no-op.
- **`id-token: write`**: required for npm provenance via OIDC. Without
  it, `npm publish --provenance` fails with a cryptic error.
- **`concurrency: cancel-in-progress: false`**: never cancel a publish
  in flight — that can leave npm and the git tag out of sync.

## Phase 3 — NPM_TOKEN secret

`gh` cannot set the secret value remotely (only repo settings can store
it). Print this **exact** snippet for the user to run themselves:

```bash
# 1. Get a token from https://www.npmjs.com/settings/<you>/tokens/granular-access-tokens/new
#    - Token name: GitHub Actions / <repo>
#    - Expiration: pick something — 1y is common
#    - Packages and scopes: allow access to <pkg>
#    - Permissions: Read and write
# 2. Set it as a repo secret:
gh secret set NPM_TOKEN --repo <owner>/<repo>
#    (paste the token when prompted)
```

After they've done it, verify (the value is never readable, but the
existence is):

```bash
gh secret list --repo <owner>/<repo> | grep NPM_TOKEN
```

If `NPM_TOKEN` doesn't appear, stop and tell the user — `release.yml`
will fail on its first run without it.

## Phase 4 — Sanity-check what would ship

Without actually publishing:

```bash
npm pack --dry-run 2>&1 | tee /tmp/pack-preview.txt
```

This prints the file list `npm publish` would upload. Walk through it
with the user:

- Should `src/` be in there? Usually no — only built `dist/`.
- Any `.env*` or test fixtures slipping through? Tighten `files` in
  `package.json` until the list looks right.
- Total size sane? Anything over a few MB for a Node CLI is suspicious.

## Phase 5 — Open a PR with the changes

The repo's `main` is protected (per `create-github-repo` conventions),
so this needs a PR like any other change:

```bash
git checkout -b chore/setup-npm-publishing
git add package.json .github/workflows/release.yml
git commit -m "chore: wire up npm publishing on merge-to-main"
git push -u origin chore/setup-npm-publishing
gh pr create --base main \
  --title "Set up npm publishing" \
  --body  "Adds release.yml + package.json fields required for \`npm publish --provenance\`. After this lands and NPM_TOKEN is set, the next version bump merged to main will publish automatically."
```

## Phase 6 — Report

Tell the user:

- PR URL (the one from Phase 5)
- "NPM_TOKEN is set: yes/no" (from Phase 3 check)
- "Once this PR merges, use `open-new-version` to bump the version, then
  `release-version` to publish."
- Any pack-list warnings from Phase 4 the user should know about

**Don't merge the PR yourself.** The user reviews + merges, same as
every other PR.

## Footguns

- **`npm publish` can't republish the same version.** If the first run
  fails because of a metadata gap, the recovery is *always*
  fix-forward: bump to the next patch, re-PR. This skill's whole point
  is to get the metadata right *before* the first publish so this
  doesn't happen, but if it does — see `release-version`'s Recovery
  section.
- **`gh` can't read secret values**, only set/delete/list them. Don't
  pretend you can verify the token's contents — only its existence.
- **`provenance: true` requires `id-token: write` AND an OIDC-enabled
  workflow context.** `workflow_dispatch` from a fork won't get OIDC.
  `push` from the repo itself works.
- **`prepublishOnly` runs on the user's laptop if they `npm publish`
  manually.** It's a safety rail, not a CI step. The CI workflow runs
  build + typecheck as explicit steps; don't rely on `prepublishOnly`
  alone there.
- **Don't add a `version` script** that creates git tags. `release.yml`
  creates the tag. Doubling up causes the workflow's `git push
  origin v$tag` to fail with "tag already exists".
