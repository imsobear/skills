---
name: release-version
description: >-
  Publish the release/x.y.z branch the user is currently on. Use when the
  user says "release", "发布", "出版本", "publish", "merge the release PR",
  or otherwise signals they're done with a release/x.y.z branch and want it
  on the registry. Runs pre-flight checks, summarizes the PR, **waits for
  explicit confirmation**, then squash-merges so the release workflow
  publishes + tags + drafts the GitHub release.
---

# Release a version

The *close* half of the release flow. The *open* half is the
`open-new-version` skill.

Run from the project root that owns the `release/x.y.z` branch. If the cwd
isn't that project, stop and ask.

## Hard rule

**Do not merge anything until the user has explicitly confirmed the PR
summary.** The whole point of this skill is to make publish a deliberate
checkpoint, not a reflex.

## Phase 1 — Pre-flight (run in parallel)

```bash
git status --short                              # MUST be empty
git rev-parse --abbrev-ref HEAD                 # MUST be release/x.y.z
node -p "require('./package.json').version"     # MUST equal x.y.z in branch name
git log origin/release/x.y.z..HEAD --oneline    # MUST be empty (all local commits pushed)
gh pr list --head release/x.y.z --base main \
  --json number,url,title,state                 # exactly one open PR
```

If any check fails:

| Check | What to do |
|---|---|
| dirty working tree | Surface the files, stop, ask. Don't stash or reset. |
| wrong branch | Stop, ask. Don't auto-checkout. |
| version mismatch | Stop. The user almost certainly forgot to bump, or is on the wrong branch. |
| unpushed commits | `git push` first, then re-run pre-flight. |
| zero PRs | Open one with `gh pr create --base main --title "Release x.y.z" --body …`, then continue. |
| multiple PRs | Stop, ask. |

## Phase 2 — Verify the PR is mergeable

```bash
gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup
```

Required:

- `mergeable` is `MERGEABLE`
- `mergeStateStatus` is `CLEAN` (or `UNSTABLE` *iff* only non-required
  checks are yellow — required checks MUST be green)
- required status checks in `statusCheckRollup` are `SUCCESS`

If CI is still `IN_PROGRESS`, wait for it (`gh run watch …`) rather than
proceeding.

## Phase 3 — Summarize, then STOP

Report to the user, no more, no less:

- PR number + URL
- Version: `<old> → x.y.z` (look up old via `npm view <pkg> version`)
- Commit count + 1–2 line summary of what's in the release (extract from
  `gh pr view <n> --json commits`)
- The required check status
- "Confirm to merge and publish."

**Then stop.** Wait for an explicit "yes" / "发布吧" / "go" / similar
affirmative. Anything ambiguous → ask again.

## Phase 4 — Merge + watch publish

Only after explicit confirmation:

```bash
gh pr merge <n> --squash --delete-branch
```

**FOOTGUN**: `gh pr merge --delete-branch` checks the local repo out to
`main` automatically. The agent has historically forgotten this and pushed
the next commit straight to main, bypassing protection. Right after the
merge command, **always** run:

```bash
git branch --show-current
```

and never `git commit`/`git push` until you've intentionally moved off
main again.

Then watch the release workflow (name varies by project — find it via
`gh workflow list`):

```bash
RID=$(gh run list --workflow=Release --branch=main --limit=1 \
  --json databaseId -q '.[0].databaseId')
gh run watch --exit-status "$RID"
```

A typical workflow does: `Install → Build → Typecheck → npm publish → Tag
+ GitHub release`. If any job fails, jump to *Recovery* below.

## Phase 5 — Report

- registry: `npm view <pkg>@x.y.z version` (one-line confirmation that the
  new version is live)
- tag: `v$x.y.z` pushed (visible in `git ls-remote --tags origin`)
- GitHub release: link to the new release page

## Recovery — what to do if release fails

The big invariant: **you cannot republish the same version number to the
registry**. The whole recovery path is "fix-forward via a new version".

| Failure | Recovery |
|---|---|
| Build / typecheck fails on main | Catastrophic — the release PR shouldn't have merged. Investigate why required checks didn't catch it. Then open `release/x.y.z+1` with the fix. |
| `npm publish` rejects (E422 / E403, missing fields, name collision, provenance complaints) | Open `release/x.y.z+1` with the metadata fix. Do **not** `--amend` the merge commit. Do **not** `npm publish` from your laptop to "rescue" it. |
| `npm publish` succeeded but the tag step failed | Manually push the tag and create the GitHub release (`gh release create v$x.y.z --generate-notes`). Don't redo publish. |
| Workflow skipped publish because the version already exists | Likely a previous successful publish you missed. Verify with `npm view <pkg>@x.y.z` and proceed to Phase 5 reporting. |

## What this skill explicitly does NOT do

- Doesn't tag manually (the release workflow does).
- Doesn't write CHANGELOG entries (the user does that on the PR, or
  auto-generated notes cover it).
- Doesn't bypass branch protection. If a push to main is needed, route it
  through a PR.
