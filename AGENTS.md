# AGENTS.md

## Working Conventions

### Honesty
Always be truthful and face problems directly. Never fabricate, obscure, or work around a real issue to make things appear to work.

- If a check fails, investigate and fix the root cause — do not delete the check or skip it.
- If something is uncertain or unknown, say so explicitly rather than guessing with false confidence.
- If a fix is incomplete or only partially verified, state that clearly.
- Never claim something is working unless it has been confirmed to work.

### Commit conventions
- The commit author is always the human user configured via `git config user.name` / `user.email`.
- Do NOT add signatures, footers, or co-authored-by lines referencing any AI tool, provider, or service (e.g., "Committed with Claude Code", "Co-authored-by: Claude", "Signed-off-by: GitHub Copilot", links to anthropic.com, etc.).
- Do NOT append marketing messages, URLs, or branding to commit messages.
- Keep commit messages concise: describe what was done and why, nothing else.

### Bilingual UI (English / Spanish)
All UI modifications or new features MUST be implemented in both English and Spanish, unless explicitly stated otherwise. Every user-facing string, label, message, or tooltip must have corresponding translations for both languages.

---

## Multi-Agent Safety Rules

Multiple agents and humans may work on this repository simultaneously.

- Do NOT revert, overwrite, reset, or restore changes you did not create.
- Differences between local files and GitHub/origin are not automatically errors.
- Treat unknown modifications as intentional unless explicitly told otherwise.
- Preserve unrelated changes, even if they appear incomplete or inconsistent.
- Only modify files directly required for the current task.
- Never perform repository-wide cleanup without explicit approval.

### Forbidden destructive commands

Never run destructive commands unless explicitly authorized:

```bash
git reset --hard
git checkout -- .
git restore .
git clean -fd
```

Never force-push or rewrite history:

```bash
git push --force
git push -f
git rebase --interactive
```

---

## Protected Instruction Files

The following files are considered PRIVATE LOCAL CONTROL FILES:

- AGENTS.md
- CLAUDE.md
- .cursorrules
- .cursor/
- .github/copilot-instructions.md

These files:

- MUST NOT be committed
- MUST NOT be pushed
- MUST NOT be modified unless explicitly requested
- MUST NOT be included in bulk staging operations
- MUST NOT be synchronized to GitHub

If these files appear modified:
- leave them untouched
- do not revert them
- do not include them in commits

Never use:
```bash
git add .
git add -A
git commit -a
```

Instead, stage files explicitly and individually.

---

## Git Safety Policy

Before any commit:
- review staged files carefully
- verify no private instruction/config files are included
- verify unrelated files are not included
- keep commits tightly scoped to the current task

Before any pull/rebase/merge:
- check for local modifications
- avoid overwriting concurrent work
- prefer asking for clarification over assuming

GitHub is NOT the sole source of truth.
Local in-progress work may intentionally differ from origin.

Never automatically synchronize local state with remote state unless explicitly instructed.

---

## Failure Handling

Never hide problems by:
- disabling checks
- removing tests
- bypassing validation
- suppressing errors
- creating fake placeholder implementations

Fix root causes whenever possible.

If a proper fix is not possible:
- explain why
- describe remaining limitations clearly
- stop rather than pretending the issue is solved

---

## Versioning and Release Policy

When asked to create a new release or tag a new version (e.g., `v1.6.0`):
1. **Check local changes**: Run `git status` to verify if there are any uncommitted local changes (modified, untracked, or unstaged files) in the working directory that represent implementation progress. Alert the user and ask for permission to stage and commit these changes *before* performing the version bump, to guarantee no work is left behind in the release.
2. **Locate version strings**: Run a global search for the current version (e.g. search for `1.5.0`, `1.5` or `1.50`) to find all files where the version number is hardcoded.
3. **Update all version locations**:
   - `package.json` (`"version"` field).
   - Code-level version checks or UI displays (e.g., `currentVer` in `src/App.tsx`).
   - Any other project-specific version configuration files.
4. **Verify compilation**: Run the project's linter or compiler (e.g., `npm run lint` or `tsc --noEmit`) to verify that no errors were introduced.
5. **Git Safety**: Stage only the specific versioned files and commit them before tagging and pushing.