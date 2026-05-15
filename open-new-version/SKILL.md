---
name: open-new-version
description: >-
  Open a new version branch for an npm package. Use when the user says
  "open new version x.y.z", "开新版本 x.y.z", "开个新版本", "open release
  branch", or otherwise signals they want to start work toward the next
  published version. Bumps package.json on a fresh release/x.y.z branch,
  pushes, and opens the PR that the release-version skill will later merge.
---

# Open a new version

The *open* half of the release flow. The *close* half lives in the
`release-version` skill.

Run from the project root that owns the `package.json` you intend to bump.
If the cwd doesn't look like that project (no `package.json`, or it's the
wrong one), stop and ask.

## Inputs

Resolve `x.y.z` from the user's message. If they didn't supply one:

1. `node -p "require('./package.json').version"` → current version.
2. Propose the next semver bump (patch by default) and ask for confirmation.
   Don't guess major/minor.

## Pre-flight (all must pass)

```bash
git status --short                              # must be empty
git fetch origin main
node -p "require('./package.json').version"     # remember as $CURRENT
```

If `git status` is dirty, stop and surface the files — let the user decide
to commit/stash/discard. Never `git stash` or `git reset` on the user's
behalf without asking; this skill has wiped working trees before.

If `x.y.z <= $CURRENT` per semver, stop and ask.

If a `release/x.y.z` branch already exists locally or on origin, stop:
the user probably wants the existing branch, not a fresh one.

## Steps

Use the package manager the project already uses (check for
`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`). Examples below use
`pnpm`; substitute as needed.

```bash
git checkout main
git pull --ff-only
git checkout -b release/x.y.z

pnpm version x.y.z --no-git-tag-version         # edits package.json only — tagging is the release workflow's job
git commit -am "chore: bump version to x.y.z"
git push -u origin release/x.y.z

gh pr create --base main \
  --title "Release x.y.z" \
  --body  "Release x.y.z. Squash-merging this PR triggers publish."
```

Then call `SetActiveBranch` to update the IDE's active branch indicator to
`release/x.y.z`.

## Output

Report **only** these four things, in this order:

- PR URL
- Branch name
- Old version → new version
- "Iterate on this branch. When done, ask me to 'release' and I'll run the release-version skill."

Don't run CI yourself, don't watch it, don't merge — that's the release
skill's job.

## Footguns

- **Don't** create a git tag. The release workflow does that after publish.
- **Don't** run `npm`/`pnpm`/`yarn version` without `--no-git-tag-version`
  — it'll make a tag that later collides with the workflow's tag.
- **Don't** force-push. The branch is fresh; nothing to rewrite.
- **Don't** edit `CHANGELOG.md` or write release notes here. That's the
  release skill's territory; the user usually wants to review notes after
  the PR has accumulated commits.
