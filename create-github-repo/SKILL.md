---

## name: create-github-repo
description: >-
  Bootstrap a brand-new GitHub repository with sane defaults: MIT license,
  a Node/pnpm .gitignore, a minimal CI workflow, and protected main
  (required PR + required `check` status + enforce_admins on). Use when
  the user says "新建一个 GitHub 仓库", "建仓库", "create a new repo",
  "bootstrap a project", or otherwise asks to set up a fresh repo from
  scratch (NOT when forking, cloning, or working in an existing repo).

# Bootstrap a GitHub repository

End state: a new GitHub repo exists with one initial commit on `main`,
the standard files in place, CI configured, and `main` protected (PR
required, `check` required, admins included).

## Inputs to resolve first

Before running anything, the agent MUST know:


| Input               | Required?                     | Notes                                            |
| ------------------- | ----------------------------- | ------------------------------------------------ |
| Repo name           | yes                           | Kebab-case unless the user says otherwise.       |
| Visibility          | yes                           | **Always ask.** Options: `public` / `private`.   |
| Description         | nice-to-have                  | One short sentence. Leave blank if missing.      |
| Owner (user vs org) | default to authenticated user | Ask only if multiple options likely.             |
| Local path          | ask the user                  | Bail if a directory of that name already exists. |


Don't proceed until name + visibility are pinned down.

## Phase 1 — Local scaffold

```bash
mkdir -p <path>/<name>
cd <path>/<name>
git init -b main
```

Write these four files (templates below):

- `.gitignore`
- `LICENSE`
- `README.md`
- `.github/workflows/ci.yml`

### `.gitignore` (Node/pnpm default — swap section if stack differs)

```gitignore
# deps
node_modules/

# build output
dist/
build/
.vite/
.tanstack/

# env / secrets
.env
.env.*
!.env.example

# logs
*.log
npm-debug.log*
pnpm-debug.log*

# editor / OS
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
```

For **Python** projects swap the top two sections for `__pycache__/`,
`*.pyc`, `.venv/`, `.pytest_cache/`, `dist/`, `*.egg-info/`.
For **Go** swap for `bin/`, `pkg/`, `vendor/` (only if not committing
vendor), `*.test`, `*.out`.

### `LICENSE`

Default to MIT. Substitute the year (`date +%Y`) and copyright holder
(look up via `git config user.name`; ask if empty):

```text
MIT License

Copyright (c) <year> <holder>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### `README.md`

Just a stub — the user will fill it in:

```markdown
# <name>

<description from input, or "TODO">
```

### `.github/workflows/ci.yml`

This produces the `check` status the protection rule below requires. The
**job name** MUST be `check` (the job name becomes the status context),
otherwise protection won't match.

```yaml
name: CI

on:
  push:
    branches-ignore: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Typecheck
        run: pnpm typecheck
```

For non-Node stacks, keep the **job name** `check` and the **branch
triggers** the same; swap the step bodies.

## Phase 2 — Create the GitHub repo + first push

```bash
gh repo create <owner>/<name> --<public|private> \
  --description "<desc>" \
  --source . \
  --remote origin

git add .
git commit -m "chore: initial commit"
git push -u origin main
```

This direct push to main is fine — protection isn't applied yet. After
this point, **never** push directly to main again.

## Phase 3 — Apply branch protection

GitHub requires the branch to exist before protection can be applied,
which is why this step comes after the first push. Use the API directly
because `gh` has no equivalent one-liner for the full ruleset:

```bash
gh api -X PUT repos/<owner>/<name>/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["check"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false,
  "lock_branch": false
}
JSON
```

What each field is doing:

- `required_status_checks.contexts: ["check"]` — the `check` job from
`ci.yml` must be green before merge.
- `enforce_admins: true` — repo admins **cannot** bypass. Prevents the
agent from accidentally pushing to main when it forgets it was
switched to main by `gh pr merge --delete-branch`.
- `required_approving_review_count: 0` — PRs are required but no human
approver is required. Solo-dev friendly while still forcing every
change through a PR + CI.
- `allow_force_pushes / allow_deletions: false` — main can't be reset
or deleted even from local.

## Phase 4 — Verify

```bash
gh api repos/<owner>/<name>/branches/main/protection \
  -q '{
    check: .required_status_checks.contexts[0],
    enforce_admins: .enforce_admins.enabled,
    pr_required: (.required_pull_request_reviews != null),
    force_push: .allow_force_pushes.enabled,
    delete: .allow_deletions.enabled
  }'
```

Expected:

```json
{
  "check": "check",
  "enforce_admins": true,
  "pr_required": true,
  "force_push": false,
  "delete": false
}
```

If anything is off, surface the mismatch and stop — don't blindly retry.

## Phase 5 — Smoke-test that protection actually rejects

Admin bypass can be silently on without anyone noticing. Run this once
on every fresh repo:

```bash
git commit --allow-empty -m "probe: must be rejected"
git push origin main 2>&1 | tee /tmp/push-probe.log
git reset --hard HEAD~1
```

The push MUST fail with `GH006: Protected branch update failed`. If it
succeeds, protection is misconfigured — go back to Phase 3. After
verifying, `git reset --hard HEAD~1` drops the probe locally (it never
reached origin).

## Phase 6 — Report

Tell the user, in this order:

- Repo URL: `https://github.com/<owner>/<name>`
- Visibility (public/private)
- Local path
- "main is protected (PR required, `check` required, admins included).
Direct pushes are blocked — confirmed by smoke test."
- Next step: "Open a feature branch with `git checkout -b feat/...` for
any further changes."

## Footguns

- **First push must precede protection.** If you `git push` after
applying protection, you'll be locked out of the empty repo and need
to temporarily disable `enforce_admins` to push the first commit.
Order matters: scaffold → push → protect.
- **The job name in `ci.yml` is `check`** — not the workflow name. The
protection rule's `contexts` array matches the **job-name status
context**, not the workflow filename or `name:`. If you rename the
job, update the contexts array.
- **Don't `gh repo create --clone`** in the same step as `git init` —
pick one. The flow above does local `git init` first and uses
`--source .` to attach.
- **MIT year**: use the actual current year (`date +%Y`). Don't
hardcode.
- **Owner may be a user or an org.** `gh repo create` accepts both — if
the user is a member of multiple orgs, ask which one to create under
instead of guessing.
- **Check `gh auth status` first.** None of this works without it. Bail
with a clear message if not logged in — don't silently fail.

